import { uid, validateBackup, type State } from "./domain.ts";
import type { Observation } from "./research.ts";
export function instagramUsername(input: string) {
  let value = input.trim();
  if (/^https?:\/\//i.test(value)) {
    let u: URL;
    try {
      u = new URL(value);
    } catch {
      throw Error("Instagram 계정명 또는 프로필 URL을 입력하세요.");
    }
    if (
      !["instagram.com", "www.instagram.com"].includes(u.hostname) ||
      u.username ||
      u.password ||
      u.port ||
      u.pathname.split("/").filter(Boolean).length !== 1
    )
      throw Error("Instagram 프로필 URL만 지원합니다.");
    value = u.pathname.split("/").filter(Boolean)[0] ?? "";
  }
  value = value.replace(/^@/, "");
  if (
    !/^[a-zA-Z0-9._]{1,30}$/.test(value) ||
    ["p", "reel", "reels", "stories", "explore", "accounts"].includes(
      value.toLowerCase(),
    )
  )
    throw Error("올바른 Instagram 계정명을 입력하세요.");
  return value.toLowerCase();
}
export function instagramLimit(input: unknown) {
  const n = Number(input);
  if (!Number.isInteger(n) || n < 1 || n > 20)
    throw Error("게시물 수는 1~20개의 정수로 입력하세요.");
  return n;
}
export type InstagramPost = {
  id: string;
  caption: string | null;
  mediaType: string;
  permalink: string | null;
  publishedAt: string | null;
  thumbnail: string | null;
  thumbnailReason: string;
  collectedAt: string;
  observation: Omit<Observation, "id" | "contentId" | "mode">;
};
export type InstagramResult = {
  label: "실제 API 데이터";
  profile: {
    username: string;
    followersCount: number | null;
    mediaCount: number | null;
  };
  posts: InstagramPost[];
  collectedAt: string;
  warnings: string[];
};
export function saveInstagramPost(
  state: State,
  result: InstagramResult,
  post: InstagramPost,
  targetId?: string,
): State {
  if (
    result.label !== "실제 API 데이터" ||
    !/^\d+$/.test(post.id) ||
    post.observation.method !== "공식 API"
  )
    throw Error("Instagram API 결과 형식이 잘못되었습니다.");
  const existing = state.contents.find(
    (c) =>
      c.mode === "user" &&
      c.fields.platform === "인스타그램" &&
      c.fields.platformId === post.id,
  );
  if (
    existing &&
    state.observations.some(
      (o) =>
        o.contentId === existing.id &&
        o.method === "공식 API" &&
        o.observedAt === post.observation.observedAt,
    )
  )
    return state;
  const next = structuredClone(state);
  let candidateId = existing?.candidateId ?? targetId;
  if (
    candidateId &&
    !next.candidates.some((c) => c.id === candidateId && c.mode === "user")
  )
    throw Error("사용자 후보를 선택하세요.");
  if (!candidateId) {
    candidateId = uid();
    next.candidates.push({
      id: candidateId,
      mode: "user",
      fields: {
        name: "제품 미분류 콘텐츠",
        status: "발견",
        repeat: "미확인",
        evidence: "미확인",
        notes: `Instagram @${result.profile.username}의 게시물. 제품·브랜드·작성자 유형은 확인하지 않았습니다.`,
      },
    });
  }
  const fields = {
    ...existing?.fields,
    platform: "인스타그램",
    platformId: post.id,
    title:
      existing?.fields.title ??
      (post.caption?.slice(0, 80) || `Instagram 게시물 ${post.id}`),
    caption: post.caption ?? existing?.fields.caption ?? "",
    format:
      existing?.fields.format ??
      (post.mediaType === "IMAGE" ? "이미지" : "미확인"),
    mediaType: post.mediaType,
    url: post.permalink ?? existing?.fields.url ?? "",
    published:
      post.publishedAt?.slice(0, 10) ?? existing?.fields.published ?? "",
    author: result.profile.username,
    authorType: existing?.fields.authorType ?? "미확인",
    sponsorship: existing?.fields.sponsorship ?? "미확인",
    source: "실제 API 데이터",
    thumbnail: post.thumbnail ?? "",
  };
  const content = {
    id: existing?.id ?? uid(),
    candidateId,
    mode: "user" as const,
    fields,
  };
  if (existing)
    next.contents = next.contents.map((c) =>
      c.id === existing.id ? content : c,
    );
  else next.contents.push(content);
  next.observations.push({
    ...post.observation,
    id: uid(),
    contentId: content.id,
    mode: "user",
  });
  return validateBackup(next);
}
