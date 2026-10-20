import { test, expect } from "@playwright/test";
test("local research workflow and safe restore", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "최근 검토 후보 12" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "원하는 제품 탐색", exact: true })
    .click();
  await page.getByLabel("제품군 입력").fill("친환경 주방세제");
  await page.getByRole("button", { name: "내장 사전으로 탐색어 제안" }).click();
  await expect(
    page.getByRole("heading", { name: "시연 탐색 결과" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "고체 주방 세정바", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "커피 필터 구독 팩", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("제품군 입력").fill("알수없는제품");
  await page.getByRole("button", { name: "내장 사전으로 탐색어 제안" }).click();
  await expect(
    page.getByText("내장 사전에 없는 제품군입니다.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "고체 주방 세정바", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "사용자 작업", exact: true }).click();
  await page.getByRole("button", { name: "저장한 후보", exact: true }).click();
  await page.getByRole("button", { name: "+ 후보 등록", exact: true }).click();
  await page.getByLabel("제품명", { exact: true }).fill("테스트 필터");
  await page.getByLabel("브랜드명", { exact: true }).fill("Test brand");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "저장", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Test brand / 테스트 필터" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "+ SNS 링크·콘텐츠 등록" }).click();
  await page.getByLabel("콘텐츠 제목", { exact: true }).fill("사용 후기");
  await page
    .getByLabel("원문 URL", { exact: true })
    .fill("https://www.youtube.com/watch?v=real&utm_source=abc");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "저장", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "사용 후기", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "+ SNS 링크·콘텐츠 등록" }).click();
  await page.getByLabel("콘텐츠 제목", { exact: true }).fill("중복");
  await page
    .getByLabel("원문 URL", { exact: true })
    .fill("https://youtube.com/watch?v=real");
  page.once("dialog", (d) => {
    expect(d.message()).toContain("이미 등록된 URL");
    void d.accept();
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "저장", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "중복", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "후보 편집", exact: true }).click();
  await page
    .getByRole("combobox", { name: "검토 상태", exact: true })
    .selectOption("판매 테스트");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "저장", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "사용자 작업", exact: true }).click();
  await page.getByRole("button", { name: "저장한 후보", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "테스트 필터", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("article").getByText("판매 테스트", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "시장 검증", exact: true }).click();
  await page.getByLabel("제품군 검색어", { exact: true }).fill("water filter");
  await page
    .getByLabel("시계열 CSV (선택) · date,value / 날짜, 0 이상 숫자")
    .fill("date,value\n2026-01-01,20\n2026-02-01,35");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "35", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "총판 검토", exact: true }).click();
  const inputs: Record<string, string> = {
    "외화 매입 단가": "10",
    "입력 환율 (원/외화 1단위)": "1300",
    "발주 수량": "100",
    "국제운임 총액 (원)": "100000",
    "보험 총액 (원)": "10000",
    "관세·통관 비용 총액 (원)": "20000",
    "기타 배분 비용 총액 (원)": "20000",
    "판매가 · 부가세 제외 (원)": "25000",
    "판매 수수료 (%)": "10",
    "단위당 국내 배송 (원)": "3000",
    "단위당 광고 (원)": "1000",
    "단위당 예상 반품 비용 (원)": "500",
  };
  for (const [label, value] of Object.entries(inputs))
    await page.getByLabel(label, { exact: true }).fill(value);
  await expect(
    page.getByText("단위당 예상 이익 3,500원 · 이익률 14%"),
  ).toBeVisible();
  await page.getByRole("button", { name: "계산 가정 저장" }).click();
  await page
    .getByRole("button", { name: "설정·데이터 관리", exact: true })
    .click();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON 전체 내보내기" }).click();
  const download = await dl;
  expect(download.suggestedFilename()).toBe("marketing-trend-backup.json");
  const path = await download.path();
  await page
    .getByLabel("JSON 전체 복원 (검증 후 덮어쓰기 확인)")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":2}'),
    });
  await expect(page.getByRole("alert")).toContainText("복원 취소");
  page.once("dialog", (d) => void d.accept());
  await page
    .getByRole("button", { name: "시연 데이터 삭제", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("button", { name: "설정·데이터 관리", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "시연 데이터 삭제", exact: true }),
  ).toBeDisabled();
  page.once("dialog", (d) => void d.accept());
  await page
    .getByLabel("JSON 전체 복원 (검증 후 덮어쓰기 확인)")
    .setInputFiles(path!);
  await expect(
    page.getByRole("button", { name: "시연 데이터 삭제", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "사용자 작업", exact: true }).click();
  await page.getByRole("button", { name: "저장한 후보", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "테스트 필터", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
