import type { IncomingMessage, ServerResponse } from "node:http";
import type { Observation } from "../src/research.ts";
import { emptyMetrics } from "../src/research.ts";
export function mapYoutube(
  item: {
    id: string;
    snippet?: { title?: string; publishedAt?: string };
    statistics?: Record<string, string>;
  },
  observedAt: string,
) {
  const metrics = emptyMetrics();
  for (const [key, apiName] of [
    ["views", "viewCount"],
    ["likes", "likeCount"],
    ["comments", "commentCount"],
  ] as const) {
    const raw = item.statistics?.[apiName];
    const value = raw === undefined ? null : Number(raw);
    metrics[key] = {
      value:
        value !== null && Number.isSafeInteger(value) && value >= 0
          ? value
          : null,
      status:
        value !== null && Number.isSafeInteger(value) && value >= 0
          ? "확인됨"
          : "미확인",
      originalName: `statistics.${apiName}`,
      definition: `YouTube Data API v3 ${apiName}; 콘텐츠 형식별 집계 정의 확인 필요`,
    };
  }
  for (const k of ["shares", "saves"] as const)
    metrics[k] = {
      value: null,
      status: "지원 안 됨",
      originalName: k,
      definition: "videos.list 공개 statistics에서 제공하지 않음",
    };
  return {
    platformId: item.id,
    title: item.snippet?.title ?? "",
    published: item.snippet?.publishedAt ?? "",
    observation: {
      observedAt,
      originalObserved: "",
      method: "공식 API",
      source: `https://www.youtube.com/watch?v=${item.id}`,
      metrics,
    } satisfies Omit<Observation, "id" | "contentId" | "mode">,
  };
}
export async function requestYoutube(
  id: string,
  key: string,
  fetcher: typeof fetch = fetch,
) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(id))
    throw Error("올바른 11자리 YouTube 콘텐츠 ID가 필요합니다.");
  if (!key) throw Error("서버에 YOUTUBE_API_KEY가 설정되지 않았습니다.");
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet,statistics");
  url.searchParams.set("id", id);
  const response = await fetcher(url, {
    headers: { "X-Goog-Api-Key": key },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw Error(
      `YouTube API 응답 오류 (${response.status}). 키의 API 활성화·권한·할당량·네트워크 설정을 확인하세요.`,
    );
  const data = (await response.json()) as {
    items?: Parameters<typeof mapYoutube>[0][];
  };
  if (!data.items?.length)
    throw Error("콘텐츠를 찾지 못했습니다. 삭제·비공개·ID를 확인하세요.");
  if (data.items[0].id !== id)
    throw Error("응답 콘텐츠 ID가 요청과 일치하지 않습니다.");
  return mapYoutube(data.items[0], new Date().toISOString());
}
export function youtubeMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (!url.pathname.startsWith("/api/youtube/")) {
    next();
    return;
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const reply = (status: number, body: unknown) => {
    res.statusCode = status;
    res.end(JSON.stringify(body));
  };
  if (
    req.headers.origin &&
    req.headers.origin !== `http://${req.headers.host}`
  ) {
    reply(403, { error: "동일 출처 요청만 허용합니다." });
    return;
  }
  if (req.method !== "GET") {
    reply(405, { error: "GET만 지원합니다." });
    return;
  }
  if (url.pathname === "/api/youtube/status") {
    reply(200, {
      configured: !!process.env.YOUTUBE_API_KEY,
      mode: "server",
      connected: false,
    });
    return;
  }
  if (url.pathname !== "/api/youtube/video") {
    reply(404, { error: "없는 경로입니다." });
    return;
  }
  void requestYoutube(
    url.searchParams.get("id") ?? "",
    process.env.YOUTUBE_API_KEY ?? "",
  )
    .then((data) => reply(200, data))
    .catch((e) =>
      reply(502, { error: e instanceof Error ? e.message : "조회 실패" }),
    );
}
