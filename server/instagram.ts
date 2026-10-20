import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import {
  instagramLimit,
  instagramUsername,
  type InstagramPost,
  type InstagramResult,
} from "../src/instagram.ts";
import { emptyMetrics, type Metric } from "../src/research.ts";
export const AUTH_MESSAGE =
  "Instagram 인증 만료 또는 해제 — 관리자 토큰 교체 필요";
type ErrorKind =
  | "configuration"
  | "input"
  | "auth"
  | "permission"
  | "rate_limit"
  | "account"
  | "temporary"
  | "unknown"
  | "pre_conversion";
export class InstagramError extends Error {
  constructor(
    public kind: ErrorKind,
    message: string,
    public httpStatus = 502,
    public graphCode?: number,
  ) {
    super(message);
  }
}
export function classifyInstagramError(
  body: unknown,
  httpStatus: number,
): InstagramError {
  const e = (
    body as {
      error?: { code?: number; message?: string; is_transient?: boolean };
    }
  )?.error;
  const message = typeof e?.message === "string" ? e.message : "";
  const code = e?.code;
  if (code === 190) return new InstagramError("auth", AUTH_MESSAGE, 401, code);
  if (
    (/(posted|created|published) before/i.test(message) &&
      /(business|professional)/i.test(message)) ||
    message.includes("비즈니스 전환 전")
  )
    return new InstagramError(
      "pre_conversion",
      "조회 불가 — 비즈니스 전환 전 게시물",
      502,
      code,
    );
  if (httpStatus === 429 || [4, 17, 32, 613, 80004].includes(code ?? -1))
    return new InstagramError(
      "rate_limit",
      "Instagram 호출 제한 — 잠시 후 다시 시도하세요.",
      429,
      code,
    );
  if ([10, 200].includes(code ?? -1))
    return new InstagramError(
      "permission",
      "Instagram 권한 부족 — 해당 계정·기능의 허용 범위를 확인하세요.",
      403,
      code,
    );
  if (httpStatus >= 500 || e?.is_transient)
    return new InstagramError(
      "temporary",
      "Instagram 일시적 장애 — 성공한 데이터는 유지됩니다.",
      503,
      code,
    );
  if (code === 100)
    return new InstagramError(
      "account",
      "계정 또는 요청 항목 조회 불가 — 계정 유형·접근 가능 범위를 확인하세요. 원인은 확정할 수 없습니다.",
      422,
      code,
    );
  return new InstagramError(
    "unknown",
    "Instagram 조회 실패 — 원인을 확정할 수 없습니다.",
    502,
    code,
  );
}
export type InstagramConfig = {
  token: string;
  userId: string;
  version: string;
};
export function instagramConfig(): InstagramConfig {
  return {
    token: process.env.INSTAGRAM_ACCESS_TOKEN ?? "",
    userId: process.env.INSTAGRAM_USER_ID || "17841403677011668",
    version: process.env.META_GRAPH_API_VERSION || "v26.0",
  };
}
const safeNumber = (v: unknown) =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0
    ? v
    : typeof v === "string" &&
        /^\d+$/.test(v) &&
        Number.isSafeInteger(Number(v))
      ? Number(v)
      : null;
const safeText = (v: unknown, token: string) =>
  typeof v === "string" ? v.split(token || "\0").join("[비공개]") : null;
function publicUrl(v: unknown, token: string, hosts?: string[]) {
  if (typeof v !== "string" || (v.includes(token) && !!token)) return null;
  try {
    const u = new URL(v);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.port ||
      [...u.searchParams.keys()].some((k) =>
        /token|secret|authorization/i.test(k),
      ) ||
      (hosts && !hosts.includes(u.hostname))
    )
      return null;
    return u.toString();
  } catch {
    return null;
  }
}
const baseFields =
  "id,caption,media_type,permalink,timestamp,like_count,comments_count";
type Json = Record<string, any>;
async function graph(
  path: string,
  fields: Record<string, string>,
  config: InstagramConfig,
  fetcher: typeof fetch,
): Promise<Json> {
  const u = new URL(`https://graph.facebook.com/${config.version}/${path}`);
  for (const [k, v] of Object.entries(fields)) u.searchParams.set(k, v);
  let r: Response;
  try {
    r = await fetcher(u, {
      headers: { Authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
  } catch {
    throw new InstagramError(
      "temporary",
      "Instagram 서버에 연결할 수 없습니다 — 네트워크 또는 일시적 장애를 확인하세요.",
      503,
    );
  }
  let body: Json;
  try {
    body = await r.json();
  } catch {
    throw new InstagramError(
      "temporary",
      "Instagram 응답을 읽을 수 없습니다. 잠시 후 다시 시도하세요.",
      503,
    );
  }
  if (!r.ok || body.error) throw classifyInstagramError(body, r.status);
  return body;
}
type Thumbnail = { url: string; expires: number };
const thumbnails = new Map<string, Thumbnail>();
function approvedImageUrl(raw: unknown, token: string) {
  const value = publicUrl(raw, token);
  if (!value) return null;
  const host = new URL(value).hostname;
  return /(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(host) ? value : null;
}
function thumbnailPath(url: string) {
  const stamp = Date.now();
  for (const [id, item] of thumbnails)
    if (item.expires < stamp) thumbnails.delete(id);
  while (thumbnails.size >= 200)
    thumbnails.delete(thumbnails.keys().next().value!);
  const id = randomUUID();
  thumbnails.set(id, { url, expires: stamp + 15 * 60 * 1000 });
  return "/api/instagram/thumbnail?id=" + id;
}
export async function requestInstagram(
  input: string,
  limitInput: unknown,
  config: InstagramConfig,
  fetcher: typeof fetch = fetch,
): Promise<InstagramResult> {
  let username: string, limit: number;
  try {
    username = instagramUsername(input);
    limit = instagramLimit(limitInput);
  } catch (e) {
    throw new InstagramError("input", (e as Error).message, 400);
  }
  if (!config.token)
    throw new InstagramError(
      "configuration",
      "Instagram 서버 토큰 미설정 — 운영자가 서버의 INSTAGRAM_ACCESS_TOKEN을 설정하세요.",
      503,
    );
  if (!/^\d+$/.test(config.userId) || !/^v\d+\.\d+$/.test(config.version))
    throw new InstagramError(
      "configuration",
      "서버 Instagram 계정 ID·Graph API 버전 설정을 확인하세요.",
      503,
    );
  const own = username === "ted2416";
  const root = own ? `${config.userId}/media` : config.userId;
  const query = (fields: string): Record<string, string> =>
    own
      ? { fields, limit: String(limit) }
      : {
          fields: `business_discovery.username(${username}){username,followers_count,media_count,media.limit(${limit}){${fields}}}`,
        };
  const payload = await graph(root, query(baseFields), config, fetcher);
  const fetchedAt = new Date().toISOString();
  let profile = own
    ? {
        username: "ted2416",
        followers_count: undefined,
        media_count: undefined,
      }
    : payload.business_discovery;
  if (!profile || (!own && !profile.username))
    throw new InstagramError(
      "account",
      "계정 조회 불가 — API가 지원하는 공개 전문 계정인지 확인하세요.",
      422,
    );
  const raw = own ? payload.data : profile.media?.data;
  if (!Array.isArray(raw))
    throw new InstagramError(
      "account",
      "계정의 게시물 응답이 제공되지 않았습니다. 결과 없음으로 단정하지 않습니다.",
      422,
    );
  const items = raw
    .slice(0, limit)
    .filter((p: Json) => /^\d+$/.test(String(p.id)));
  const warnings: string[] = [];
  if (own) {
    try {
      profile = {
        ...profile,
        ...(await graph(
          config.userId,
          { fields: "username,followers_count,media_count" },
          config,
          fetcher,
        )),
      };
    } catch {
      warnings.push(
        "연결 계정 프로필 일부 조회 실패 — 게시물 결과는 유지합니다.",
      );
    }
  }
  const extras = new Map<string, Json>();
  for (const fields of [
    "id,media_url",
    "id,thumbnail_url",
    "id,children{media_type,media_url}",
  ]) {
    try {
      const extra = await graph(root, query(fields), config, fetcher);
      const rows = own ? extra.data : extra.business_discovery?.media?.data;
      if (Array.isArray(rows))
        for (const p of rows)
          extras.set(String(p.id), { ...extras.get(String(p.id)), ...p });
    } catch (e) {
      const safe =
        e instanceof InstagramError
          ? e
          : new InstagramError("unknown", "선택 필드 조회 실패");
      warnings.push(
        `선택 썸네일 필드 조회 실패 (${safe.kind}) — ${safe.message} 기본 게시물·좋아요·댓글은 유지합니다.`,
      );
    }
  }
  const posts: InstagramPost[] = [];
  for (let start = 0; start < items.length; start += 3) {
    posts.push(
      ...(await Promise.all(
        items
          .slice(start, start + 3)
          .map(async (p: Json): Promise<InstagramPost> => {
            const id = String(p.id),
              metrics = emptyMetrics();
            for (const [key, name] of [
              ["likes", "like_count"],
              ["comments", "comments_count"],
            ] as const) {
              const value = safeNumber(p[name]);
              metrics[key] = {
                value,
                status: value === null ? "미확인" : "확인됨",
                originalName: name,
                definition: `Instagram Graph API ${config.version} ${name}`,
              };
            }
            const followers = safeNumber(profile.followers_count);
            metrics.followers = {
              value: followers,
              status: followers === null ? "미확인" : "확인됨",
              originalName: "followers_count",
              definition: "같은 가져오기 배치에서 제공된 계정 팔로워 수",
            };
            metrics.views = {
              value: null,
              status: "미확인",
              originalName: "views",
              definition: "게시물 인사이트 조회수",
              reason: own
                ? "조회수 미확보"
                : "외부 계정 조회수 미검증 — 인사이트 권한을 가정하지 않습니다.",
            } as Metric;
            let collectedAt = fetchedAt;
            if (own) {
              try {
                const insight = await graph(
                  `${id}/insights`,
                  { metric: "views" },
                  config,
                  fetcher,
                );
                const row = Array.isArray(insight.data)
                  ? insight.data.find((m: Json) => m.name === "views")
                  : undefined;
                const value = safeNumber(
                  row?.values?.[0]?.value ?? row?.total_value?.value,
                );
                metrics.views = {
                  value,
                  status: value === null ? "미확인" : "확인됨",
                  originalName: "views",
                  definition: `Instagram Graph API ${config.version} media insights views`,
                  reason:
                    value === null
                      ? "응답에 조회수가 제공되지 않았습니다."
                      : "",
                } as Metric;
              } catch (e) {
                const failure =
                  e instanceof InstagramError
                    ? e
                    : new InstagramError("unknown", "조회수 요청 실패");
                metrics.views = {
                  ...metrics.views,
                  status:
                    failure.kind === "pre_conversion"
                      ? "지원 안 됨"
                      : failure.kind === "permission"
                        ? "미확인"
                        : "오류",
                  reason: failure.message,
                } as Metric;
              }
              collectedAt = new Date().toISOString();
            }
            const extra = extras.get(id) ?? {};
            const mediaType = ["IMAGE", "VIDEO", "CAROUSEL_ALBUM"].includes(
              p.media_type,
            )
              ? p.media_type
              : "미확인";
            let image =
              mediaType === "VIDEO"
                ? approvedImageUrl(extra.thumbnail_url, config.token)
                : approvedImageUrl(extra.media_url, config.token);
            if (
              !image &&
              mediaType === "CAROUSEL_ALBUM" &&
              Array.isArray(extra.children?.data)
            ) {
              const child = extra.children.data.find(
                (c: Json) => c.media_type === "IMAGE",
              );
              image = approvedImageUrl(child?.media_url, config.token);
            }
            const permalink = publicUrl(p.permalink, config.token, [
              "www.instagram.com",
              "instagram.com",
            ]);
            return {
              id,
              caption: safeText(p.caption, config.token),
              mediaType,
              permalink,
              publishedAt: safeText(p.timestamp, config.token),
              thumbnail: image ? thumbnailPath(image) : null,
              thumbnailReason: image
                ? ""
                : "썸네일 미확보 또는 지원되지 않는 필드",
              collectedAt,
              observation: {
                observedAt: collectedAt,
                originalObserved: "",
                method: "공식 API",
                source: permalink ?? `Instagram Graph API 게시물 ID ${id}`,
                metrics,
              },
            };
          }),
      )),
    );
  }
  return {
    label: "실제 API 데이터",
    profile: {
      username: safeText(profile.username, config.token) ?? username,
      followersCount: safeNumber(profile.followers_count),
      mediaCount: safeNumber(profile.media_count),
    },
    posts,
    collectedAt: new Date().toISOString(),
    warnings,
  };
}
const rate = new Map<string, { since: number; count: number }>();
export function instagramMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  const u = new URL(req.url ?? "/", "http://127.0.0.1");
  if (!u.pathname.startsWith("/api/instagram/")) {
    next();
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const send = (status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
  };
  const address = req.socket.remoteAddress;
  if (
    !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address ?? "") ||
    req.headers["sec-fetch-site"] === "cross-site" ||
    !!req.headers["x-forwarded-for"] ||
    !!req.headers["forwarded"] ||
    !!req.headers["x-real-ip"] ||
    (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)
  ) {
    send(403, {
      kind: "permission",
      error: "가져오기 API는 동일 출처의 로컬 사용만 허용합니다.",
    });
    return;
  }
  if (req.method !== "GET") {
    send(405, { error: "GET만 지원합니다." });
    return;
  }
  if (u.pathname === "/api/instagram/status") {
    send(200, {
      configured: !!instagramConfig().token,
      connected: false,
      scope: "공개 전문 계정 조회; 외부 계정 조회수 미검증",
      hashtag: "Meta 승인 대기",
      tokenRenewal: "자동 갱신 미구현",
    });
    return;
  }
  if (u.pathname === "/api/instagram/thumbnail") {
    const item = thumbnails.get(u.searchParams.get("id") ?? "");
    if (!item || item.expires < Date.now()) {
      send(404, { error: "썸네일 만료 또는 미확보 — 다시 가져오세요." });
      return;
    }
    void (async () => {
      try {
        const r = await fetch(item.url, {
          signal: AbortSignal.timeout(10000),
          redirect: "error",
        });
        const type = r.headers.get("content-type")?.split(";")[0] ?? "";
        if (
          !r.ok ||
          !/^image\/(jpeg|png|webp|avif|gif)$/.test(type) ||
          Number(r.headers.get("content-length") ?? 0) > 5_000_000
        )
          throw Error();
        const reader = r.body?.getReader();
        if (!reader) throw Error();
        const chunks: Uint8Array[] = [];
        let length = 0;
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          length += part.value.byteLength;
          if (length > 5_000_000) {
            await reader.cancel();
            throw Error();
          }
          chunks.push(part.value);
        }
        res.setHeader("Content-Type", type);
        res.end(Buffer.concat(chunks));
      } catch {
        send(502, { error: "썸네일을 불러올 수 없습니다." });
      }
    })();
    return;
  }
  if (u.pathname !== "/api/instagram/account") {
    send(404, { error: "없는 경로입니다." });
    return;
  }
  if (
    [...u.searchParams.keys()].some((k) => !["username", "limit"].includes(k))
  ) {
    send(400, { error: "계정명과 게시물 수만 지정할 수 있습니다." });
    return;
  }
  const stamp = Date.now();
  for (const [key, v] of rate) if (stamp - v.since > 60000) rate.delete(key);
  const limit = rate.get(address!) ?? { since: stamp, count: 0 };
  if (++limit.count > 10) {
    send(429, {
      kind: "rate_limit",
      error: "로컬 가져오기 요청 제한 — 1분 뒤 다시 시도하세요.",
    });
    return;
  }
  rate.set(address!, limit);
  void requestInstagram(
    u.searchParams.get("username") ?? "",
    u.searchParams.get("limit") ?? "5",
    instagramConfig(),
  )
    .then((result) => send(200, result))
    .catch((e) => {
      const error =
        e instanceof InstagramError
          ? e
          : new InstagramError(
              "unknown",
              "Instagram 조회 실패 — 원인을 확정할 수 없습니다.",
            );
      send(error.httpStatus, { kind: error.kind, error: error.message });
    });
}
