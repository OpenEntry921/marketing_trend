import type { Content, Fields } from "./domain.ts";
export const metricKeys = [
  "views",
  "likes",
  "comments",
  "shares",
  "saves",
  "followers",
] as const;
export type MetricKey = (typeof metricKeys)[number];
export const metricLabels: Record<MetricKey, string> = {
  views: "조회수",
  likes: "좋아요 수",
  comments: "댓글 수",
  shares: "공유 수",
  saves: "저장 수",
  followers: "팔로워·구독자 수",
};
export const metricStatuses = [
  "확인됨",
  "미확인",
  "비공개",
  "지원 안 됨",
  "오류",
] as const;
export type Metric = {
  value: number | null;
  status: (typeof metricStatuses)[number];
  originalName: string;
  definition: string;
};
export type Observation = {
  id: string;
  contentId: string;
  mode: "demo" | "user";
  observedAt: string | null;
  originalObserved: string;
  method: "수동" | "공식 API" | "외부 제공업체" | "시연";
  source: string;
  metrics: Record<MetricKey, Metric>;
};
export const commentCategories = [
  "구매처·가격·배송 문의",
  "구매·사용 경험",
  "재구매·리필·교체 경험",
  "불만·제품 문제",
  "다른 제품과 비교",
  "이벤트·경품 참여",
  "기타·판단 불가",
];
export type CommentEvidence = {
  id: string;
  contentId: string;
  mode: "demo" | "user";
  fields: Fields;
  categories: string[];
};
export const checkItems = [
  "페이지 제목",
  "언어",
  "주요 제목·소제목",
  "읽을 수 있는 본문",
  "제품 설명",
  "용도·사양·성분·사용법",
  "작성자·운영 주체",
  "출처",
  "갱신일",
  "인증 주장과 근거",
  "HTTP 상태",
  "robots 설정",
  "noindex",
  "canonical",
  "구조화 데이터·본문 일치",
] as const;
export const checkStatuses = ["미확인", "확인됨", "문제 확인", "해당 없음"];
export type SiteReview = {
  id: string;
  candidateId: string;
  mode: "demo" | "user";
  fields: Fields;
  checks: Record<string, { status: string; evidence: string }>;
};
export type AiRecord = {
  id: string;
  candidateId: string;
  mode: "demo" | "user";
  fields: Fields;
};
export type Research = {
  observations: Observation[];
  commentEvidence: CommentEvidence[];
  siteReviews: SiteReview[];
  aiRecords: AiRecord[];
};
export const emptyResearch = (): Research => ({
  observations: [],
  commentEvidence: [],
  siteReviews: [],
  aiRecords: [],
});
export const zonedTime = (s: string) =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(
    s,
  ) &&
  Number.isFinite(Date.parse(s)) &&
  new Date(s.slice(0, 10) + "T00:00:00Z").toISOString().slice(0, 10) ===
    s.slice(0, 10);
export const emptyMetrics = (): Observation["metrics"] =>
  Object.fromEntries(
    metricKeys.map((k) => [
      k,
      {
        value: null,
        status: "미확인",
        originalName: metricLabels[k],
        definition: "미확인",
      },
    ]),
  ) as Observation["metrics"];
export function confirmed(o: Observation | undefined, k: MetricKey) {
  const m = o?.metrics[k];
  return m?.status === "확인됨" ? m.value : null;
}
export function ordered(items: Observation[]) {
  return [...items].sort(
    (a, b) =>
      (Date.parse(a.observedAt || a.originalObserved) || 0) -
      (Date.parse(b.observedAt || b.originalObserved) || 0),
  );
}
export function latest(items: Observation[]) {
  return ordered(items).at(-1);
}
export function reactionStats(current?: Observation, previous?: Observation) {
  const v = confirmed(current, "views"),
    likes = confirmed(current, "likes"),
    comments = confirmed(current, "comments"),
    old = confirmed(previous, "views");
  const elapsed =
    current?.observedAt && previous?.observedAt
      ? (Date.parse(current.observedAt) - Date.parse(previous.observedAt)) /
        86400000
      : null;
  const delta = v !== null && old !== null ? v - old : null;
  return {
    likeRate: v !== null && v > 0 && likes !== null ? (likes / v) * 100 : null,
    commentRate:
      v !== null && v > 0 && comments !== null ? (comments / v) * 100 : null,
    delta,
    daily:
      delta !== null && elapsed !== null && elapsed > 0
        ? delta / elapsed
        : null,
    growth:
      delta !== null && old !== null && old > 0 ? (delta / old) * 100 : null,
  };
}
export function legacyResearch(contents: Content[]): Research {
  const r = emptyResearch();
  for (const c of contents) {
    if (!["views", "likes", "comments"].some((k) => c.fields[k]?.trim()))
      continue;
    const metrics = emptyMetrics();
    for (const k of metricKeys) {
      const raw = c.fields[k];
      if (
        raw !== undefined &&
        raw.trim() !== "" &&
        Number.isFinite(Number(raw)) &&
        Number(raw) >= 0
      )
        metrics[k] = {
          value: Number(raw),
          status: "확인됨",
          originalName: k,
          definition: "버전 1 입력값; 플랫폼 지표 정의 미확인",
        };
    }
    const observed = c.fields.observed ?? "";
    r.observations.push({
      id: `legacy-${c.id}`,
      contentId: c.id,
      mode: c.mode,
      observedAt: zonedTime(observed) ? observed : null,
      originalObserved: observed,
      method: c.mode === "demo" ? "시연" : "수동",
      source: c.fields.url ?? "",
      metrics,
    });
  }
  return r;
}
export function demoResearch(contents: Content[]): Research {
  const r = emptyResearch();
  for (const c of contents.filter((c) => c.mode === "demo"))
    for (let i = 0; i < 2; i++) {
      const metrics = emptyMetrics();
      for (const [k, value] of Object.entries({
        views: 1000 + i * 300,
        likes: 40 + i * 12,
        comments: 12 + i * 4,
      })) {
        metrics[k as MetricKey] = {
          value,
          status: "확인됨",
          originalName: `시연 ${metricLabels[k as MetricKey]}`,
          definition: "가상 수치 · 실제 수집 아님",
        };
      }
      r.observations.push({
        id: `demo-observation-${c.id}-${i}`,
        contentId: c.id,
        mode: "demo",
        observedAt: `2026-01-0${i + 1}T09:00:00+09:00`,
        originalObserved: "",
        method: "시연",
        source: "시연 · 실제 출처 없음",
        metrics,
      });
    }
  return r;
}
export function aiConditions(f: Fields) {
  return JSON.stringify(
    [
      "question",
      "service",
      "model",
      "surface",
      "search",
      "language",
      "region",
    ].map((k) => f[k] ?? ""),
  );
}
export function aiSummary(records: AiRecord[]) {
  const completed = records.filter((r) => r.fields.execution === "완료");
  const ratio = (k: string) => {
    const known = completed.filter((r) =>
      ["예", "아니오"].includes(r.fields[k]),
    );
    return {
      yes: known.filter((r) => r.fields[k] === "예").length,
      total: known.length,
      unknown: completed.length - known.length,
    };
  };
  return {
    completed: completed.length,
    excluded: records.length - completed.length,
    mention: ratio("mention"),
    citation: ratio("citation"),
  };
}
export function validateResearch(
  r: Research,
  contents: Content[],
  candidates: { id: string; mode: string }[],
) {
  const refs = new Map(contents.map((c) => [c.id, c.mode])),
    parents = new Map(candidates.map((c) => [c.id, c.mode]));
  for (const [key, rows] of Object.entries(r)) {
    if (!Array.isArray(rows))
      throw Error("확장 기록 배열이 누락되었습니다: " + key);
    const ids = new Set<string>();
    for (const row of rows) {
      if (
        !row ||
        typeof row.id !== "string" ||
        !row.id ||
        ids.has(row.id) ||
        !["demo", "user"].includes(row.mode)
      )
        throw Error("확장 기록 식별자가 잘못되었습니다.");
      ids.add(row.id);
      const parent =
        "contentId" in row
          ? refs.get(row.contentId)
          : parents.get(row.candidateId);
      if (parent !== row.mode)
        throw Error("확장 기록의 연결·모드가 잘못되었습니다.");
      if (key === "observations") {
        const o = row as Observation;
        if (
          !(
            o.observedAt === null ||
            (typeof o.observedAt === "string" && zonedTime(o.observedAt))
          ) ||
          typeof o.originalObserved !== "string" ||
          !["수동", "공식 API", "외부 제공업체", "시연"].includes(o.method) ||
          typeof o.source !== "string" ||
          !o.metrics
        )
          throw Error("관측 시각·수집 방식이 잘못되었습니다.");
        if (o.mode === "demo" && o.method !== "시연")
          throw Error("시연 관측의 수집 방식이 잘못되었습니다.");
        for (const k of metricKeys) {
          const m = o.metrics[k];
          if (
            !m ||
            !metricStatuses.includes(m.status) ||
            typeof m.originalName !== "string" ||
            typeof m.definition !== "string" ||
            (m.status === "확인됨"
              ? typeof m.value !== "number" ||
                !Number.isFinite(m.value) ||
                m.value < 0
              : m.value !== null)
          )
            throw Error("지표 상태와 값이 일치하지 않습니다.");
        }
      } else {
        const f = (row as CommentEvidence).fields;
        if (
          !f ||
          typeof f !== "object" ||
          Array.isArray(f) ||
          !Object.values(f).every((v) => typeof v === "string")
        )
          throw Error("확장 기록 필드가 잘못되었습니다.");
        if (
          key === "commentEvidence" &&
          (!Array.isArray((row as CommentEvidence).categories) ||
            !(row as CommentEvidence).categories.length ||
            !(row as CommentEvidence).categories.every((c: string) =>
              commentCategories.includes(c),
            ))
        )
          throw Error("댓글 분류가 잘못되었습니다.");
        if (key === "siteReviews") {
          const checks = (row as SiteReview).checks;
          if (
            !checks ||
            checkItems.some(
              (k) =>
                !checks[k] ||
                !checkStatuses.includes(checks[k].status) ||
                typeof checks[k].evidence !== "string",
            )
          )
            throw Error("페이지 점검 형식이 잘못되었습니다.");
        }
        if (
          key === "aiRecords" &&
          (!["완료", "실패", "미실행"].includes(f.execution) ||
            !f.question ||
            !zonedTime(f.executedAt))
        )
          throw Error("AI 관측 형식이 잘못되었습니다.");
      }
    }
  }
}
export function researchCsv(research: Research, contents: Content[]) {
  const quote = (x: unknown) =>
    '"' +
    String(x ?? "")
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const rows: unknown[][] = [
    [
      "mode",
      "contentId",
      "platform",
      "observedAt",
      "originalObserved",
      "method",
      "source",
      "metric",
      "value",
      "status",
      "originalName",
      "definition",
    ],
  ];
  for (const o of research.observations)
    for (const k of metricKeys) {
      const m = o.metrics[k];
      rows.push([
        o.mode,
        o.contentId,
        contents.find((c) => c.id === o.contentId)?.fields.platform,
        o.observedAt,
        o.originalObserved,
        o.method,
        o.source,
        k,
        m.value,
        m.status,
        m.originalName,
        m.definition,
      ]);
    }
  return "\uFEFF" + rows.map((r) => r.map(quote).join(",")).join("\r\n");
}

export function retainResearch(
  r: Research,
  candidateIds: Set<string>,
  contentIds: Set<string>,
): Research {
  return {
    observations: r.observations.filter((o) => contentIds.has(o.contentId)),
    commentEvidence: r.commentEvidence.filter((o) =>
      contentIds.has(o.contentId),
    ),
    siteReviews: r.siteReviews.filter((o) => candidateIds.has(o.candidateId)),
    aiRecords: r.aiRecords.filter((o) => candidateIds.has(o.candidateId)),
  };
}
