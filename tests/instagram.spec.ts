import { test, expect } from "@playwright/test";
import { emptyMetrics } from "../src/research";
import type { InstagramResult } from "../src/instagram";
function response(username: string, run: number): InstagramResult {
  const own = username === "ted2416",
    at = `2026-10-20T10:00:0${run}Z`;
  return {
    label: "실제 API 데이터",
    profile: { username, followersCount: 120, mediaCount: 2 },
    collectedAt: at,
    warnings: ["선택 썸네일 필드 조회 실패 — 기본 결과 유지 (모의 응답)"],
    posts: [0, 1].map((i) => {
      const metrics = emptyMetrics();
      metrics.likes = {
        ...metrics.likes,
        value: i === 0 ? 0 : 10,
        status: "확인됨",
      };
      metrics.comments = { ...metrics.comments, value: 2, status: "확인됨" };
      metrics.views = {
        ...metrics.views,
        value: own && i === 0 ? 0 : null,
        status: own ? (i === 0 ? "확인됨" : "지원 안 됨") : "미확인",
        reason: own
          ? i === 0
            ? ""
            : "조회 불가 — 비즈니스 전환 전 게시물"
          : "외부 계정 조회수 미검증 — 인사이트 권한을 가정하지 않습니다.",
      };
      return {
        id: String((own ? 300 : 100) + i),
        caption: i === 0 ? "모의 API 본문. 실제 통합 테스트가 아닙니다." : null,
        mediaType: i === 0 ? "IMAGE" : "VIDEO",
        permalink:
          i === 0 ? null : "https://www.instagram.com/p/mock" + i + "/",
        publishedAt: "2026-10-19T00:00:00Z",
        thumbnail: i === 0 ? "/api/instagram/thumbnail?id=fixture" : null,
        thumbnailReason: i ? "썸네일 미확보" : "",
        collectedAt: at,
        observation: {
          observedAt: at,
          originalObserved: "",
          method: "공식 API",
          source: "https://www.instagram.com/p/mock" + i + "/",
          metrics,
        },
      };
    }),
  };
}
test("mocked Instagram account results, snapshot reimport, own views and mobile storage", async ({
  page,
}) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/graph\.facebook|cdninstagram|fbcdn/.test(r.url()))
      external.push(r.url());
  });
  let run = 0;
  await page.route("**/api/instagram/status", (r) =>
    r.fulfill({
      json: { configured: true, connected: false, hashtag: "Meta 승인 대기" },
    }),
  );
  await page.route("**/api/instagram/account?*", (r) => {
    const u = new URL(r.request().url());
    expect(u.searchParams.get("username")).toMatch(/^(bluebottle|ted2416)$/);
    expect(u.searchParams.get("limit")).toBe("5");
    return r.fulfill({
      json: response(u.searchParams.get("username")!, ++run),
    });
  });
  await page.route("**/api/instagram/thumbnail?*", (r) =>
    r.fulfill({ status: 404, json: { error: "모의 이미지 미확보" } }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Instagram 계정으로 가져오기", exact: true })
    .click();
  await expect(page.getByText("Meta 승인 대기", { exact: true })).toBeVisible();
  await page
    .getByLabel("Instagram 계정명", { exact: true })
    .fill("https://www.instagram.com/BlueBottle/");
  await page
    .getByRole("button", { name: "게시물 가져오기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "@bluebottle", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("실제 API 데이터", { exact: true })).toHaveCount(
    3,
  );
  await expect(
    page.getByText(
      "외부 계정 조회수 미검증 — 인사이트 권한을 가정하지 않습니다.",
      { exact: true },
    ),
  ).toHaveCount(2);
  await expect(page.getByText("본문 미제공", { exact: true })).toBeVisible();
  await page.getByText("본문 보기", { exact: true }).click();
  await expect(
    page.getByText("모의 API 본문. 실제 통합 테스트가 아닙니다.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "후보 저장", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", {
      name: "저장됨 · 재수집 후 새 관측 저장",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "게시물 가져오기", exact: true })
    .click();
  await page
    .getByRole("button", { name: "기존 콘텐츠에 관측 추가", exact: true })
    .click();
  await page.getByRole("button", { name: "저장한 후보", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "제품 미분류 콘텐츠", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "제품 미분류 콘텐츠", exact: true })
    .click();
  await expect(
    page.getByText("관측 이력 (2) · 차트·원래 지표 정의", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "콘텐츠 편집", exact: true }).click();
  await page
    .getByLabel("콘텐츠 제목", { exact: true })
    .fill("사용자 편집 게시물");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "저장", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "사용자 편집 게시물", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "사용자 작업", exact: true }).click();
  await page.getByRole("button", { name: "저장한 후보", exact: true }).click();
  await page
    .getByRole("button", { name: "제품 미분류 콘텐츠", exact: true })
    .click();
  await expect(
    page.getByText("관측 이력 (2) · 차트·원래 지표 정의", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Instagram 계정으로 가져오기", exact: true })
    .click();
  await page.getByLabel("Instagram 계정명", { exact: true }).fill("@ted2416");
  await page
    .getByRole("button", { name: "게시물 가져오기", exact: true })
    .click();
  await expect(
    page.getByText("조회 불가 — 비즈니스 전환 전 게시물", { exact: true }),
  ).toBeVisible();
  const first = page.locator(".instagram-results article").first();
  await expect(
    first
      .locator(".instagram-metric")
      .filter({ hasText: "조회수" })
      .locator("dd"),
  ).toHaveText("0");
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("missing token and permissions display actionable errors without fictitious results", async ({
  page,
}) => {
  await page.route("**/api/instagram/status", (r) =>
    r.fulfill({ json: { configured: false } }),
  );
  let auth = false;
  await page.route("**/api/instagram/account?*", (r) =>
    r.fulfill({
      status: auth ? 401 : 503,
      json: {
        error: auth
          ? "Instagram 인증 만료 또는 해제 — 관리자 토큰 교체 필요"
          : "Instagram 서버 토큰 미설정 — 운영자가 서버의 INSTAGRAM_ACCESS_TOKEN을 설정하세요.",
      },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Instagram 계정으로 가져오기", exact: true })
    .click();
  await expect(
    page.getByText(
      "서버 토큰 미설정 — 운영자가 서버의 INSTAGRAM_ACCESS_TOKEN을 설정하세요.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "게시물 가져오기", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("서버 토큰 미설정");
  await expect(page.locator(".instagram-results article")).toHaveCount(0);
  auth = true;
  await page
    .getByRole("button", { name: "게시물 가져오기", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveText(
    "Instagram 인증 만료 또는 해제 — 관리자 토큰 교체 필요",
  );
  await expect(
    page.getByLabel("Instagram 계정명", { exact: true }),
  ).toHaveValue("bluebottle");
});
