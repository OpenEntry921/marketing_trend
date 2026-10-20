import { describe, it, expect } from "vitest";
import "fake-indexeddb/auto";
import { openDB } from "idb";
import { initialState, validateBackup } from "./domain";
import { load } from "./store";
import {
  aiConditions,
  aiSummary,
  confirmed,
  emptyMetrics,
  legacyResearch,
  ordered,
  reactionStats,
  researchCsv,
  retainResearch,
  type AiRecord,
  type Observation,
} from "./research";
function obs(
  time: string | null,
  views: number | null,
  likes: number | null = 0,
): Observation {
  const metrics = emptyMetrics();
  metrics.views = {
    ...metrics.views,
    value: views,
    status: views === null ? "미확인" : "확인됨",
  };
  metrics.likes = {
    ...metrics.likes,
    value: likes,
    status: likes === null ? "미확인" : "확인됨",
  };
  return {
    id: crypto.randomUUID(),
    contentId: "content",
    mode: "user",
    observedAt: time,
    originalObserved: "",
    method: "수동",
    source: "https://example.com/source",
    metrics,
  };
}
const ai = (
  execution: string,
  mention: string,
  citation: string,
): AiRecord => ({
  id: crypto.randomUUID(),
  candidateId: "candidate",
  mode: "user",
  fields: {
    question: "제품 추천?",
    service: "서비스",
    model: "모델",
    surface: "소비자용 화면",
    search: "사용",
    language: "한국어",
    region: "한국",
    execution,
    mention,
    citation,
    executedAt: "2026-01-01T12:00:00+09:00",
  },
});
describe("observations", () => {
  it("keeps zero, unavailable, and private distinct", () => {
    const zero = obs(null, 0);
    expect(confirmed(zero, "views")).toBe(0);
    zero.metrics.likes = {
      ...zero.metrics.likes,
      value: null,
      status: "비공개",
    };
    expect(confirmed(zero, "likes")).toBeNull();
    expect(reactionStats(zero).likeRate).toBeNull();
  });
  it("uses same-observation ratios and the actual interval including offsets", () => {
    const a = obs("2026-01-01T09:00:00+09:00", 100, 5),
      b = obs("2026-01-02T12:00:00Z", 250, 25);
    expect(reactionStats(b, a)).toMatchObject({
      likeRate: 10,
      delta: 150,
      growth: 150,
    });
    expect(reactionStats(b, a).daily).toBe(100);
    expect(reactionStats(obs(null, 100, null), a).likeRate).toBeNull();
  });
  it("does not calculate velocity from a single record or unknown time", () => {
    expect(reactionStats(obs(null, 100))).toMatchObject({
      delta: null,
      daily: null,
      growth: null,
    });
    expect(reactionStats(obs(null, 200), obs(null, 100))).toMatchObject({
      delta: 100,
      daily: null,
      growth: 100,
    });
  });
  it("retains decreases and guards previous zero and repeated time", () => {
    const a = obs("2026-01-01T00:00:00Z", 100),
      b = obs("2026-01-03T00:00:00Z", 80);
    expect(reactionStats(b, a)).toMatchObject({
      delta: -20,
      daily: -10,
      growth: -20,
    });
    expect(reactionStats(b, obs(a.observedAt, 0)).growth).toBeNull();
    expect(reactionStats(b, obs(b.observedAt, 100)).daily).toBeNull();
  });
  it("orders actual instants rather than the ISO string offsets", () => {
    const a = obs("2026-01-02T00:00:00+09:00", 1),
      b = obs("2026-01-01T23:00:00Z", 2);
    expect(ordered([b, a]).map((o) => o.metrics.views.value)).toEqual([1, 2]);
  });
  it("rejects mismatched status/value and preserves all prior snapshots", () => {
    const s = initialState();
    const before = structuredClone(s.observations[0]);
    s.observations.push({
      ...s.observations[0],
      id: "new",
      observedAt: "2026-01-05T00:00:00Z",
    });
    expect(validateBackup(s).observations[0]).toEqual(before);
    s.observations[0].metrics.views.status = "비공개";
    expect(() => validateBackup(s)).toThrow();
  });
});
describe("v1 migration and evidence boundaries", () => {
  it("keeps old fields, records, zeros and unknown or date-only timestamps", () => {
    const v2 = initialState();
    const { observations, commentEvidence, siteReviews, aiRecords, ...base } =
      v2;
    const old = {
      ...base,
      version: 1,
      contents: base.contents
        .slice(0, 3)
        .map((c, i) => ({
          ...c,
          fields: {
            ...c.fields,
            views: "0",
            likes: "2",
            observed:
              i === 0
                ? "2026-01-01"
                : i === 1
                  ? "2026-01-01T10:00:00+09:00"
                  : "",
          },
        })),
    };
    const migrated = validateBackup(old);
    expect(migrated.version).toBe(2);
    expect(migrated.candidates).toEqual(old.candidates);
    expect(migrated.entries).toEqual(old.entries);
    expect(migrated.contents).toEqual(old.contents);
    expect(migrated.observations.map((o) => o.observedAt)).toEqual([
      null,
      "2026-01-01T10:00:00+09:00",
      null,
    ]);
    expect(migrated.observations[0].originalObserved).toBe("2026-01-01");
    expect(migrated.observations[2].originalObserved).toBe("");
    expect(migrated.observations[0].metrics.views.value).toBe(0);
    expect(validateBackup(JSON.parse(JSON.stringify(migrated)))).toEqual(
      migrated,
    );
  });
  it("stores a recoverable original during atomic migration and never reseeds", async () => {
    const { observations, commentEvidence, siteReviews, aiRecords, ...base } =
      initialState();
    const old = {
      ...base,
      version: 1,
      candidates: [],
      contents: [],
      demoDeleted: true,
    };
    const db = await openDB("marketing-trend-local", 1, {
      upgrade(d) {
        d.createObjectStore("workspace");
      },
    });
    await db.put("workspace", old, "state");
    expect((await load()).version).toBe(2);
    expect(await db.get("workspace", "before-v2-migration")).toEqual(old);
    expect((await load()).candidates).toEqual([]);
  });
  it("never calls unknown legacy data a new observation", () => {
    const r = legacyResearch([
      {
        id: "content",
        candidateId: "candidate",
        mode: "user",
        fields: { title: "old", views: "50" },
      },
    ]);
    expect(r.observations[0]).toMatchObject({
      observedAt: null,
      originalObserved: "",
      method: "수동",
    });
  });
  it("excludes failed/unrun and unknown decisions from AI ratio denominators", () => {
    const rows = [
      ai("완료", "예", "아니오"),
      ai("완료", "아니오", "예"),
      ai("완료", "미확인", "미확인"),
      ai("실패", "아니오", "아니오"),
      ai("미실행", "아니오", "아니오"),
    ];
    expect(aiSummary(rows)).toEqual({
      completed: 3,
      excluded: 2,
      mention: { yes: 1, total: 2, unknown: 1 },
      citation: { yes: 1, total: 2, unknown: 1 },
    });
    expect(aiConditions(rows[0].fields)).not.toBe(
      aiConditions({ ...rows[0].fields, surface: "API 응답" }),
    );
  });
  it("exports demo and original source/definitions and cascades only removed parents", () => {
    const s = initialState();
    const csv = researchCsv(s, s.contents);
    expect(csv).toContain('"demo"');
    expect(csv).toContain('"시연 · 실제 출처 없음"');
    expect(csv).toContain('"가상 수치 · 실제 수집 아님"');
    const retained = retainResearch(
      s,
      new Set(s.candidates.map((c) => c.id)),
      new Set([s.contents[0].id]),
    );
    expect(retained.observations).toHaveLength(2);
    expect(s.observations).toHaveLength(24);
  });
  it("rejects orphaned extended records without changing original", () => {
    const s = initialState(),
      before = structuredClone(s);
    expect(() =>
      validateBackup({
        ...s,
        observations: [{ ...s.observations[0], contentId: "absent" }],
      }),
    ).toThrow();
    expect(s).toEqual(before);
  });
});
