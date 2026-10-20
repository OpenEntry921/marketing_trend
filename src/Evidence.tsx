import YoutubeImport from "./YoutubeImport";
import React, { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  normalizeUrl,
  uid,
  type Candidate,
  type Content,
  type Fields,
  type State,
} from "./domain";
import {
  aiConditions,
  aiSummary,
  checkItems,
  checkStatuses,
  commentCategories,
  confirmed,
  emptyMetrics,
  latest,
  metricKeys,
  metricLabels,
  metricStatuses,
  ordered,
  reactionStats,
  zonedTime,
  type AiRecord,
  type CommentEvidence,
  type MetricKey,
  type Observation,
  type SiteReview,
} from "./research";
type Commit = (s: State) => Promise<boolean>;
type Spec = [string, string, string?];
const unknown = (v: number | null) =>
  v === null
    ? "계산 불가"
    : v.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
function SafeLink({ url }: { url: string }) {
  return normalizeUrl(url) ? (
    <a href={normalizeUrl(url)} target="_blank" rel="noreferrer">
      {url} ↗
    </a>
  ) : (
    <span>{url || "미확인"}</span>
  );
}
export function EvidenceForm({
  spec,
  initial = {},
  onSave,
  children,
  label = "기록 저장",
}: {
  spec: Spec[];
  initial?: Fields;
  onSave: (f: Fields) => void;
  children?: React.ReactNode;
  label?: string;
}) {
  const [f, set] = useState<Fields>(() => ({
    ...Object.fromEntries(
      spec
        .filter(([, , t]) => t?.includes("|"))
        .map(([k, , t]) => [k, t!.split("|")[0]]),
    ),
    ...initial,
  }));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(f);
      }}
    >
      <div className="form-grid">
        {spec.map(([k, title, type]) => (
          <label key={k}>
            {title}
            {type?.includes("|") ? (
              <select
                aria-label={title}
                value={f[k] ?? ""}
                onChange={(e) => set({ ...f, [k]: e.target.value })}
              >
                {type.split("|").map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            ) : type === "textarea" ? (
              <textarea
                aria-label={title}
                value={f[k] ?? ""}
                onChange={(e) => set({ ...f, [k]: e.target.value })}
              />
            ) : (
              <input
                aria-label={title}
                required={type === "required"}
                type={type === "required" ? "text" : (type ?? "text")}
                step="any"
                min={type === "number" ? 0 : undefined}
                value={f[k] ?? ""}
                onChange={(e) => set({ ...f, [k]: e.target.value })}
              />
            )}
          </label>
        ))}
      </div>
      {children}
      <button className="primary">{label}</button>
    </form>
  );
}
function FieldList({ fields }: { fields: Fields }) {
  return (
    <dl>
      {Object.entries(fields).map(([k, v]) => (
        <React.Fragment key={k}>
          <dt>{k}</dt>
          <dd>
            {(v || "미확인").split("\n").map((line, i) => (
              <React.Fragment key={i}>
                {/^https?:\/\//.test(line) ? <SafeLink url={line} /> : line}
                {i < (v || "미확인").split("\n").length - 1 && <br />}
              </React.Fragment>
            ))}
          </dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
const now = () => new Date().toISOString();
export function ContentCollection({
  state,
  candidateId,
  render,
}: {
  state: State;
  candidateId: string;
  render: (c: Content) => React.ReactNode;
}) {
  const [platform, sp] = useState("전체"),
    [format, sf] = useState("전체"),
    [published, sb] = useState(""),
    [observed, so] = useState(""),
    [sort, ss] = useState("recent");
  const contents = state.contents
    .filter(
      (c) =>
        c.candidateId === candidateId &&
        (platform === "전체" || c.fields.platform === platform) &&
        (format === "전체" || c.fields.format === format) &&
        (!published ||
          (!!c.fields.published && c.fields.published >= published)) &&
        (!observed ||
          (!!latest(state.observations.filter((o) => o.contentId === c.id))
            ?.observedAt &&
            latest(state.observations.filter((o) => o.contentId === c.id))!
              .observedAt! >= observed)),
    )
    .sort((a, b) => {
      const ao = latest(state.observations.filter((o) => o.contentId === a.id)),
        bo = latest(state.observations.filter((o) => o.contentId === b.id));
      if (sort === "recent")
        return (
          (Date.parse(bo?.observedAt || bo?.originalObserved || "") || 0) -
          (Date.parse(ao?.observedAt || ao?.originalObserved || "") || 0)
        );
      const av = confirmed(ao, sort as MetricKey),
        bv = confirmed(bo, sort as MetricKey);
      return av === null ? (bv === null ? 0 : 1) : bv === null ? -1 : bv - av;
    });
  return (
    <>
      <div className="form-grid">
        <label>
          콘텐츠 플랫폼 필터
          <select
            aria-label="콘텐츠 플랫폼 필터"
            value={platform}
            onChange={(e) => sp(e.target.value)}
          >
            {["전체", "유튜브", "인스타그램", "틱톡", "기타"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          콘텐츠 형식 필터
          <select
            aria-label="콘텐츠 형식 필터"
            value={format}
            onChange={(e) => sf(e.target.value)}
          >
            {["전체", "일반 영상", "숏폼", "이미지", "기타", "미확인"].map(
              (x) => (
                <option key={x}>{x}</option>
              ),
            )}
          </select>
        </label>
        <label>
          게시일 시작
          <input
            type="date"
            value={published}
            onChange={(e) => sb(e.target.value)}
          />
        </label>
        <label>
          최신 관측일 시작
          <input
            type="date"
            value={observed}
            onChange={(e) => so(e.target.value)}
          />
        </label>
        <label>
          콘텐츠 지표 정렬
          <select
            aria-label="콘텐츠 지표 정렬"
            value={sort}
            onChange={(e) => ss(e.target.value)}
          >
            <option value="recent">최근 관측순</option>
            {metricKeys.map((k) => (
              <option key={k} value={k}>
                {metricLabels[k]} 내림차순
              </option>
            ))}
          </select>
        </label>
      </div>
      <p>
        미확인 값은 정렬 마지막에 표시합니다. 플랫폼별 지표 정의가 달라
        합산하거나 종합점수로 비교하지 않습니다. 평소 성과 대비 비교는 비교
        표본이 없어 제공하지 않습니다.
      </p>
      {!contents.length && <p>조건에 맞는 콘텐츠가 없습니다.</p>}
      {contents.map(render)}
    </>
  );
}
export function ContentMetrics({
  state,
  content,
  commit,
}: {
  state: State;
  content: Content;
  commit: Commit;
}) {
  const observations = ordered(
    state.observations.filter((o) => o.contentId === content.id),
  );
  const current = observations.at(-1),
    previous = observations.at(-2),
    stats = reactionStats(current, previous);
  const [metric, setMetric] = useState<MetricKey>("views");
  const [error, se] = useState("");
  const [metrics, sm] = useState(emptyMetrics);
  const [time, st] = useState(now);
  const [source, ss] = useState(content.fields.url ?? "");
  const [method, sMethod] = useState<"수동" | "외부 제공업체">("수동");
  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (!zonedTime(time))
        throw Error("시간대가 포함된 ISO 일시를 입력하세요.");
      if (!source.trim()) throw Error("출처를 입력하세요.");
      for (const m of Object.values(metrics))
        if (
          m.status === "확인됨" &&
          (m.value === null || !Number.isFinite(m.value) || m.value < 0)
        )
          throw Error("확인된 지표는 0 이상의 값을 입력하세요.");
      const o: Observation = {
        id: uid(),
        contentId: content.id,
        mode: content.mode,
        observedAt: time,
        originalObserved: "",
        method: content.mode === "demo" ? "시연" : method,
        source,
        metrics: structuredClone(metrics),
      };
      if (
        await commit({ ...state, observations: [...state.observations, o] })
      ) {
        se("");
        st(now());
        sm(emptyMetrics());
      }
    } catch (e) {
      se(String(e));
    }
  }
  return (
    <>
      <YoutubeImport state={state} content={content} commit={commit} />
      <h4>최신 반응 지표 · {content.mode === "demo" ? "시연" : "입력 기록"}</h4>
      <p>
        최근 관측:{" "}
        {current?.observedAt ||
          (current?.originalObserved
            ? current.originalObserved + " · 정확한 시각·시간대 미확인"
            : "미확인")}{" "}
        · 수집 방식: {current?.method ?? "미확인"}
      </p>
      <div className="metric-grid">
        {metricKeys.map((k) => (
          <div key={k}>
            <small>{metricLabels[k]}</small>
            <strong>
              {current?.metrics[k].status === "확인됨"
                ? current.metrics[k].value?.toLocaleString("ko-KR")
                : (current?.metrics[k].status ?? "미확인")}
            </strong>
            <small>{current?.metrics[k].reason}</small>
          </div>
        ))}
      </div>
      <p>
        좋아요 비율: {unknown(stats.likeRate)}
        {stats.likeRate !== null && "%"} · 댓글 비율:{" "}
        {unknown(stats.commentRate)}
        {stats.commentRate !== null && "%"}
      </p>
      <p>
        조회수 순증감: {unknown(stats.delta)} · 일평균 순증감:{" "}
        {unknown(stats.daily)} · 관측 간 증가율: {unknown(stats.growth)}
        {stats.growth !== null && "%"}
      </p>
      {stats.delta !== null && stats.delta < 0 && (
        <p className="banner">
          실제 순감소입니다. 플랫폼 데이터 정정·삭제 등의 가능성을 확인하세요.
        </p>
      )}
      <details>
        <summary>
          관측 이력 ({observations.length}) · 차트·원래 지표 정의
        </summary>
        <label>
          추이 지표
          <select
            aria-label="추이 지표"
            value={metric}
            onChange={(e) => setMetric(e.target.value as MetricKey)}
          >
            {metricKeys.map((k) => (
              <option key={k} value={k}>
                {metricLabels[k]}
              </option>
            ))}
          </select>
        </label>
        <p>
          {content.mode === "demo" ? "시연 차트 · 가상 수치" : "관측 기록 기준"}{" "}
          · 정확한 관측 시각이 없는 이전 자료는 속도 계산에서 제외합니다.
        </p>
        <div className="chart">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={observations.map((o) => ({
                time: o.observedAt || o.originalObserved || "시각 미확인",
                value: confirmed(o, metric),
              }))}
            >
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line dataKey="value" stroke="#25756c" connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>관측 시각</th>
                <th>수집·출처</th>
                {metricKeys.map((k) => (
                  <th key={k}>{metricLabels[k]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {observations.map((o) => (
                <tr key={o.id}>
                  <td>
                    {o.observedAt || o.originalObserved || "미확인"}
                    {!o.observedAt && " (정확한 시각 미확인)"}
                  </td>
                  <td>
                    {o.mode === "demo" ? "시연 · " : ""}
                    {o.method}
                    <br />
                    <SafeLink url={o.source} />
                  </td>
                  {metricKeys.map((k) => (
                    <td key={k}>
                      {o.metrics[k].value ?? o.metrics[k].status}
                      <br />
                      <small>
                        {o.metrics[k].originalName} · {o.metrics[k].definition}{" "}
                        {o.metrics[k].reason}
                      </small>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <details>
        <summary>관측 기록 추가 · 과거 값 보존</summary>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <form onSubmit={(e) => void add(e)}>
          <div className="form-grid">
            <label>
              관측 시각 (시간대 포함)
              <input
                required
                value={time}
                onChange={(e) => st(e.target.value)}
                placeholder="2026-10-20T12:00:00+09:00"
              />
            </label>
            <label>
              관측 출처
              <input
                required
                value={source}
                onChange={(e) => ss(e.target.value)}
              />
            </label>
            <label>
              수집 방식
              <select
                aria-label="수집 방식"
                value={sMethodValue(content.mode, method)}
                onChange={(e) => sMethod(e.target.value as typeof method)}
              >
                {(content.mode === "demo"
                  ? ["시연"]
                  : ["수동", "외부 제공업체"]
                ).map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          </div>
          {metricKeys.map((k) => (
            <fieldset key={k}>
              <legend>{metricLabels[k]}</legend>
              <div className="form-grid">
                <label>
                  {metricLabels[k]} 상태
                  <select
                    aria-label={`${metricLabels[k]} 상태`}
                    value={metrics[k].status}
                    onChange={(e) =>
                      sm({
                        ...metrics,
                        [k]: {
                          ...metrics[k],
                          status: e.target
                            .value as (typeof metrics)[typeof k]["status"],
                          value:
                            e.target.value === "확인됨"
                              ? metrics[k].value
                              : null,
                        },
                      })
                    }
                  >
                    {metricStatuses.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label>
                  {metricLabels[k]} 값
                  <input
                    type="number"
                    min="0"
                    step="any"
                    disabled={metrics[k].status !== "확인됨"}
                    value={metrics[k].value ?? ""}
                    onChange={(e) =>
                      sm({
                        ...metrics,
                        [k]: {
                          ...metrics[k],
                          value:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
                <label>
                  {metricLabels[k]} 원래 지표명
                  <input
                    value={metrics[k].originalName}
                    onChange={(e) =>
                      sm({
                        ...metrics,
                        [k]: { ...metrics[k], originalName: e.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  {metricLabels[k]} 정의
                  <input
                    value={metrics[k].definition}
                    onChange={(e) =>
                      sm({
                        ...metrics,
                        [k]: { ...metrics[k], definition: e.target.value },
                      })
                    }
                  />
                </label>
              </div>
            </fieldset>
          ))}
          <button className="primary">관측 추가</button>
        </form>
      </details>
      <CommentPanel state={state} content={content} commit={commit} />
    </>
  );
}
const sMethodValue = (mode: string, method: string) =>
  mode === "demo" ? "시연" : method;
const commentSpec: Spec[] = [
  ["excerpt", "댓글 발췌문", "required"],
  ["source", "댓글 출처 링크", "url"],
  ["checked", "댓글 확인일", "date"],
  ["sampleSize", "확인한 표본 수", "number"],
  ["selection", "표본 선정 방식", "required"],
  ["notes", "댓글 사용자 메모", "textarea"],
];
function CommentPanel({
  state,
  content,
  commit,
}: {
  state: State;
  content: Content;
  commit: Commit;
}) {
  const [editing, se] = useState<CommentEvidence>();
  const [cats, sc] = useState<string[]>([commentCategories[0]]);
  const [error, sError] = useState("");
  const rows = state.commentEvidence.filter((c) => c.contentId === content.id);
  return (
    <details>
      <summary>댓글 근거 ({rows.length}) · 수동 분류</summary>
      <p>
        확인한 댓글 표본 기준입니다. 댓글 전체 수와 표본 수는 다릅니다. 하나의
        댓글에 여러 분류를 붙일 수 있습니다. 구매 문의는 의향의 단서이며 사용
        경험은 작성자의 주장입니다. 실제 주문·검증된 구매로 집계하지 않습니다.
      </p>
      {rows.map((r) => (
        <article key={r.id}>
          <span className="tag">
            {r.mode === "demo" ? "시연" : "수동"} · 확인한 댓글 표본 기준
          </span>
          <p>{r.fields.excerpt}</p>
          <p>
            {r.categories.join(" · ")} · 표본 {r.fields.sampleSize || "미확인"}
            개 · 선정: {r.fields.selection}
          </p>
          <SafeLink url={r.fields.source} />
          <FieldList
            fields={{ 확인일: r.fields.checked, 메모: r.fields.notes }}
          />
          <button
            onClick={() => {
              se(r);
              sc(r.categories);
            }}
          >
            댓글 편집
          </button>
          <button
            onClick={() => {
              if (confirm("댓글 근거를 삭제할까요?"))
                void commit({
                  ...state,
                  commentEvidence: state.commentEvidence.filter(
                    (x) => x.id !== r.id,
                  ),
                });
            }}
          >
            댓글 삭제
          </button>
        </article>
      ))}
      <h4>{editing ? "댓글 근거 편집" : "댓글 근거 추가"}</h4>
      {error && <p role="alert">{error}</p>}
      <EvidenceForm
        key={editing?.id ?? "new"}
        spec={commentSpec}
        initial={
          editing?.fields ?? {
            checked: new Date().toISOString().slice(0, 10),
            sampleSize: "1",
          }
        }
        onSave={(f) => {
          if (!normalizeUrl(f.source ?? "")) {
            sError("댓글 출처 링크를 입력하세요.");
            return;
          }
          if (
            !Number.isSafeInteger(Number(f.sampleSize)) ||
            Number(f.sampleSize) < 1
          ) {
            sError("확인한 표본 수는 1 이상의 정수여야 합니다.");
            return;
          }
          if (!cats.length) {
            sError("분류를 하나 이상 선택하세요.");
            return;
          }
          const row: CommentEvidence = {
            id: editing?.id ?? uid(),
            contentId: content.id,
            mode: content.mode,
            fields: f,
            categories: cats,
          };
          void commit({
            ...state,
            commentEvidence: editing
              ? state.commentEvidence.map((x) =>
                  x.id === editing.id ? row : x,
                )
              : [...state.commentEvidence, row],
          }).then((ok) => {
            if (ok) {
              se(undefined);
              sc([commentCategories[0]]);
              sError("");
            }
          });
        }}
        label="댓글 근거 저장"
      >
        <fieldset>
          <legend>댓글 분류 (복수 선택)</legend>
          {commentCategories.map((c) => (
            <label key={c}>
              <input
                type="checkbox"
                checked={cats.includes(c)}
                onChange={(e) =>
                  sc(
                    e.target.checked
                      ? [...cats, c]
                      : cats.filter((x) => x !== c),
                  )
                }
              />
              {c}
            </label>
          ))}
        </fieldset>
      </EvidenceForm>
      {editing && (
        <button
          onClick={() => {
            se(undefined);
            sc([commentCategories[0]]);
          }}
        >
          편집 취소
        </button>
      )}
    </details>
  );
}
const siteSpec: Spec[] = [
  ["url", "점검 페이지 URL", "url"],
  ["title", "점검 페이지 제목", "required"],
  ["language", "페이지 언어"],
  ["checked", "페이지 확인일", "date"],
  ["problem", "홈페이지 문제", "textarea"],
  ["basis", "문제 확인 근거", "textarea"],
  ["recommendation", "권장 수정", "textarea"],
  ["progress", "개선 처리 상태", "미확인|할 일|진행 중|완료"],
];
const aiSpec: Spec[] = [
  ["question", "조사 질문 원문", "required"],
  ["service", "대상 AI 서비스", "required"],
  ["model", "모델 (확인 범위)"],
  ["surface", "관측 경로", "소비자용 화면|API 응답"],
  ["search", "검색 기능", "미확인|사용|미사용"],
  ["language", "응답 언어"],
  ["region", "지역 조건"],
  ["executedAt", "실행 시각 (시간대 포함)", "required"],
  ["execution", "실행 상태", "완료|실패|미실행"],
  ["answer", "답변 원문·발췌", "textarea"],
  ["mention", "브랜드·제품 언급", "미확인|예|아니오"],
  ["citation", "대상 도메인·페이지 인용", "미확인|예|아니오"],
  ["citationUrls", "인용 URL (줄마다)", "textarea"],
  ["competitors", "경쟁 브랜드"],
  ["errors", "사실 오류·확인 근거", "textarea"],
  ["next", "수정 과제", "textarea"],
];
export function SiteAiPanels({
  state,
  candidate,
  commit,
}: {
  state: State;
  candidate: Candidate;
  commit: Commit;
}) {
  const [site, ss] = useState<SiteReview>();
  const [ai, sa] = useState<AiRecord>();
  const [error, se] = useState("");
  const blankChecks = () =>
    Object.fromEntries(
      checkItems.map((k) => [k, { status: "미확인", evidence: "" }]),
    );
  const [checks, sc] = useState<SiteReview["checks"]>(blankChecks);
  const sites = state.siteReviews.filter((r) => r.candidateId === candidate.id),
    records = state.aiRecords.filter((r) => r.candidateId === candidate.id);
  const groups = new Map<string, AiRecord[]>();
  for (const r of records) {
    const key = aiConditions(r.fields);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return (
    <>
      <details>
        <summary>홈페이지 SEO·GEO 점검 ({sites.length})</summary>
        <p>
          수동 점검입니다. <SafeLink url={candidate.fields.website ?? ""} /> ·
          noindex가 없다고 색인이 확인된 것은 아닙니다. robots 설정만으로 모든
          AI의 접근 가능성을 판정하지 않습니다. 구조화 데이터는 실제 본문과
          일치해야 합니다. FAQ·특수 파일의 존재가 AI 노출·추천을 보장하지
          않습니다.
        </p>
        {sites.map((r) => (
          <article key={r.id}>
            <span className="tag">
              {r.mode === "demo" ? "시연" : "수동 점검"}
            </span>
            <h3>{r.fields.title}</h3>
            <FieldList
              fields={Object.fromEntries(
                siteSpec.map(([k, t]) => [t, r.fields[k] ?? ""]),
              )}
            />
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>항목</th>
                    <th>상태</th>
                    <th>근거</th>
                  </tr>
                </thead>
                <tbody>
                  {checkItems.map((k) => (
                    <tr key={k}>
                      <th>{k}</th>
                      <td>{r.checks[k].status}</td>
                      <td>{r.checks[k].evidence || "미확인"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={() => {
                ss(r);
                sc(structuredClone(r.checks));
              }}
            >
              페이지 점검 편집
            </button>
            <button
              onClick={() => {
                if (confirm("페이지 점검을 삭제할까요?"))
                  void commit({
                    ...state,
                    siteReviews: state.siteReviews.filter((x) => x.id !== r.id),
                  });
              }}
            >
              페이지 점검 삭제
            </button>
          </article>
        ))}
        <h4>{site ? "페이지 점검 편집" : "페이지 점검 추가"}</h4>
        {error && <p role="alert">{error}</p>}
        <EvidenceForm
          key={site?.id ?? candidate.id}
          spec={siteSpec}
          initial={site?.fields ?? { url: candidate.fields.website ?? "" }}
          label="페이지 점검 저장"
          onSave={(f) => {
            if (!normalizeUrl(f.url ?? "")) {
              se("올바른 점검 페이지 URL을 입력하세요.");
              return;
            }
            if (
              checkItems.some(
                (k) =>
                  ["확인됨", "문제 확인"].includes(checks[k].status) &&
                  !checks[k].evidence.trim(),
              )
            ) {
              se("확인됨·문제 확인 항목에는 근거를 입력하세요.");
              return;
            }
            const row: SiteReview = {
              id: site?.id ?? uid(),
              candidateId: candidate.id,
              mode: candidate.mode,
              fields: f,
              checks: structuredClone(checks),
            };
            void commit({
              ...state,
              siteReviews: site
                ? state.siteReviews.map((x) => (x.id === site.id ? row : x))
                : [...state.siteReviews, row],
            }).then((ok) => {
              if (ok) {
                ss(undefined);
                sc(blankChecks());
                se("");
              }
            });
          }}
        >
          <div className="form-grid">
            {checkItems.map((k) => (
              <fieldset key={k}>
                <legend>{k}</legend>
                <label>
                  {k} 점검 상태
                  <select
                    aria-label={`${k} 점검 상태`}
                    value={checks[k].status}
                    onChange={(e) =>
                      sc({
                        ...checks,
                        [k]: { ...checks[k], status: e.target.value },
                      })
                    }
                  >
                    {checkStatuses.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  {k} 확인 근거
                  <textarea
                    value={checks[k].evidence}
                    onChange={(e) =>
                      sc({
                        ...checks,
                        [k]: { ...checks[k], evidence: e.target.value },
                      })
                    }
                  />
                </label>
              </fieldset>
            ))}
          </div>
        </EvidenceForm>
        {site && (
          <button
            onClick={() => {
              ss(undefined);
              sc(blankChecks());
            }}
          >
            페이지 편집 취소
          </button>
        )}
      </details>
      <details>
        <summary>AI 답변 노출 기록 ({records.length})</summary>
        <p>
          실제 AI 호출 없이 수동 기록합니다. 브랜드 언급·홈페이지 인용은
          별개이며, 인용을 추천으로 판정하지 않습니다. API 결과와 소비자용 화면
          결과를 구분합니다.
        </p>
        {[...groups.values()].map((rows, i) => {
          const summary = aiSummary(rows);
          return (
            <article key={i}>
              <h4>동일 조건 관측: {rows[0].fields.question}</h4>
              <p>
                {rows[0].fields.service} ·{" "}
                {rows[0].fields.model || "모델 미확인"} ·{" "}
                {rows[0].fields.surface} · 검색 {rows[0].fields.search} ·{" "}
                {rows[0].fields.language || "언어 미확인"} ·{" "}
                {rows[0].fields.region || "지역 미확인"}
              </p>
              <p>
                등록한 관측 표본 내 비율 · 완료 {summary.completed}건 ·
                실패/미실행 제외 {summary.excluded}건
              </p>
              {(["mention", "citation"] as const).map((k) => (
                <p key={k}>
                  {k === "mention" ? "언급" : "인용"}: {summary[k].yes}/
                  {summary[k].total} (
                  {summary[k].total
                    ? unknown((summary[k].yes / summary[k].total) * 100) + "%"
                    : "계산 불가"}
                  ) · 여부 미확인 {summary[k].unknown}건 제외
                </p>
              ))}
              {rows.map((r) => (
                <details key={r.id}>
                  <summary>
                    {r.mode === "demo" ? "시연 · " : ""}
                    {r.fields.executedAt} · {r.fields.execution} · 언급{" "}
                    {r.fields.mention} / 인용 {r.fields.citation}
                  </summary>
                  <FieldList
                    fields={Object.fromEntries(
                      aiSpec.map(([k, t]) => [t, r.fields[k] ?? ""]),
                    )}
                  />
                  <button onClick={() => sa(r)}>AI 기록 편집</button>
                  <button
                    onClick={() => {
                      if (confirm("AI 관측 기록을 삭제할까요?"))
                        void commit({
                          ...state,
                          aiRecords: state.aiRecords.filter(
                            (x) => x.id !== r.id,
                          ),
                        });
                    }}
                  >
                    AI 기록 삭제
                  </button>
                </details>
              ))}
            </article>
          );
        })}
        <h4>{ai ? "AI 관측 편집" : "AI 관측 추가"}</h4>
        <EvidenceForm
          key={ai?.id ?? candidate.id}
          spec={aiSpec}
          initial={ai?.fields ?? { executedAt: now() }}
          label="AI 관측 저장"
          onSave={(f) => {
            if (!zonedTime(f.executedAt)) {
              se("AI 실행 시각에 시간대를 포함하세요.");
              return;
            }
            if (f.execution === "완료" && !f.answer?.trim()) {
              se("완료 기록은 답변 원문 또는 발췌가 필요합니다.");
              return;
            }
            const row: AiRecord = {
              id: ai?.id ?? uid(),
              candidateId: candidate.id,
              mode: candidate.mode,
              fields: f,
            };
            void commit({
              ...state,
              aiRecords: ai
                ? state.aiRecords.map((x) => (x.id === ai.id ? row : x))
                : [...state.aiRecords, row],
            }).then((ok) => {
              if (ok) {
                sa(undefined);
                se("");
              }
            });
          }}
        />
        {error && <p role="alert">{error}</p>}
        {ai && <button onClick={() => sa(undefined)}>AI 편집 취소</button>}
      </details>
    </>
  );
}
export function ComparisonEvidence({
  state,
  candidates,
}: {
  state: State;
  candidates: Candidate[];
}) {
  return (
    <>
      {["플랫폼별 SNS 근거·최신성", "홈페이지 개선 과제", "AI 관측 표본"].map(
        (label, i) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            {candidates.map((c) => (
              <td key={c.id}>
                {i === 0
                  ? state.contents
                      .filter((x) => x.candidateId === c.id)
                      .map((x) => {
                        const o = latest(
                          state.observations.filter(
                            (o) => o.contentId === x.id,
                          ),
                        );
                        return (
                          <p key={x.id}>
                            {x.mode === "demo" ? "시연 · " : ""}
                            {x.fields.platform} · {x.fields.title}
                            <br />
                            {o?.observedAt ||
                              o?.originalObserved ||
                              "관측일 미확인"}{" "}
                            · 조회수 {confirmed(o, "views") ?? "미확인"}
                            <br />
                            {o?.source || "출처 미확인"}
                          </p>
                        );
                      })
                  : i === 1
                    ? state.siteReviews
                        .filter((x) => x.candidateId === c.id)
                        .map((x) => (
                          <p key={x.id}>
                            {x.mode === "demo" ? "시연 · " : ""}
                            {x.fields.title}:{" "}
                            {x.fields.problem || "문제 미확인"} →{" "}
                            {x.fields.recommendation || "수정안 미확인"} (
                            {x.fields.progress})
                          </p>
                        ))
                    : (() => {
                        const r = aiSummary(
                          state.aiRecords.filter((x) => x.candidateId === c.id),
                        );
                        return (
                          <p>
                            조건별 상세는 후보의 AI 기록 참조 · 완료{" "}
                            {r.completed}건 / 실패·미실행 제외 {r.excluded}건 ·
                            언급 {r.mention.yes}/{r.mention.total} · 인용{" "}
                            {r.citation.yes}/{r.citation.total} (등록 표본 내,
                            서로 다른 조건 합산은 성과 비교용이 아님)
                          </p>
                        );
                      })()}
              </td>
            ))}
          </tr>
        ),
      )}
    </>
  );
}
