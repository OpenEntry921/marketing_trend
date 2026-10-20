import { describe, it, expect, vi } from "vitest";
import { mapYoutube, requestYoutube } from "./youtube";
describe("server YouTube adapter (mocked network, not live API)", () => {
  it("preserves zero and partial field failures without inventing missing likes", () => {
    const data = mapYoutube(
      { id: "abcdefghijk", statistics: { viewCount: "0", commentCount: "3" } },
      "2026-01-01T00:00:00Z",
    );
    expect(data.observation.metrics.views).toMatchObject({
      value: 0,
      status: "확인됨",
      originalName: "statistics.viewCount",
    });
    expect(data.observation.metrics.likes).toMatchObject({
      value: null,
      status: "미확인",
    });
    expect(data.observation.metrics.shares.status).toBe("지원 안 됨");
  });
  it("places the credential only in the server request header", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [
              {
                id: "abcdefghijk",
                statistics: {
                  viewCount: "20",
                  likeCount: "2",
                  commentCount: "1",
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const data = await requestYoutube(
      "abcdefghijk",
      "unit-test-placeholder",
      fetcher,
    );
    expect(String(fetcher.mock.calls[0][0])).not.toContain(
      "unit-test-placeholder",
    );
    expect(fetcher.mock.calls[0][1].headers["X-Goog-Api-Key"]).toBe(
      "unit-test-placeholder",
    );
    expect(data.observation.method).toBe("공식 API");
    expect(JSON.stringify(data)).not.toContain("unit-test-placeholder");
  });
  it("requires server configuration and valid ID before accessing the network", async () => {
    const f = vi.fn();
    await expect(requestYoutube("bad", "key", f)).rejects.toThrow("11자리");
    await expect(requestYoutube("abcdefghijk", "", f)).rejects.toThrow(
      "설정되지",
    );
    expect(f).not.toHaveBeenCalled();
  });
  it("reports permission and inaccessible-content failures rather than zeros", async () => {
    await expect(
      requestYoutube(
        "abcdefghijk",
        "test",
        vi.fn().mockResolvedValue(new Response("{}", { status: 403 })),
      ),
    ).rejects.toThrow("403");
    await expect(
      requestYoutube(
        "abcdefghijk",
        "test",
        vi
          .fn()
          .mockResolvedValue(new Response('{"items":[]}', { status: 200 })),
      ),
    ).rejects.toThrow("찾지 못했습니다");
  });
});
