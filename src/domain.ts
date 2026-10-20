import {
  demoResearch,
  legacyResearch,
  validateResearch,
  type Research,
} from "./research.ts";
export type Fields = Record<string, string>;
export type Candidate = { id: string; mode: "demo" | "user"; fields: Fields };
export type Content = {
  id: string;
  candidateId: string;
  mode: "demo" | "user";
  fields: Fields;
};
export type Entry = {
  id: string;
  candidateId: string;
  kind: "market" | "contact" | "sale";
  fields: Fields;
  points?: Point[];
};
export type Point = { date: string; value: number };
export type State = Research & {
  version: 2;
  candidates: Candidate[];
  contents: Content[];
  entries: Entry[];
  searches: Fields[];
  categories: string[];
  demoDeleted: boolean;
};
export const uid = () => crypto.randomUUID();
export const today = () => new Date().toISOString().slice(0, 10);
export const statuses = [
  "발견",
  "조사 중",
  "시장 검증",
  "총판 검토",
  "판매 테스트",
  "진행",
  "보류",
  "제외",
];
export const repeatTypes = ["미확인", "소진", "리필", "정기 교체", "마모 교체"];
export const authorTypes = [
  "미확인",
  "인플루언서",
  "전문가·사업자",
  "일반 사용자",
];
export const categories = [
  "생활용품",
  "식품",
  "뷰티",
  "반려동물",
  "취미",
  "산업·작업",
  "건강",
  "원예",
];
export const dict: Record<string, string[]> = {
  "친환경 주방세제": [
    "eco-friendly dish soap",
    "washing-up liquid",
    "solid dish soap",
    "dish soap concentrate",
  ],
  커피: ["coffee beans", "coffee filter", "coffee concentrate"],
  반려동물: ["pet supplies", "cat litter", "dog dental chews"],
  화장품: ["skincare", "refill cosmetics", "facial serum"],
  정수필터: ["water filter", "replacement water filter"],
  원예: ["gardening supplies", "plant nutrients", "seed refill"],
  프린터: ["printer consumables", "replacement ink", "printing supplies"],
};
export function expand(query: string): string[] {
  const base = dict[query.trim()];
  if (!base) return [];
  return [
    ...base,
    `${base[0]} refill`,
    `${base[0]} repurchase`,
    `${base[0]} review`,
    `${base[0]} professional supplies`,
  ];
}
export function normalizeUrl(raw: string) {
  try {
    const u = new URL(raw);
    if (!["https:", "http:"].includes(u.protocol)) return "";
    u.hash = "";
    for (const k of [...u.searchParams.keys()])
      if (k.startsWith("utm_") || ["fbclid", "igsh", "si"].includes(k))
        u.searchParams.delete(k);
    u.hostname = u.hostname.replace(/^www\./, "");
    u.pathname = u.pathname.replace(/\/$/, "");
    u.searchParams.sort();
    return u.toString();
  } catch {
    return "";
  }
}
export function parseSeries(csv: string): Point[] {
  const lines = csv
    .trim()
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/);
  if (lines.shift()?.trim() !== "date,value")
    throw Error("첫 행은 date,value 이어야 합니다.");
  if (!lines.length) throw Error("데이터 행이 필요합니다.");
  return lines
    .map((line) => {
      const [date, v, ...extra] = line.split(",");
      const value = Number(v);
      if (
        extra.length ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        new Date(date).toISOString().slice(0, 10) !== date ||
        v?.trim() === "" ||
        !Number.isFinite(value) ||
        value < 0
      )
        throw Error("날짜(YYYY-MM-DD)와 0 이상의 숫자를 확인하세요.");
      return { date, value };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function number(f: Fields, k: string) {
  const raw = f[k];
  return raw !== undefined &&
    raw.trim() !== "" &&
    Number.isFinite(Number(raw)) &&
    Number(raw) >= 0
    ? Number(raw)
    : null;
}
export function profit(f: Fields) {
  const keys = [
    "purchase",
    "exchange",
    "quantity",
    "freight",
    "insurance",
    "customs",
    "other",
    "price",
    "fee",
    "delivery",
    "ads",
    "returns",
  ];
  const n = Object.fromEntries(keys.map((k) => [k, number(f, k)]));
  if (
    keys.some((k) => n[k] === null) ||
    !n.quantity ||
    !n.exchange ||
    n.fee! > 100
  )
    return null;
  const cost =
    n.purchase! * n.exchange! +
    (n.freight! + n.insurance! + n.customs! + n.other!) / n.quantity!;
  const selling = (n.price! * n.fee!) / 100 + n.delivery! + n.ads! + n.returns!;
  const gain = n.price! - cost - selling;
  return {
    cost,
    selling,
    gain,
    margin: n.price ? (gain / n.price) * 100 : null,
  };
}
export function saleResult(f: Fields) {
  const visits = number(f, "visits"),
    orders = number(f, "orders");
  const keys = ["revenue", "adCost", "refund", "otherCost", "goodsCost"];
  const n = keys.map((k) => number(f, k));
  return {
    conversion: visits && orders !== null ? (orders / visits) * 100 : null,
    provisional: n.some((v) => v === null),
    gain: (n[0] ?? 0) - (n[1] ?? 0) - (n[2] ?? 0) - (n[3] ?? 0) - (n[4] ?? 0),
  };
}
const sample = [
  ["Mora", "고체 주방 세정바", "생활용품", "소진", "친환경 주방세제"],
  ["Luma", "농축 핸드워시 리필", "생활용품", "리필", "핸드워시"],
  ["Brewly", "커피 필터 구독 팩", "식품", "정기 교체", "커피"],
  ["Pawday", "식물성 고양이 모래", "반려동물", "소진", "반려동물"],
  ["Fern", "실내 식물 영양 리필", "원예", "리필", "원예"],
  ["Nori", "무향 보습 세럼", "뷰티", "소진", "화장품"],
  ["Clearo", "휴대 정수기 필터", "건강", "정기 교체", "정수필터"],
  ["Printo", "공방 프린터 잉크", "산업·작업", "리필", "프린터"],
  ["Trail", "등산화 교체 인솔", "취미", "마모 교체", "등산"],
  ["Mend", "자전거 체인 관리 오일", "취미", "소진", "자전거"],
  ["Workly", "샌딩 패드 교체 팩", "산업·작업", "마모 교체", "공구"],
  ["Calm", "허브 티 리필 팩", "식품", "미확인", "차"],
];
export function initialState(): State {
  const candidates: Candidate[] = sample.map(
    ([brand, name, category, repeat, group], i) => ({
      id: `demo-${i}`,
      mode: "demo",
      fields: {
        name,
        brand,
        category,
        repeat,
        group,
        status: statuses[i % 5],
        manufacturer: "가상 제조사",
        country: "미확인",
        market: "미확인",
        problem: "제품군의 반복 사용 문제를 검토하는 가상 사례",
        repeatEvidence: "시연 가정 · 실제 근거 미확인",
        snsEvidence: "시연 콘텐츠 · 실제 확산 여부 미확인",
        evidence: "미확인",
      },
    }),
  );
  const contents: Content[] = candidates.map((c, i) => ({
    id: `demo-content-${i}`,
    candidateId: c.id,
    mode: "demo",
    fields: {
      title: `${c.fields.name} 사용 사례 (시연)`,
      platform: ["인스타그램", "틱톡", "유튜브"][i % 3],
      author: "가상 작성자",
      authorType: authorTypes[i % 4],
      source: "시연",
      language: ["영어", "일본어", "독일어"][i % 3],
      creatorCountry: "미확인",
      audienceMarket: "미확인",
      sponsorship: "미확인",
      observed: today(),
    },
  }));
  return {
    version: 2,
    candidates,
    contents,
    ...demoResearch(contents),
    entries: [],
    searches: [],
    categories: [...categories],
    demoDeleted: false,
  };
}
function isFields(x: unknown): x is Fields {
  return (
    !!x &&
    typeof x === "object" &&
    !Array.isArray(x) &&
    Object.values(x).every((v) => typeof v === "string")
  );
}
export function validateBackup(raw: unknown): State {
  const x = raw as State;
  if (
    !x ||
    ![1, 2].includes(x.version) ||
    !Array.isArray(x.candidates) ||
    !Array.isArray(x.contents) ||
    !Array.isArray(x.entries) ||
    !Array.isArray(x.searches) ||
    !Array.isArray(x.categories) ||
    typeof x.demoDeleted !== "boolean"
  )
    throw Error("지원하는 버전 1·2 백업 파일이 아닙니다.");
  const ids = new Set<string>();
  for (const c of x.candidates) {
    if (
      !c ||
      typeof c.id !== "string" ||
      !c.id ||
      ids.has(c.id) ||
      !["demo", "user"].includes(c.mode) ||
      !isFields(c.fields) ||
      !c.fields.name?.trim()
    )
      throw Error("후보 데이터 형식이 잘못되었습니다.");
    ids.add(c.id);
  }
  const recordIds = new Set<string>();
  for (const c of x.contents) {
    if (
      !c ||
      typeof c.id !== "string" ||
      !c.id ||
      recordIds.has(c.id) ||
      !ids.has(c.candidateId) ||
      !["demo", "user"].includes(c.mode) ||
      !isFields(c.fields) ||
      x.candidates.find((p) => p.id === c.candidateId)?.mode !== c.mode
    )
      throw Error("콘텐츠 연결이 잘못되었습니다.");
    recordIds.add(c.id);
    if (c.fields.url && !normalizeUrl(c.fields.url))
      throw Error("잘못된 원문 URL입니다.");
  }
  recordIds.clear();
  for (const e of x.entries) {
    if (
      !e ||
      typeof e.id !== "string" ||
      !e.id ||
      recordIds.has(e.id) ||
      !ids.has(e.candidateId) ||
      !["market", "contact", "sale"].includes(e.kind) ||
      !isFields(e.fields)
    )
      throw Error("조사 기록 형식이 잘못되었습니다.");
    recordIds.add(e.id);
    if (
      e.points !== undefined &&
      (!Array.isArray(e.points) ||
        !e.points.every(
          (p) =>
            p &&
            /^\d{4}-\d{2}-\d{2}$/.test(p.date) &&
            Number.isFinite(p.value) &&
            p.value >= 0,
        ))
    )
      throw Error("시계열 형식이 잘못되었습니다.");
  }
  if (
    !x.searches.every(isFields) ||
    !x.categories.every((c) => typeof c === "string" && c.length > 0)
  )
    throw Error("설정 형식이 잘못되었습니다.");
  const migrated: State =
    (x.version as number) === 1
      ? { ...x, version: 2, ...legacyResearch(x.contents) }
      : x;
  validateResearch(
    {
      observations: migrated.observations,
      commentEvidence: migrated.commentEvidence,
      siteReviews: migrated.siteReviews,
      aiRecords: migrated.aiRecords,
    },
    migrated.contents,
    migrated.candidates,
  );
  return structuredClone(migrated);
}
export function candidateCsv(cs: Candidate[]) {
  const keys = [
    "mode",
    "name",
    "brand",
    "category",
    "repeat",
    "status",
    "country",
    "market",
    "notes",
  ];
  const quote = (s: string) =>
    '"' + (/^[=+@\-\t\r]/.test(s) ? "'" + s : s).replaceAll('"', '""') + '"';
  return (
    "\uFEFF" +
    [
      keys.join(","),
      ...cs.map((c) =>
        keys
          .map((k) => quote(k === "mode" ? c.mode : (c.fields[k] ?? "")))
          .join(","),
      ),
    ].join("\r\n")
  );
}
