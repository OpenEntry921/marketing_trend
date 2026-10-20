import { afterEach, describe, it, expect, vi } from "vitest";
import { createServer } from "node:http";
import {
  AUTH_MESSAGE,
  classifyInstagramError,
  instagramMiddleware,
  requestInstagram,
} from "./instagram";
const config = {
  token: "unit-only-token-do-not-leak",
  userId: "17841403677011668",
  version: "v26.0",
};
const item = {
  id: "111",
  caption: "실제 응답을 모의한 테스트 게시물",
  media_type: "IMAGE",
  permalink: "https://www.instagram.com/p/mock/",
  timestamp: "2026-10-20T01:00:00+0000",
  like_count: 0,
  comments_count: 3,
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
function externalFetcher() {
  return vi.fn(async (url: URL | RequestInfo, options?: RequestInit) => {
    const u = new URL(String(url)),
      fields = u.searchParams.get("fields") ?? "";
    expect(u.hostname).toBe("graph.facebook.com");
    expect(u.toString()).not.toContain(config.token);
    expect((options?.headers as Record<string, string>).Authorization).toBe(
      "Bearer " + config.token,
    );
    if (fields.includes("like_count"))
      return json({
        business_discovery: {
          username: "bluebottle",
          followers_count: 12,
          media_count: 2,
          media: {
            data: [
              item,
              {
                ...item,
                id: "222",
                media_type: "VIDEO",
                caption: undefined,
                like_count: undefined,
              },
            ],
            paging: {
              next: "https://graph.facebook.com/?access_token=" + config.token,
            },
          },
        },
        access_token: config.token,
      });
    if (fields.includes("children"))
      return json(
        {
          error: {
            code: 100,
            message: "unsupported optional field " + config.token,
          },
        },
        400,
      );
    return json({
      business_discovery: {
        media: {
          data: [
            {
              id: "111",
              media_url: "https://scontent.example.cdninstagram.com/image.jpg",
            },
            {
              id: "222",
              thumbnail_url: "https://scontent.example.fbcdn.net/thumbnail.jpg",
            },
          ],
        },
      },
    });
  });
}
afterEach(() => vi.unstubAllEnvs());
describe("Instagram adapter — mocked API, not a live integration test", () => {
  it("uses only fixed business discovery fields, preserves zeros, and never queries external insights", async () => {
    const f = externalFetcher();
    const result = await requestInstagram("@BlueBottle", 5, config, f);
    expect(result.label).toBe("실제 API 데이터");
    expect(result.profile.username).toBe("bluebottle");
    expect(result.posts).toHaveLength(2);
    expect(result.posts[0].observation.metrics.likes.value).toBe(0);
    expect(result.posts[1].observation.metrics.likes.value).toBeNull();
    expect(result.posts[0].observation.metrics.views).toMatchObject({
      value: null,
      status: "미확인",
      reason: expect.stringContaining("외부 계정"),
    });
    expect(result.posts[0].thumbnail).toMatch(
      /^\/api\/instagram\/thumbnail\?id=/,
    );
    expect(result.posts[1].caption).toBeNull();
    expect(result.warnings).toHaveLength(1);
    for (const [url] of f.mock.calls) {
      expect(String(url)).not.toContain("/insights");
      expect(String(url)).not.toContain("/me/accounts");
    }
    const text = JSON.stringify(result);
    expect(text).not.toContain(config.token);
    expect(text).not.toContain("paging");
    expect(text).not.toContain("access_token");
    expect(text).not.toContain("scontent.example");
    expect(text).not.toContain("thumbnail.jpg");
  });
  it("retains basic results when every thumbnail field is unsupported", async () => {
    const f = vi.fn(async (url: URL | RequestInfo) => {
      const fields = new URL(String(url)).searchParams.get("fields") ?? "";
      return fields.includes("like_count")
        ? json({
            business_discovery: {
              username: "bluebottle",
              media: { data: [item] },
            },
          })
        : json({ error: { code: 100 } }, 400);
    });
    const result = await requestInstagram("bluebottle", 5, config, f);
    expect(result.posts[0].thumbnail).toBeNull();
    expect(result.posts[0].observation.metrics.comments.value).toBe(3);
    expect(result.warnings).toHaveLength(3);
  });
  it("queries own media directly and keeps insights zero, pre-conversion, and denied separate", async () => {
    const f = vi.fn(async (url: URL | RequestInfo) => {
      const u = new URL(String(url));
      if (u.pathname.endsWith("/111/insights"))
        return json({ data: [{ name: "views", values: [{ value: 0 }] }] });
      if (u.pathname.endsWith("/222/insights"))
        return json(
          {
            error: {
              code: 100,
              message: "Media posted before business conversion",
            },
          },
          400,
        );
      if (u.pathname.endsWith("/333/insights"))
        return json({ error: { code: 200, message: config.token } }, 403);
      if (u.pathname.endsWith("/" + config.userId))
        return json({
          username: "ted2416",
          followers_count: 8,
          media_count: 3,
        });
      return json({
        data: [item, { ...item, id: "222" }, { ...item, id: "333" }],
      });
    });
    const r = await requestInstagram("ted2416", 5, config, f);
    expect(r.posts[0].observation.metrics.views).toMatchObject({
      value: 0,
      status: "확인됨",
    });
    expect(r.posts[1].observation.metrics.views).toMatchObject({
      value: null,
      status: "지원 안 됨",
      reason: "조회 불가 — 비즈니스 전환 전 게시물",
    });
    expect(r.posts[2].observation.metrics.views).toMatchObject({
      value: null,
      status: "미확인",
    });
    expect(r.posts.every((p) => p.observation.metrics.likes.value === 0)).toBe(
      true,
    );
    expect(r.profile.followersCount).toBe(8);
    expect(String(f.mock.calls[0][0])).toContain(
      "/" + config.userId + "/media?",
    );
    expect(JSON.stringify(r)).not.toContain(config.token);
  });
  it("does not turn permissions or authentication errors into empty results", async () => {
    for (const [code, kind] of [
      [190, "auth"],
      [200, "permission"],
      [4, "rate_limit"],
      [100, "account"],
      [999, "unknown"],
    ] as const) {
      const f = vi
        .fn()
        .mockResolvedValue(
          json({ error: { code, message: config.token } }, 400),
        );
      await expect(
        requestInstagram("bluebottle", 5, config, f),
      ).rejects.toMatchObject({ kind });
    }
    expect(classifyInstagramError({ error: { code: 190 } }, 400).message).toBe(
      AUTH_MESSAGE,
    );
    expect(classifyInstagramError({}, 503).kind).toBe("temporary");
  });
  it("rejects input/configuration before any upstream request", async () => {
    const f = vi.fn();
    for (const name of [
      "bluebottle){id}",
      "https://evil.com/name",
      "https://instagram.com/p/abc",
      "abc/def",
    ])
      await expect(requestInstagram(name, 5, config, f)).rejects.toMatchObject({
        kind: "input",
      });
    await expect(
      requestInstagram("bluebottle", 21, config, f),
    ).rejects.toMatchObject({ kind: "input" });
    await expect(
      requestInstagram("bluebottle", 5, { ...config, token: "" }, f),
    ).rejects.toMatchObject({ kind: "configuration" });
    expect(f).not.toHaveBeenCalled();
  });
  it("redacts token-bearing text and URLs and excludes unapproved image hosts", async () => {
    const f = vi.fn(async (url: URL | RequestInfo) => {
      const fields = new URL(String(url)).searchParams.get("fields") ?? "";
      return json({
        business_discovery: {
          username: "bluebottle",
          media: {
            data: [
              {
                ...item,
                caption: config.token,
                permalink:
                  "https://www.instagram.com/p/mock/?access_token=" +
                  config.token,
                media_url: "http://127.0.0.1/private",
                thumbnail_url: "https://evil.com/image",
              },
            ],
          },
        },
      });
    });
    const r = await requestInstagram("bluebottle", 5, config, f);
    expect(r.posts[0].caption).toBe("[비공개]");
    expect(r.posts[0].permalink).toBeNull();
    expect(r.posts[0].thumbnail).toBeNull();
    expect(JSON.stringify(r)).not.toContain(config.token);
  });
  it("serves safe status, denies cross-site and arbitrary fields, and enforces a local request limit", async () => {
    vi.stubEnv("INSTAGRAM_ACCESS_TOKEN", "");
    const server = createServer((req, res) =>
      instagramMiddleware(req, res, () => {
        res.statusCode = 404;
        res.end();
      }),
    );
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const port = (server.address() as { port: number }).port;
    const base = `http://127.0.0.1:${port}/api/instagram`;
    try {
      const state = await (await fetch(base + "/status")).json();
      expect(state).toMatchObject({
        configured: false,
        connected: false,
        hashtag: "Meta 승인 대기",
      });
      expect(
        (await fetch(base + "/account?username=bluebottle&fields=anything"))
          .status,
      ).toBe(400);
      expect(
        (
          await fetch(base + "/status", {
            headers: { Origin: "https://evil.com" },
          })
        ).status,
      ).toBe(403);
      expect((await fetch(base + "/account?username=bluebottle")).status).toBe(
        503,
      );
      let final = 0;
      for (let i = 0; i < 11; i++)
        final = (await fetch(base + "/account?username=bluebottle")).status;
      expect(final).toBe(429);
      expect((await fetch(base + "/thumbnail?id=missing")).status).toBe(404);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
