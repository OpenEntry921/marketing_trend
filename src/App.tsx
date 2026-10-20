import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  authorTypes,
  candidateCsv,
  expand,
  initialState,
  normalizeUrl,
  parseSeries,
  profit,
  repeatTypes,
  saleResult,
  statuses,
  today,
  uid,
  validateBackup,
  type Candidate,
  type Fields,
  type State,
} from "./domain";
import { load, save } from "./store";
import { providers } from "./providers";
import "./style.css";
type Spec = [string, string, string?];
const pickFields = (fields: Fields, spec: Spec[]): Fields =>
  Object.fromEntries(
    spec.filter(([k]) => fields[k] !== undefined).map(([k]) => [k, fields[k]]),
  );
const productSpec: Spec[] = [
  ["name", "제품명", "required"],
  ["brand", "브랜드명"],
  ["manufacturer", "제조사명"],
  ["category", "카테고리"],
  ["purpose", "제품 용도"],
  ["country", "제조사 국가"],
  ["market", "판매 시장"],
  ["website", "공식 홈페이지", "url"],
  ["repeat", "반복 구매 유형", repeatTypes.join("|")],
  ["repeatEvidence", "반복 구매 근거", "textarea"],
  ["customer", "예상 구매 고객"],
  ["channel", "유통 경로"],
  ["problem", "해결하려는 문제", "textarea"],
  ["strength", "장점", "textarea"],
  ["weakness", "약점", "textarea"],
  ["unknown", "미확인 사항", "textarea"],
  ["snsEvidence", "SNS 확산 근거", "textarea"],
  ["competition", "국내 경쟁 상황", "textarea"],
  ["distribution", "총판 가능성", "textarea"],
  ["profitability", "예상 수익성 검토", "textarea"],
  ["evidence", "근거의 충분성", "미확인|추가 확인 필요|확인됨"],
  ["next", "다음 조사 과제", "textarea"],
  ["links", "조사 링크", "textarea"],
  ["notes", "사용자 메모", "textarea"],
  ["tags", "태그"],
  ["status", "검토 상태", statuses.join("|")],
  ["reason", "보류·제외 이유", "textarea"],
];
const contentSpec: Spec[] = [
  ["title", "콘텐츠 제목", "required"],
  ["url", "원문 URL", "url"],
  ["platform", "플랫폼", "인스타그램|틱톡|유튜브|기타"],
  ["author", "작성자명"],
  ["authorType", "작성자 유형", authorTypes.join("|")],
  ["published", "게시일", "date"],
  ["observed", "관측일", "date"],
  ["language", "콘텐츠 언어"],
  ["creatorCountry", "작성자 소재지"],
  ["audienceMarket", "실제 구매자 시장"],
  ["views", "조회수", "number"],
  ["likes", "좋아요", "number"],
  ["comments", "댓글 수", "number"],
  ["sponsorship", "광고·협찬", "미확인|표시 있음"],
  ["buyEvidence", "구매 문의 발언과 근거", "textarea"],
  ["repeatEvidence", "재구매·리필·교체 발언과 근거", "textarea"],
];
const marketSpec: Spec[] = [
  ["date", "조사일", "date"],
  [
    "service",
    "조사 서비스",
    "네이버 데이터랩|네이버 키워드 도구|아이템스카우트|구글 트렌드|기타",
  ],
  ["productQuery", "제품군 검색어", "required"],
  ["brandQuery", "브랜드 검색어"],
  [
    "metric",
    "지표",
    "검색량|상대 검색 지수|쇼핑 클릭 지수|콘텐츠 조회수|추정 판매량|실제 판매량",
  ],
  ["period", "관측 기간"],
  ["source", "출처 링크", "url"],
  ["result", "조사 결과", "textarea"],
  ["notes", "메모", "textarea"],
];
const distributionSpec: Spec[] = [
  ["businessContact", "공개 업무용 연락처"],
  ["domestic", "국내 판매처·수입사 조사", "textarea"],
  ["checked", "판매처 확인일", "date"],
  [
    "rights",
    "한국 총판권",
    "미확인|문의 예정|협의 중|기존 계약 확인|계약 완료",
  ],
  ["exclusive", "독점 범위·판매 채널·계약 기간", "textarea"],
  ["moq", "최소 발주량"],
  ["supply", "공급 가격·통화"],
  ["payment", "결제 조건"],
  ["lead", "납기"],
  ["shelf", "유통기한"],
  ["storage", "보관 조건·운송 특성", "textarea"],
  ["regulatory", "국내 수입·판매 절차 확인 상태", "textarea"],
];
const costSpec: Spec[] = [
  ["currency", "매입 통화"],
  ["purchase", "외화 매입 단가", "number"],
  ["exchange", "입력 환율 (원/외화 1단위)", "number"],
  ["quantity", "발주 수량", "number"],
  ["freight", "국제운임 총액 (원)", "number"],
  ["insurance", "보험 총액 (원)", "number"],
  ["customs", "관세·통관 비용 총액 (원)", "number"],
  ["other", "기타 배분 비용 총액 (원)", "number"],
  ["price", "판매가 · 부가세 제외 (원)", "number"],
  ["fee", "판매 수수료 (%)", "number"],
  ["delivery", "단위당 국내 배송 (원)", "number"],
  ["ads", "단위당 광고 (원)", "number"],
  ["returns", "단위당 예상 반품 비용 (원)", "number"],
  ["recoverable", "회수 가능 부가세 별도 메모 (비용 제외)"],
];
const saleSpec: Spec[] = [
  ["date", "기록일", "date"],
  ["period", "테스트 기간"],
  ["channel", "판매 채널"],
  ["visits", "방문수", "number"],
  ["orders", "주문수", "number"],
  ["units", "판매 수량", "number"],
  ["revenue", "매출 · 부가세 제외 (원)", "number"],
  ["goodsCost", "매출원가 (원)", "number"],
  ["adCost", "광고비 (원)", "number"],
  ["refund", "반품·환불 (원)", "number"],
  ["otherCost", "기타 비용 (원)", "number"],
  ["evaluation", "사용자 평가", "textarea"],
  ["decision", "다음 결정", "textarea"],
];
const contactSpec: Spec[] = [
  ["date", "접촉 날짜", "date"],
  ["body", "접촉 내용", "textarea"],
  ["reply", "회신", "textarea"],
  ["next", "다음 할 일", "textarea"],
];
const money = (n: number) =>
  n.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
const val = (s?: string) => s?.trim() || "미확인";
function Link({ url, label }: { url?: string; label?: string }) {
  const safe = url && normalizeUrl(url);
  return safe ? (
    <a href={safe} target="_blank" rel="noreferrer">
      {label || url} ↗
    </a>
  ) : (
    <span>미확인</span>
  );
}
function Form({
  spec,
  initial,
  onSave,
  label = "저장",
  children,
}: {
  spec: Spec[];
  initial?: Fields;
  onSave: (f: Fields) => void;
  label?: string;
  children?: React.ReactNode;
}) {
  const [f, set] = useState<Fields>(initial ?? {});
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(f);
      }}
    >
      <div className="form-grid">
        {spec.map(([key, title, type]) => (
          <label key={key}>
            {title}
            {type === "textarea" ? (
              <textarea
                value={f[key] ?? ""}
                onChange={(e) => set({ ...f, [key]: e.target.value })}
              />
            ) : type?.includes("|") ? (
              <select
                value={f[key] ?? type.split("|")[0]}
                onChange={(e) => set({ ...f, [key]: e.target.value })}
              >
                {type.split("|").map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            ) : (
              <input
                required={type === "required"}
                type={type === "required" ? "text" : (type ?? "text")}
                min={type === "number" ? 0 : undefined}
                step={type === "number" ? "any" : undefined}
                value={f[key] ?? ""}
                onChange={(e) => set({ ...f, [key]: e.target.value })}
              />
            )}
          </label>
        ))}
      </div>
      {children}
      <button className="primary" type="submit">
        {label}
      </button>
    </form>
  );
}
export default function App() {
  const [s, setS] = useState<State>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState("대시보드");
  const [mode, setMode] = useState<"demo" | "user">("demo");
  const [selected, setSelected] = useState("");
  const [editingContent, setEditingContent] = useState("");
  const [modal, setModal] = useState<"candidate" | "content" | null>(null);
  const [editing, setEditing] = useState<Candidate>();
  const [compare, setCompare] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [q, setQ] = useState("");
  const [listStatus, setListStatus] = useState("전체");
  const [sort, setSort] = useState("최근 등록");
  const [filters, setFilters] = useState<Fields>({
    platform: "전체",
    category: "전체",
    authorType: "전체",
    repeat: "전체",
    language: "전체",
    topic: "전체",
    period: "전체",
  });
  const [query, setQuery] = useState("");
  const [terms, setTerms] = useState("");
  const [searched, setSearched] = useState(false);
  const [grouped, setGrouped] = useState(true);
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    load()
      .then(setS)
      .catch((e) => setError("저장소를 열 수 없습니다: " + e.message));
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  async function commit(next: State) {
    setBusy(true);
    try {
      await save(next);
      setS(next);
      setError("");
      setNotice("저장했습니다.");
      return true;
    } catch (e) {
      setError("저장 실패. 기존 데이터를 유지합니다. " + String(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  const cs = s?.candidates.filter((c) => c.mode === mode) ?? [];
  const active = cs.find((c) => c.id === selected) ?? cs[0];
  function nav(p: string) {
    setPage(p);
    setSelected("");
    setShowCompare(false);
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("검색어를 복사했습니다.");
    } catch {
      setError("복사 권한이 없습니다. 입력란의 검색어를 직접 복사하세요.");
    }
  }
  function download(text: string, name: string, type: string) {
    const u = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = u;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  async function restore(file?: File) {
    if (!file || !s) return;
    try {
      if (file.size > 10_000_000) throw Error("10MB 이하 파일만 지원합니다.");
      const next = validateBackup(JSON.parse(await file.text()));
      if (
        window.confirm(
          `현재 데이터를 백업의 후보 ${next.candidates.length}개로 덮어씁니다. 계속할까요?`,
        )
      ) {
        await commit(next);
        setSelected("");
      }
    } catch (e) {
      setError("복원 취소: " + String(e));
    }
  }
  if (!s)
    return (
      <main>
        <h1>MARKETING TREND</h1>
        <p role="alert">{error || "로컬 데이터 준비 중…"}</p>
      </main>
    );
  const state = s;
  async function saveCandidate(f: Fields) {
    if (!f.name?.trim()) {
      setError("제품명을 입력하세요.");
      return;
    }
    const c: Candidate = {
      id: editing?.id ?? uid(),
      mode: editing?.mode ?? mode,
      fields: { status: "발견", repeat: "미확인", evidence: "미확인", ...f },
    };
    if (
      await commit({
        ...state,
        candidates: editing
          ? state.candidates.map((x) => (x.id === c.id ? c : x))
          : [...state.candidates, c],
      })
    ) {
      setModal(null);
      setSelected(c.id);
      setPage("저장한 후보");
    }
  }
  async function saveContent(f: Fields) {
    if (!active) return;
    const url = normalizeUrl(f.url ?? "");
    if (!url) {
      setError("직접 등록할 콘텐츠의 올바른 HTTP(S) 원문 URL을 입력하세요.");
      return;
    }
    const existing = state.contents.find(
      (c) =>
        c.id !== editingContent &&
        c.mode === mode &&
        normalizeUrl(c.fields.url ?? "") === url,
    );
    if (existing) {
      const parent = state.candidates.find(
        (c) => c.id === existing.candidateId,
      );
      if (
        window.confirm(
          `이미 등록된 URL입니다. 기존 후보 ‘${parent?.fields.name}’로 이동할까요?`,
        )
      ) {
        setSelected(existing.candidateId);
        setPage("저장한 후보");
        setModal(null);
      }
      return;
    }
    const content = {
      id: editingContent || uid(),
      candidateId: active.id,
      mode,
      fields: {
        authorType: "미확인",
        sponsorship: "미확인",
        platform: "인스타그램",
        ...f,
        url,
        source: mode === "demo" ? "시연" : "수동",
      },
    };
    if (
      await commit({
        ...state,
        contents: editingContent
          ? state.contents.map((c) => (c.id === editingContent ? content : c))
          : [...state.contents, content],
      })
    ) {
      setModal(null);
      setEditingContent("");
    }
  }
  async function deleteCandidate(c: Candidate) {
    if (!confirm(`‘${c.fields.name}’와 연결된 콘텐츠·조사 기록을 삭제할까요?`))
      return;
    await commit({
      ...state,
      candidates: state.candidates.filter((x) => x.id !== c.id),
      contents: state.contents.filter((x) => x.candidateId !== c.id),
      entries: state.entries.filter((x) => x.candidateId !== c.id),
    });
    setSelected("");
    setCompare(compare.filter((id) => id !== c.id));
  }
  async function entry(kind: "market" | "contact" | "sale", f: Fields) {
    if (!active) return;
    try {
      const points =
        kind === "market" && csv.trim() ? parseSeries(csv) : undefined;
      if (
        await commit({
          ...state,
          entries: [
            ...state.entries,
            { id: uid(), candidateId: active.id, kind, fields: f, points },
          ],
        })
      )
        setCsv("");
    } catch (e) {
      setError(String(e));
    }
  }
  const picker = (
    <label className="picker">
      검토 후보
      <select
        value={active?.id ?? ""}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="" disabled>
          후보를 등록하세요
        </option>
        {cs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.fields.brand} · {c.fields.name}
          </option>
        ))}
      </select>
    </label>
  );
  function cards(items: Candidate[]) {
    return (
      <div className="cards">
        {items.map((c) => (
          <article key={c.id}>
            <div className="row">
              <span className="tag">
                {c.mode === "demo" ? "시연 · 가상 제품" : "사용자 입력"}
              </span>
              <span>{c.fields.category}</span>
            </div>
            <p className="eyebrow">{val(c.fields.brand)}</p>
            <h3>
              <button
                className="title-button"
                onClick={() => {
                  setSelected(c.id);
                  setPage("저장한 후보");
                }}
              >
                {c.fields.name}
              </button>
            </h3>
            <p>{val(c.fields.problem)}</p>
            <div className="row">
              <span className="pill">{val(c.fields.repeat)}</span>
              <span>{val(c.fields.status)}</span>
            </div>
            <div className="card-actions">
              <button
                onClick={() => {
                  setSelected(c.id);
                  setPage("저장한 후보");
                }}
              >
                상세 검토 →
              </button>
              <label>
                <input
                  type="checkbox"
                  checked={compare.includes(c.id)}
                  onChange={(e) => {
                    if (e.target.checked && compare.length >= 4) {
                      setError("비교는 최대 4개입니다.");
                      return;
                    }
                    setCompare(
                      e.target.checked
                        ? [...compare, c.id]
                        : compare.filter((id) => id !== c.id),
                    );
                  }}
                />{" "}
                비교
              </label>
            </div>
          </article>
        ))}
      </div>
    );
  }
  function history(kind: "market" | "contact" | "sale") {
    return (
      <div className="history">
        {state.entries
          .filter((e) => e.candidateId === active?.id && e.kind === kind)
          .sort((a, b) =>
            (b.fields.date ?? "").localeCompare(a.fields.date ?? ""),
          )
          .map((e) => (
            <article key={e.id}>
              <div className="row">
                <h3>
                  {val(e.fields.date)}{" "}
                  {mode === "demo" && <span className="tag">시연</span>}
                </h3>
                <button
                  onClick={() => {
                    if (confirm("이 기록을 삭제할까요?"))
                      void commit({
                        ...state,
                        entries: state.entries.filter((x) => x.id !== e.id),
                      });
                  }}
                >
                  기록 삭제
                </button>
              </div>
              <dl>
                {(kind === "market"
                  ? marketSpec
                  : kind === "sale"
                    ? saleSpec
                    : contactSpec
                ).map(([k, label]) => (
                  <React.Fragment key={k}>
                    <dt>{label}</dt>
                    <dd>
                      {k === "source" ? (
                        <Link url={e.fields[k]} />
                      ) : (
                        val(e.fields[k])
                      )}
                    </dd>
                  </React.Fragment>
                ))}
              </dl>
              {kind === "sale" && <SaleResult fields={e.fields} />}{" "}
              {!!e.points?.length && (
                <>
                  <p>
                    {e.fields.metric} ·{" "}
                    {mode === "demo" ? "시연" : "사용자 입력"} 시계열 (다른
                    지표와 합산하지 않음)
                  </p>
                  <div className="chart">
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={e.points}>
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#25756c"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>날짜</th>
                        <th>{e.fields.metric}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {e.points.map((p, i) => (
                        <tr key={i}>
                          <td>{p.date}</td>
                          <td>{p.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </article>
          ))}
      </div>
    );
  }
  const wanted = page === "원하는 제품 탐색";
  const results = cs.filter((c) => {
    const contents = state.contents.filter((x) => x.candidateId === c.id);
    const f = filters;
    return (
      (f.category === "전체" || c.fields.category === f.category) &&
      (f.repeat === "전체" || c.fields.repeat === f.repeat) &&
      contents.some(
        (x) =>
          (f.platform === "전체" || x.fields.platform === f.platform) &&
          (f.authorType === "전체" || x.fields.authorType === f.authorType) &&
          (f.language === "전체" || x.fields.language === f.language) &&
          (f.period === "전체" ||
            (!!x.fields.published &&
              Date.now() - Date.parse(x.fields.published) <=
                Number(f.period) * 86400000)),
      ) &&
      (f.topic === "전체" ||
        (f.topic === "리필"
          ? c.fields.repeat === "리필"
          : f.topic === "재구매"
            ? !!c.fields.repeatEvidence
            : f.topic === "작업용 소모품"
              ? c.fields.category === "산업·작업"
              : f.topic === "장비 유지관리"
                ? ["마모 교체", "정기 교체"].includes(c.fields.repeat)
                : false)) &&
      (!wanted ||
        (expand(query).length > 0 && c.fields.group === query.trim()) ||
        (wanted &&
          !!query.trim() &&
          c.mode === "user" &&
          `${c.fields.name} ${c.fields.group}`.includes(query.trim())))
    );
  });
  return (
    <div className="layout">
      <aside>
        <div className="brand">
          M<span>↗</span>
        </div>
        <strong>
          MARKETING
          <br />
          TREND
        </strong>
        <p className="aside-sub">해외 상품 발굴 · 검토 노트</p>
        <nav>
          {[
            "대시보드",
            "새로운 제품 발견",
            "원하는 제품 탐색",
            "저장한 후보",
            "시장 검증",
            "총판 검토",
            "설정·데이터 관리",
          ].map((p, i) => (
            <button
              className={page === p ? "current" : ""}
              key={p}
              onClick={() => nav(p)}
            >
              <span aria-hidden="true">
                {["◫", "✧", "⌕", "▤", "◷", "◇", "⚙"][i]}
              </span>
              {p}
            </button>
          ))}
        </nav>
        <div className="local-badge">
          <i /> 로컬 저장 · 개인 작업 공간<small>외부 API 미연결</small>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <span className="eyebrow">WORKSPACE / {page}</span>
            <h1>{page}</h1>
          </div>
          <div className="mode">
            <button
              aria-pressed={mode === "demo"}
              onClick={() => {
                setMode("demo");
                setSelected("");
                setCompare([]);
              }}
            >
              시연 모드
            </button>
            <button
              aria-pressed={mode === "user"}
              onClick={() => {
                setMode("user");
                setSelected("");
                setCompare([]);
              }}
            >
              사용자 작업
            </button>
          </div>
        </header>
        <div className="banner">
          {mode === "demo"
            ? "시연 모드 · 모든 제품·콘텐츠는 가상 사례입니다. 실제 검색·분석 결과가 아닙니다."
            : "사용자 작업 · 직접 입력한 자료만 표시합니다. 데이터는 이 브라우저에 저장됩니다."}
        </div>
        {error && (
          <div role="alert" className="error">
            {error}
            <button onClick={() => setError("")}>닫기</button>
          </div>
        )}
        {notice && (
          <div role="status" className="toast">
            {notice}
          </div>
        )}
        <div aria-busy={busy} className={busy ? "saving" : ""}>
          {page === "대시보드" && (
            <>
              <section className="hero">
                <div>
                  <span className="eyebrow">FROM DISCOVERY TO DECISION</span>
                  <h2>
                    다음 기회는,
                    <br />
                    좋은 질문에서 시작됩니다.
                  </h2>
                  <p>
                    SNS의 발견을 기록하고, 반복 구매의 근거와
                    <br />
                    한국 시장에서의 가능성을 차근차근 검토하세요.
                  </p>
                  <button
                    className="primary"
                    onClick={() => nav("새로운 제품 발견")}
                  >
                    새로운 제품 발견하기 ↗
                  </button>
                </div>
                <div className="hero-art">
                  <span>DISCOVER</span>
                  <div>✧</div>
                  <span>RESEARCH → VALIDATE</span>
                </div>
              </section>
              <div className="stats">
                {[
                  ["저장한 후보", cs.length],
                  [
                    "조사·검증 중",
                    cs.filter((c) =>
                      ["조사 중", "시장 검증"].includes(c.fields.status),
                    ).length,
                  ],
                  [
                    "총판 검토",
                    cs.filter((c) => c.fields.status === "총판 검토").length,
                  ],
                  ["저장한 탐색 조건", state.searches.length],
                ].map(([t, n]) => (
                  <article key={t}>
                    <span>{t}</span>
                    <strong>
                      {n}
                      <small>건</small>
                    </strong>
                  </article>
                ))}
              </div>
              <div className="section-heading">
                <h2>
                  최근 검토 후보 <span>{cs.length}</span>
                </h2>
                <button onClick={() => nav("저장한 후보")}>전체 보기 →</button>
              </div>
              {cards(cs.slice(-3).reverse())}
              <section>
                <h2>최근 탐색 조건</h2>
                {!state.searches.length ? (
                  <p>탐색 화면에서 검색어와 조건을 저장해 보세요.</p>
                ) : (
                  state.searches
                    .slice(-5)
                    .reverse()
                    .map((f, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setFilters(JSON.parse(f.filters));
                          setQuery(f.query);
                          setTerms(f.terms);
                          setSearched(true);
                          setPage(f.page);
                        }}
                      >
                        {f.query || "새로운 제품"} · {f.savedAt} →
                      </button>
                    ))
                )}
              </section>
            </>
          )}
          {(page === "새로운 제품 발견" || wanted) && (
            <>
              <section>
                <h2>
                  {wanted
                    ? "어떤 제품군을 찾고 있나요?"
                    : "발견의 범위를 정해 보세요"}
                </h2>
                <p>
                  시연 후보 필터와 외부 검색 준비 도구입니다. 실제 SNS 검색
                  API는 연결되지 않았습니다.
                </p>
                {wanted && (
                  <>
                    <label>
                      제품군 입력
                      <input
                        placeholder="예: 친환경 주방세제"
                        value={query}
                        onChange={(e) => {
                          setQuery(e.target.value);
                          setSearched(false);
                        }}
                      />
                    </label>
                    <button
                      onClick={() => {
                        setTerms(expand(query).join("\n"));
                        setSearched(true);
                      }}
                    >
                      내장 사전으로 탐색어 제안
                    </button>
                    <label>
                      해외 탐색어 · 줄마다 추가·수정·삭제
                      <textarea
                        value={terms}
                        onChange={(e) => setTerms(e.target.value)}
                        placeholder="지원하지 않는 제품군은 해외 검색어를 직접 입력하세요."
                      />
                    </label>
                    <small>
                      내장 사전·템플릿 제안이며 AI 번역·분석이 아닙니다. 사전
                      예: 커피, 반려동물, 화장품, 정수필터, 원예, 프린터.
                    </small>
                  </>
                )}
                <div className="form-grid">
                  {Object.entries({
                    platform: [
                      "플랫폼",
                      "전체",
                      "인스타그램",
                      "틱톡",
                      "유튜브",
                    ],
                    category: ["카테고리", "전체", ...state.categories],
                    authorType: ["콘텐츠 작성자", "전체", ...authorTypes],
                    repeat: ["반복 구매 유형", "전체", ...repeatTypes],
                    language: [
                      "콘텐츠 언어",
                      "전체",
                      "영어",
                      "일본어",
                      "독일어",
                      "한국어",
                    ],
                    period: ["콘텐츠 기간", "전체", "7", "30", "90"],
                    topic: [
                      "탐색 주제",
                      "전체",
                      "신제품",
                      "재구매",
                      "리필",
                      "작업용 소모품",
                      "장비 유지관리",
                    ],
                  }).map(([key, [title, ...opts]]) => (
                    <label key={key}>
                      {title}
                      <select
                        value={filters[key]}
                        onChange={(e) => {
                          setFilters({ ...filters, [key]: e.target.value });
                          setSearched(false);
                        }}
                      >
                        {opts.map((o) => (
                          <option key={o} value={o}>
                            {key === "period" && o !== "전체"
                              ? `최근 ${o}일`
                              : o}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                  <label>
                    대상 구매자 시장
                    <input
                      value={filters.audienceMarket ?? ""}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          audienceMarket: e.target.value,
                        })
                      }
                      placeholder="예: 미국 (미확인은 일치하지 않음)"
                    />
                  </label>
                </div>
                <div className="actions">
                  <button className="primary" onClick={() => setSearched(true)}>
                    시연·저장 후보 탐색
                  </button>
                  <button
                    onClick={() =>
                      void commit({
                        ...state,
                        searches: [
                          ...state.searches,
                          {
                            query,
                            terms,
                            filters: JSON.stringify(filters),
                            page,
                            savedAt: today(),
                          },
                        ],
                      })
                    }
                  >
                    검색어·조건 저장
                  </button>
                  <button
                    onClick={() => {
                      setEditing(undefined);
                      setModal("candidate");
                    }}
                  >
                    직접 후보 등록
                  </button>
                </div>
                <div className="external">
                  <strong>플랫폼에서 직접 찾기</strong>
                  {(wanted
                    ? terms
                    : filters.topic === "전체"
                      ? "new products refill"
                      : filters.topic
                  )
                    .split("\n")
                    .filter(Boolean)
                    .map((t, i) => (
                      <div className="row" key={i}>
                        <span>{t}</span>
                        <div>
                          <button onClick={() => void copy(t)}>
                            검색어 복사
                          </button>
                          {providers
                            .filter((p) => ["틱톡", "유튜브"].includes(p.name))
                            .map((p) => (
                              <a
                                key={p.name}
                                href={p.searchLink!(t)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {p.name} ↗
                              </a>
                            ))}
                        </div>
                      </div>
                    ))}
                  <small>인스타그램은 검색어를 복사해 앱에서 검색하세요.</small>
                </div>
              </section>
              {searched && (
                <>
                  <div className="section-heading">
                    <h2>
                      {mode === "demo" ? "시연" : "저장된 사용자"} 탐색 결과
                    </h2>
                    <button onClick={() => setGrouped(!grouped)}>
                      {grouped ? "콘텐츠 목록 보기" : "제품·브랜드 묶음 보기"}
                    </button>
                  </div>
                  {wanted && !expand(query).length && (
                    <p className="banner">
                      내장 사전에 없는 제품군입니다. 무관한 시연 후보를 반환하지
                      않습니다. 해외 검색어 입력, 플랫폼 이동 또는 직접 후보·SNS
                      링크 등록을 이용하세요.
                    </p>
                  )}
                  {!results.length && (
                    <p className="empty">
                      일치하는 후보가 없습니다. 조건을 넓히거나 직접 후보를
                      등록하세요. 시연 콘텐츠의 게시일·구매자 시장은
                      미확인입니다.
                    </p>
                  )}
                  {grouped ? (
                    cards(
                      results.filter(
                        (c) =>
                          !filters.audienceMarket ||
                          state.contents.some(
                            (x) =>
                              x.candidateId === c.id &&
                              x.fields.audienceMarket ===
                                filters.audienceMarket,
                          ),
                      ),
                    )
                  ) : (
                    <div className="cards">
                      {state.contents
                        .filter(
                          (x) =>
                            results.some((c) => c.id === x.candidateId) &&
                            (!filters.audienceMarket ||
                              x.fields.audienceMarket ===
                                filters.audienceMarket),
                        )
                        .map((x) => (
                          <article key={x.id}>
                            <span className="tag">
                              {x.mode === "demo" ? "시연" : "수동"}
                            </span>
                            <h3>{x.fields.title}</h3>
                            <p>
                              {x.fields.platform} · {x.fields.authorType}
                            </p>
                            <Link url={x.fields.url} label="원문 보기" />
                            <button
                              onClick={() => {
                                setSelected(x.candidateId);
                                setPage("저장한 후보");
                              }}
                            >
                              연결 후보 보기 →
                            </button>
                          </article>
                        ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {page === "저장한 후보" && (
            <>
              <div className="toolbar">
                <input
                  aria-label="후보 검색"
                  placeholder="제품명, 브랜드, 태그 검색"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <select
                  aria-label="상태 필터"
                  value={listStatus}
                  onChange={(e) => setListStatus(e.target.value)}
                >
                  {["전체", ...statuses].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                <select
                  aria-label="정렬"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  {["최근 등록", "이름순", "상태순"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                <button
                  className="primary"
                  onClick={() => {
                    setEditing(undefined);
                    setModal("candidate");
                  }}
                >
                  + 후보 등록
                </button>
                <button onClick={() => setShowCompare(!showCompare)}>
                  비교 ({compare.length}/4)
                </button>
              </div>
              {showCompare && (
                <section className="comparison">
                  <h2>후보 비교 · 종합 점수 없이 근거별 검토</h2>
                  {compare.length < 2 ? (
                    <p>카드에서 후보 2~4개를 선택하세요.</p>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>검토 항목</th>
                          {cs
                            .filter((c) => compare.includes(c.id))
                            .map((c) => (
                              <th key={c.id}>{c.fields.name}</th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {productSpec
                          .filter(([k]) =>
                            [
                              "problem",
                              "snsEvidence",
                              "repeatEvidence",
                              "competition",
                              "channel",
                              "distribution",
                              "profitability",
                              "evidence",
                              "next",
                            ].includes(k),
                          )
                          .map(([k, t]) => (
                            <tr key={k}>
                              <th>{t}</th>
                              {cs
                                .filter((c) => compare.includes(c.id))
                                .map((c) => (
                                  <td key={c.id}>{val(c.fields[k])}</td>
                                ))}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  )}
                </section>
              )}
              {selected && active ? (
                <>
                  <button onClick={() => setSelected("")}>← 목록으로</button>
                  <section>
                    <div className="section-heading">
                      <div>
                        <span className="tag">
                          {mode === "demo" ? "시연 · 가상 제품" : "사용자 입력"}
                        </span>
                        <h2>
                          {active.fields.brand} / {active.fields.name}
                        </h2>
                      </div>
                      <div>
                        <button
                          onClick={() => {
                            setEditing(active);
                            setModal("candidate");
                          }}
                        >
                          후보 편집
                        </button>
                        <button
                          className="danger"
                          onClick={() => void deleteCandidate(active)}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                    <dl>
                      {productSpec.map(([k, t]) => (
                        <React.Fragment key={k}>
                          <dt>{t}</dt>
                          <dd>
                            {k === "website" ? (
                              <Link url={active.fields[k]} />
                            ) : (
                              val(active.fields[k])
                            )}
                          </dd>
                        </React.Fragment>
                      ))}
                    </dl>
                    <div className="actions">
                      <button
                        onClick={() => {
                          setEditingContent("");
                          setModal("content");
                        }}
                      >
                        + SNS 링크·콘텐츠 등록
                      </button>
                      <button onClick={() => setPage("시장 검증")}>
                        시장 검증으로 →
                      </button>
                      <button onClick={() => setPage("총판 검토")}>
                        총판 검토로 →
                      </button>
                    </div>
                  </section>
                  <h2>연결된 콘텐츠</h2>
                  {state.contents
                    .filter((c) => c.candidateId === active.id)
                    .map((c) => (
                      <article key={c.id}>
                        <div className="row">
                          <h3>{c.fields.title}</h3>
                          <span className="tag">{c.fields.source}</span>
                        </div>
                        <Link url={c.fields.url} label="원문 열기" />
                        <dl>
                          {contentSpec
                            .filter(([k]) => k !== "url")
                            .map(([k, t]) => (
                              <React.Fragment key={k}>
                                <dt>{t}</dt>
                                <dd>{val(c.fields[k])}</dd>
                              </React.Fragment>
                            ))}
                        </dl>
                        <button
                          onClick={() => {
                            setEditingContent(c.id);
                            setModal("content");
                          }}
                        >
                          콘텐츠 편집
                        </button>
                        <label>
                          다른 후보에 연결
                          <select
                            value={c.candidateId}
                            onChange={(e) =>
                              void commit({
                                ...state,
                                contents: state.contents.map((x) =>
                                  x.id === c.id
                                    ? { ...x, candidateId: e.target.value }
                                    : x,
                                ),
                              })
                            }
                          >
                            {cs.map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.fields.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          onClick={() => {
                            if (confirm("콘텐츠를 삭제할까요?"))
                              void commit({
                                ...state,
                                contents: state.contents.filter(
                                  (x) => x.id !== c.id,
                                ),
                              });
                          }}
                        >
                          콘텐츠 삭제
                        </button>
                      </article>
                    ))}
                </>
              ) : (
                cards(
                  cs
                    .filter(
                      (c) =>
                        `${c.fields.name} ${c.fields.brand} ${c.fields.tags}`
                          .toLowerCase()
                          .includes(q.toLowerCase()) &&
                        (listStatus === "전체" ||
                          c.fields.status === listStatus),
                    )
                    .sort((a, b) =>
                      sort === "이름순"
                        ? a.fields.name.localeCompare(b.fields.name)
                        : sort === "상태순"
                          ? statuses.indexOf(a.fields.status) -
                            statuses.indexOf(b.fields.status)
                          : state.candidates.indexOf(b) -
                            state.candidates.indexOf(a),
                    ),
                )
              )}
              {!cs.length && (
                <p className="empty">
                  후보가 없습니다. 후보 등록으로 첫 제품을 기록하세요.
                </p>
              )}
            </>
          )}
          {page === "시장 검증" && (
            <>
              {picker}
              <section>
                <h2>제품군 수요와 브랜드 인지도를 구분하세요</h2>
                <p>
                  국내 검색량이 낮아도 자동 탈락시키지 않습니다. 외부 서비스
                  결과는 직접 확인하고 기록하세요.
                </p>
                <div className="actions">
                  {[
                    ["네이버 데이터랩", "https://datalab.naver.com/"],
                    ["네이버 키워드 도구", "https://searchad.naver.com/"],
                    ["아이템스카우트", "https://itemscout.io/"],
                    ["구글 트렌드", "https://trends.google.com/trends/"],
                  ].map(([name, url]) => (
                    <a key={name} href={url} target="_blank" rel="noreferrer">
                      {name} ↗
                    </a>
                  ))}
                  <button
                    onClick={() =>
                      void copy(
                        active?.fields.group || active?.fields.name || "",
                      )
                    }
                  >
                    제품군 검색어 복사
                  </button>
                  <button onClick={() => void copy(active?.fields.brand || "")}>
                    브랜드 검색어 복사
                  </button>
                </div>
              </section>
              {active ? (
                <>
                  <section>
                    <h2>조사 기록 추가</h2>
                    <Form
                      key={active.id}
                      spec={marketSpec}
                      initial={{
                        date: today(),
                        service: "네이버 데이터랩",
                        metric: "검색량",
                        productQuery: active.fields.group ?? "",
                        brandQuery: active.fields.brand ?? "",
                      }}
                      onSave={(f) => void entry("market", f)}
                    >
                      <label>
                        시계열 CSV (선택) · date,value / 날짜, 0 이상 숫자
                        <textarea
                          value={csv}
                          placeholder={
                            "date,value\n2026-01-01,20\n2026-02-01,35"
                          }
                          onChange={(e) => setCsv(e.target.value)}
                        />
                      </label>
                      <label>
                        CSV 파일 가져오기
                        <input
                          type="file"
                          accept=".csv,text/csv"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void file.text().then(setCsv);
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          download(
                            "date,value\n2026-01-01,20\n2026-02-01,35",
                            "series-template.csv",
                            "text/csv",
                          )
                        }
                      >
                        지원 양식 다운로드
                      </button>
                      <p>
                        모든 서비스의 원본 파일을 자동 해석하지 않습니다. 지표와
                        관측 기간은 직접 지정하세요.
                      </p>
                    </Form>
                  </section>
                  {history("market")}
                </>
              ) : (
                <p className="empty">먼저 후보를 등록하세요.</p>
              )}
            </>
          )}
          {page === "총판 검토" && (
            <>
              {picker}
              {active ? (
                <>
                  <section>
                    <h2>총판·수입 조건</h2>
                    <p>
                      판매처 검색 결과가 없다는 사실만으로 총판권 확보 가능성을
                      판단하지 않습니다. 연락 기록만 관리하며 메시지를 발송하지
                      않습니다.
                    </p>
                    <Link url={active.fields.website} label="제조사 홈페이지" />
                    <Form
                      key={active.id}
                      spec={distributionSpec}
                      initial={{
                        rights: "미확인",
                        ...pickFields(active.fields, distributionSpec),
                      }}
                      onSave={(f) =>
                        void commit({
                          ...state,
                          candidates: state.candidates.map((c) =>
                            c.id === active.id
                              ? { ...c, fields: { ...c.fields, ...f } }
                              : c,
                          ),
                        })
                      }
                    />
                  </section>
                  <section>
                    <h2>입력 가정에 따른 수익 계산</h2>
                    <p>
                      모든 비용·환율은 사용자 입력값입니다. 판매가·비용은 부가세
                      제외 기준이며, 회수 가능 부가세는 비용에 포함하지
                      않습니다. 관세·세금 자동 판정은 제공하지 않습니다. 비용이
                      없으면 0을 명시하세요.
                    </p>
                    <CostForm
                      key={active.id}
                      fields={active.fields}
                      onSave={(f) =>
                        void commit({
                          ...state,
                          candidates: state.candidates.map((c) =>
                            c.id === active.id
                              ? { ...c, fields: { ...c.fields, ...f } }
                              : c,
                          ),
                        })
                      }
                    />
                  </section>
                  <section>
                    <h2>접촉 기록</h2>
                    <Form
                      key={active.id}
                      spec={contactSpec}
                      initial={{ date: today() }}
                      onSave={(f) => void entry("contact", f)}
                    />
                  </section>
                  {history("contact")}
                  <section>
                    <h2>판매 테스트 기록</h2>
                    <p>
                      실제 주문 연동 없이 직접 기록합니다. 누락 비용이 있는
                      손익은 잠정치로 표시합니다.
                    </p>
                    <Form
                      key={active.id}
                      spec={saleSpec}
                      initial={{ date: today() }}
                      onSave={(f) => void entry("sale", f)}
                    />
                  </section>
                  {history("sale")}
                </>
              ) : (
                <p className="empty">검토할 후보를 먼저 등록하세요.</p>
              )}
            </>
          )}
          {page === "설정·데이터 관리" && (
            <>
              <section>
                <h2>외부 연결 상태</h2>
                <p>
                  이번 버전은 API 키를 입력·저장하지 않습니다. 향후 서버 측
                  연결을 추가할 수 있도록 공급자 인터페이스를 분리했습니다.
                </p>
                {providers.map((p) => (
                  <div className="connection" key={p.name}>
                    <strong>{p.name}</strong>
                    <span className="pill">{p.status}</span>
                    <small>
                      {p.status === "연결됨"
                        ? "로컬 수동 기록 사용 가능"
                        : "추후 공식 API·서버 연결 필요"}
                    </small>
                  </div>
                ))}
              </section>
              <section>
                <h2>카테고리 관리</h2>
                <p>{state.categories.join(" · ")}</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const el = e.currentTarget.elements.namedItem(
                      "category",
                    ) as HTMLInputElement;
                    const category = el.value.trim();
                    if (category && !state.categories.includes(category))
                      void commit({
                        ...state,
                        categories: [...state.categories, category],
                      });
                    el.value = "";
                  }}
                >
                  <label>
                    사용자 카테고리
                    <input name="category" required />
                  </label>
                  <button>카테고리 추가</button>
                </form>
              </section>
              <section>
                <h2>백업·복원</h2>
                <p>
                  데이터는 현재 브라우저의 IndexedDB에 저장됩니다. 브라우저
                  데이터 삭제·기기 변경 시 기록이 사라질 수 있으므로 JSON 백업을
                  보관하세요.
                </p>
                <div className="actions">
                  <button
                    className="primary"
                    onClick={() =>
                      download(
                        JSON.stringify(state, null, 2),
                        "marketing-trend-backup.json",
                        "application/json",
                      )
                    }
                  >
                    JSON 전체 내보내기
                  </button>
                  <button
                    onClick={() =>
                      download(candidateCsv(cs), "candidates.csv", "text/csv")
                    }
                  >
                    현재 모드 후보 CSV 내보내기
                  </button>
                </div>
                <label>
                  JSON 전체 복원 (검증 후 덮어쓰기 확인)
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => {
                      void restore(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </section>
              <section>
                <h2>시연 데이터 관리</h2>
                <p>
                  시연 삭제는 사용자 후보·콘텐츠·조사 기록을 보존합니다. 삭제 후
                  새로고침해도 자동 복원하지 않습니다.
                </p>
                <button
                  className="danger"
                  disabled={state.demoDeleted}
                  onClick={() => {
                    if (
                      !confirm(
                        "시연 데이터만 삭제할까요? 사용자 데이터는 보존됩니다.",
                      )
                    )
                      return;
                    const ids = new Set(
                      state.candidates
                        .filter((c) => c.mode === "demo")
                        .map((c) => c.id),
                    );
                    void commit({
                      ...state,
                      candidates: state.candidates.filter(
                        (c) => c.mode !== "demo",
                      ),
                      contents: state.contents.filter((c) => c.mode !== "demo"),
                      entries: state.entries.filter(
                        (e) => !ids.has(e.candidateId),
                      ),
                      demoDeleted: true,
                    });
                  }}
                >
                  시연 데이터 삭제
                </button>
                {state.demoDeleted && (
                  <button
                    onClick={() => {
                      const demo = initialState();
                      void commit({
                        ...state,
                        candidates: [...state.candidates, ...demo.candidates],
                        contents: [...state.contents, ...demo.contents],
                        demoDeleted: false,
                      });
                    }}
                  >
                    시연 데이터 다시 추가
                  </button>
                )}
              </section>
            </>
          )}
        </div>
        <footer>
          MARKETING TREND · PRIVATE RESEARCH WORKSPACE{" "}
          <span>발견 → 근거 → 판단</span>
        </footer>
      </main>
      {modal && (
        <div className="modal-backdrop">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "candidate" ? "후보 등록·편집" : "콘텐츠 등록"
            }
            className="modal"
          >
            <div className="section-heading">
              <h2>
                {modal === "candidate"
                  ? editing
                    ? "후보 편집"
                    : "후보 등록"
                  : "SNS 링크·콘텐츠 등록"}
              </h2>
              <button onClick={() => setModal(null)}>닫기</button>
            </div>
            <p>
              {mode === "demo"
                ? "시연 모드에 저장합니다. 실제 작업은 사용자 작업으로 전환하세요."
                : "사용자 데이터로 저장합니다."}{" "}
              제품이 불확실하면 제품명에 ‘임시 후보’를 표시하고 나중에
              편집하세요.
            </p>
            {modal === "candidate" ? (
              <Form
                key={editing?.id ?? "new"}
                spec={productSpec}
                initial={
                  editing?.fields ?? {
                    status: "발견",
                    repeat: "미확인",
                    evidence: "미확인",
                  }
                }
                onSave={(f) => void saveCandidate(f)}
              />
            ) : active ? (
              <Form
                key={editingContent || "new-content"}
                spec={contentSpec}
                initial={
                  state.contents.find((c) => c.id === editingContent)
                    ?.fields ?? {
                    observed: today(),
                    platform: "인스타그램",
                    authorType: "미확인",
                    sponsorship: "미확인",
                  }
                }
                onSave={(f) => void saveContent(f)}
              />
            ) : (
              <p>먼저 후보를 등록하세요.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function CostForm({
  fields,
  onSave,
}: {
  fields: Fields;
  onSave: (f: Fields) => void;
}) {
  const [f, set] = useState(() => pickFields(fields, costSpec));
  const p = profit(f);
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(f);
        }}
      >
        <div className="form-grid">
          {costSpec.map(([k, t, type]) => (
            <label key={k}>
              {t}
              <input
                type={type ?? "text"}
                min={type === "number" ? 0 : undefined}
                max={k === "fee" ? 100 : undefined}
                step="any"
                value={f[k] ?? ""}
                onChange={(e) => set({ ...f, [k]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <button className="primary">계산 가정 저장</button>
      </form>
      {p ? (
        <div className="calculation">
          <p>
            단위 배분 매입원가: {money(p.cost)}원 = 매입 단가 × 환율 + (국제운임
            + 보험 + 관세·통관 + 기타) ÷ 수량
          </p>
          <p>
            단위 판매 비용: {money(p.selling)}원 = 판매가 × 수수료율 + 배송 +
            광고 + 반품 비용
          </p>
          <strong>
            단위당 예상 이익 {money(p.gain)}원 · 이익률{" "}
            {p.margin === null ? "계산 불가" : money(p.margin) + "%"}
          </strong>
        </div>
      ) : (
        <p className="banner">
          계산에 필요한 값을 모두 입력하세요. 발주 수량·환율은 0보다 커야 하며
          수수료는 0~100%입니다. 누락값을 0으로 간주하지 않습니다.
        </p>
      )}
    </>
  );
}
function SaleResult({ fields }: { fields: Fields }) {
  const r = saleResult(fields);
  return (
    <div className="calculation">
      전환율: {r.conversion === null ? "계산 불가" : money(r.conversion) + "%"}{" "}
      · {r.provisional ? "잠정 손익 (누락 비용 있음)" : "입력 내역 기준 손익"}:{" "}
      {money(r.gain)}원
    </div>
  );
}
