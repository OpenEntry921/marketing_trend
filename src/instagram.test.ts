import { describe, it, expect } from "vitest";
import { initialState } from "./domain";
import {
  instagramLimit,
  instagramUsername,
  saveInstagramPost,
  type InstagramResult,
} from "./instagram";
import { emptyMetrics } from "./research";
const fixture = (): InstagramResult => {
  const metrics = emptyMetrics();
  metrics.likes = { ...metrics.likes, value: 0, status: "확인됨" };
  metrics.views = { ...metrics.views, reason: "외부 계정 조회수 미검증" };
  return {
    label: "실제 API 데이터",
    profile: { username: "bluebottle", followersCount: 12, mediaCount: 1 },
    collectedAt: "2026-10-20T10:00:00Z",
    warnings: [],
    posts: [
      {
        id: "111",
        caption: null,
        mediaType: "IMAGE",
        permalink: "https://www.instagram.com/p/mock/",
        publishedAt: "2026-10-19T00:00:00Z",
        thumbnail: null,
        thumbnailReason: "미확보",
        collectedAt: "2026-10-20T10:00:00Z",
        observation: {
          observedAt: "2026-10-20T10:00:00Z",
          originalObserved: "",
          method: "공식 API",
          source: "https://www.instagram.com/p/mock/",
          metrics,
        },
      },
    ],
  };
};
describe("Instagram import persistence", () => {
  it("normalizes only usernames and actual profile URLs and caps the request size", () => {
    for (const name of [
      "bluebottle",
      "@BlueBottle",
      "https://www.instagram.com/BlueBottle/?hl=ko",
    ])
      expect(instagramUsername(name)).toBe("bluebottle");
    for (const name of [
      "https://instagram.com.evil.com/name",
      "https://instagram.com/p/post",
      "name){media}",
      "",
    ])
      expect(() => instagramUsername(name)).toThrow();
    expect(instagramLimit("5")).toBe(5);
    for (const count of [0, 21, 1.5, "x"])
      expect(() => instagramLimit(count)).toThrow();
  });
  it("creates an unclassified user candidate without inferring a product or author type", () => {
    const s = initialState(),
      data = fixture();
    const next = saveInstagramPost(s, data, data.posts[0]);
    expect(next.candidates.at(-1)).toMatchObject({
      mode: "user",
      fields: { name: "제품 미분류 콘텐츠" },
    });
    expect(next.contents.at(-1)).toMatchObject({
      mode: "user",
      fields: {
        platform: "인스타그램",
        platformId: "111",
        authorType: "미확인",
        sponsorship: "미확인",
        source: "실제 API 데이터",
      },
    });
    expect(next.observations.at(-1)?.metrics.likes.value).toBe(0);
    expect(s.contents).toHaveLength(12);
  });
  it("adds snapshots on recapture, avoids content duplication and preserves user edits", () => {
    const data = fixture();
    const first = saveInstagramPost(initialState(), data, data.posts[0]);
    first.contents.at(-1)!.fields.title = "사용자 제품 제목";
    const second = structuredClone(data);
    second.posts[0].observation.observedAt = "2026-10-21T10:00:00Z";
    second.posts[0].observation.metrics.likes.value = 4;
    const next = saveInstagramPost(first, second, second.posts[0]);
    expect(next.contents).toHaveLength(13);
    expect(next.candidates).toHaveLength(13);
    expect(next.contents.at(-1)?.fields.title).toBe("사용자 제품 제목");
    expect(next.observations).toHaveLength(26);
    expect(next.observations.at(-2)?.metrics.likes.value).toBe(0);
    expect(next.observations.at(-1)?.metrics.likes.value).toBe(4);
    expect(saveInstagramPost(next, second, second.posts[0])).toEqual(next);
  });
  it("can attach a new post to a user candidate while preserving demo data", () => {
    const s = initialState();
    s.candidates.push({
      id: "user",
      mode: "user",
      fields: { name: "사용자 후보" },
    });
    const data = fixture(),
      next = saveInstagramPost(s, data, data.posts[0], "user");
    expect(next.contents.at(-1)?.candidateId).toBe("user");
    expect(() => saveInstagramPost(s, data, data.posts[0], "demo-0")).toThrow();
    expect(next.candidates.filter((c) => c.mode === "demo")).toEqual(
      s.candidates.filter((c) => c.mode === "demo"),
    );
  });
});
