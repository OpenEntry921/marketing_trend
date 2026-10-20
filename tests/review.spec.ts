import { test, expect } from "@playwright/test";
test("filters, comparison, contact and sales records", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "새로운 제품 발견", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "플랫폼", exact: true })
    .selectOption("틱톡");
  await page
    .getByRole("combobox", { name: "반복 구매 유형", exact: true })
    .selectOption("리필");
  await page.getByRole("button", { name: "시연·저장 후보 탐색" }).click();
  await expect(
    page.getByRole("button", { name: "농축 핸드워시 리필", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "고체 주방 세정바", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "검색어·조건 저장" }).click();
  await page.getByRole("button", { name: "저장한 후보", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "비교", exact: true })
    .nth(0)
    .check();
  await page
    .getByRole("checkbox", { name: "비교", exact: true })
    .nth(1)
    .check();
  await page.getByRole("button", { name: "비교 (2/4)", exact: true }).click();
  await expect(page.getByRole("columnheader")).toHaveCount(3);
  await expect(
    page.getByRole("rowheader", { name: "근거의 충분성" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "총판 검토", exact: true }).click();
  await page
    .getByLabel("접촉 내용", { exact: true })
    .fill("제조사에 문의할 질문 초안");
  const contact = page
    .getByRole("heading", { name: "접촉 기록", exact: true })
    .locator("..");
  await contact.getByRole("button", { name: "저장", exact: true }).click();
  await expect(
    page
      .getByRole("article")
      .getByText("제조사에 문의할 질문 초안", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("방문수", { exact: true }).fill("0");
  await page.getByLabel("주문수", { exact: true }).fill("0");
  await page
    .getByLabel("매출 · 부가세 제외 (원)", { exact: true })
    .fill("10000");
  const sale = page
    .getByRole("heading", { name: "판매 테스트 기록", exact: true })
    .locator("..");
  await sale.getByRole("button", { name: "저장", exact: true }).click();
  await expect(
    page.getByText("전환율: 계산 불가 · 잠정 손익 (누락 비용 있음): 10,000원"),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "총판 검토", exact: true }).click();
  await expect(
    page
      .getByRole("article")
      .getByText("제조사에 문의할 질문 초안", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("전환율: 계산 불가 · 잠정 손익 (누락 비용 있음): 10,000원"),
  ).toBeVisible();
});
