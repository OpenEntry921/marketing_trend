import { test, expect } from "@playwright/test";
import { initialState } from "../src/domain";
test("append observations, classify sample, review website and compare AI attempts", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  const readiness = await page.request.get("/api/youtube/status");
  expect(readiness.ok()).toBe(true);
  expect(typeof (await readiness.json()).configured).toBe("boolean");
  await page.goto("/");
  await page.getByRole("button", { name: "저장한 후보", exact: true }).click();
  await page
    .getByRole("button", { name: "허브 티 리필 팩", exact: true })
    .click();
  await page
    .getByText("관측 기록 추가 · 과거 값 보존", { exact: true })
    .click();
  await page
    .getByLabel("관측 시각 (시간대 포함)", { exact: true })
    .fill("2026-01-03T09:00:00+09:00");
  await page.getByLabel("조회수 상태", { exact: true }).selectOption("확인됨");
  await page.getByLabel("조회수 값", { exact: true }).fill("1000");
  await page
    .getByLabel("좋아요 수 상태", { exact: true })
    .selectOption("확인됨");
  await page.getByLabel("좋아요 수 값", { exact: true }).fill("0");
  await page.getByLabel("댓글 수 상태", { exact: true }).selectOption("비공개");
  await page.getByLabel("관측 출처", { exact: true }).fill("시연 직접 입력");
  await page.getByRole("button", { name: "관측 추가", exact: true }).click();
  await expect(
    page.getByText("실제 순감소입니다.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("관측 이력 (3) · 차트·원래 지표 정의", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("좋아요 비율: 0% · 댓글 비율: 계산 불가", { exact: true }),
  ).toBeVisible();
  await page.getByText("댓글 근거 (0) · 수동 분류", { exact: true }).click();
  await page
    .getByLabel("댓글 발췌문", { exact: true })
    .fill("어디서 구매하나요?");
  await page
    .getByLabel("댓글 출처 링크", { exact: true })
    .fill("https://example.com/comment");
  await page.getByLabel("확인한 표본 수", { exact: true }).fill("3");
  await page
    .getByLabel("표본 선정 방식", { exact: true })
    .fill("최근 댓글 3개 직접 선택");
  await page
    .getByRole("checkbox", { name: "구매·사용 경험", exact: true })
    .check();
  await page
    .getByRole("button", { name: "댓글 근거 저장", exact: true })
    .click();
  await expect(
    page.getByRole("article").getByText("어디서 구매하나요?", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "댓글 편집", exact: true }).click();
  await page
    .getByLabel("댓글 발췌문", { exact: true })
    .fill("가격과 배송은 어떻게 되나요?");
  await page
    .getByRole("button", { name: "댓글 근거 저장", exact: true })
    .click();
  await expect(
    page
      .getByRole("article")
      .getByText("가격과 배송은 어떻게 되나요?", { exact: true }),
  ).toBeVisible();
  await page.getByText("홈페이지 SEO·GEO 점검 (0)", { exact: true }).click();
  await page
    .getByLabel("점검 페이지 URL", { exact: true })
    .fill("https://example.com/product");
  await page
    .getByLabel("점검 페이지 제목", { exact: true })
    .fill("제품 안내 페이지");
  await page
    .getByLabel("제품 설명 점검 상태", { exact: true })
    .selectOption("문제 확인");
  await page
    .getByLabel("제품 설명 확인 근거", { exact: true })
    .fill("용도 설명 누락 확인");
  await page
    .getByLabel("홈페이지 문제", { exact: true })
    .fill("제품 용도 설명 누락");
  await page
    .getByLabel("권장 수정", { exact: true })
    .fill("본문에 용도 설명 추가");
  await page
    .getByRole("button", { name: "페이지 점검 저장", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "제품 안내 페이지", exact: true }),
  ).toBeVisible();
  await page.getByText("AI 답변 노출 기록 (0)", { exact: true }).click();
  await page
    .getByLabel("조사 질문 원문", { exact: true })
    .fill("어떤 필터를 선택할까?");
  await page
    .getByLabel("대상 AI 서비스", { exact: true })
    .fill("수동 관측 서비스");
  await page
    .getByLabel("답변 원문·발췌", { exact: true })
    .fill("브랜드는 언급하지만 홈페이지는 인용하지 않음");
  await page.getByLabel("브랜드·제품 언급", { exact: true }).selectOption("예");
  await page
    .getByLabel("대상 도메인·페이지 인용", { exact: true })
    .selectOption("아니오");
  await page.getByRole("button", { name: "AI 관측 저장", exact: true }).click();
  await expect(
    page.getByText("언급: 1/1 (100%) · 여부 미확인 0건 제외", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("실행 상태", { exact: true }).selectOption("실패");
  await page.getByRole("button", { name: "AI 관측 저장", exact: true }).click();
  await expect(
    page.getByText(
      "등록한 관측 표본 내 비율 · 완료 1건 · 실패/미실행 제외 1건",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText("인용: 0/1 (0%) · 여부 미확인 0건 제외", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "저장한 후보", exact: true }).click();
  await page
    .getByRole("button", { name: "허브 티 리필 팩", exact: true })
    .click();
  await expect(
    page.getByText("관측 이력 (3) · 차트·원래 지표 정의", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("홈페이지 SEO·GEO 점검 (1)", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("AI 답변 노출 기록 (2)", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(pageErrors).toEqual([]);
});
test("loads an existing v1 database without fabricating observation timestamps", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "대시보드", exact: true }),
  ).toBeVisible();
  const { observations, commentEvidence, siteReviews, aiRecords, ...base } =
    initialState();
  const old = {
    ...base,
    version: 1,
    contents: base.contents.map((c, i) => ({
      ...c,
      fields: {
        ...c.fields,
        views: "0",
        likes: "",
        observed: i === 11 ? "" : c.fields.observed,
      },
    })),
  };
  await page.evaluate(async (old) => {
    const request = indexedDB.open("marketing-trend-local", 1);
    const db = await new Promise<IDBDatabase>((res, rej) => {
      request.onsuccess = () => res(request.result);
      request.onerror = () => rej(request.error);
    });
    await new Promise<void>((res, rej) => {
      const tx = db.transaction("workspace", "readwrite");
      tx.objectStore("workspace").put(old, "state");
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, old);
  await page.reload();
  await page.getByRole("button", { name: "저장한 후보", exact: true }).click();
  await page
    .getByRole("button", { name: "허브 티 리필 팩", exact: true })
    .click();
  await expect(
    page.getByText("최근 관측: 미확인 · 수집 방식: 시연", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "조회수 순증감: 계산 불가 · 일평균 순증감: 계산 불가 · 관측 간 증가율: 계산 불가",
      { exact: true },
    ),
  ).toBeVisible();
});
