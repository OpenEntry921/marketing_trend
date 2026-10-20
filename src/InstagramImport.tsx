import { useEffect, useState } from "react";
import {
  instagramLimit,
  instagramUsername,
  saveInstagramPost,
  type InstagramPost,
  type InstagramResult,
} from "./instagram";
import type { State } from "./domain";
function Thumbnail({ src, reason }: { src: string | null; reason: string }) {
  const [failed, sf] = useState(false);
  return src && !failed ? (
    <img
      className="instagram-thumbnail"
      src={src}
      alt="Instagram 게시물 썸네일"
      loading="lazy"
      onError={() => sf(true)}
    />
  ) : (
    <p className="thumbnail-empty">{reason || "썸네일 미확보"}</p>
  );
}
export default function InstagramImport({
  state,
  commit,
  onSaved,
}: {
  state: State;
  commit: (s: State) => Promise<boolean>;
  onSaved: () => void;
}) {
  const [username, su] = useState("bluebottle"),
    [limit, sl] = useState("5"),
    [busy, sb] = useState(false),
    [status, ss] = useState("서버 설정 확인 중"),
    [result, sr] = useState<InstagramResult>(),
    [error, se] = useState(""),
    [target, st] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/instagram/status")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error || "서버 상태 확인 실패");
        if (active)
          ss(
            data.configured
              ? "서버 토큰 설정 있음 · 실제 계정 조회 전"
              : "서버 토큰 미설정 — 운영자가 서버의 INSTAGRAM_ACCESS_TOKEN을 설정하세요.",
          );
      })
      .catch(() => {
        if (active)
          ss("서버 상태 확인 불가 — 로컬 개발 서버 실행을 확인하세요.");
      });
    return () => {
      active = false;
    };
  }, []);
  async function run(e: React.FormEvent) {
    e.preventDefault();
    se("");
    ss("Instagram API 조회 중");
    sb(true);
    sr(undefined);
    try {
      const account = instagramUsername(username),
        n = instagramLimit(limit);
      su(account);
      const response = await fetch(
        `/api/instagram/account?username=${encodeURIComponent(account)}&limit=${n}`,
      );
      const data = await response.json();
      if (!response.ok)
        throw Error(
          data.error || "Instagram 조회 실패 — 원인을 확정할 수 없습니다.",
        );
      if (data.label !== "실제 API 데이터" || !Array.isArray(data.posts))
        throw Error("올바른 API 응답이 아닙니다.");
      sr(data);
      ss(
        `실제 API 응답 수신 · @${data.profile.username} · ${data.collectedAt}`,
      );
    } catch (e) {
      ss("Instagram 계정 조회 실패");
      se((e as Error).message);
    } finally {
      sb(false);
    }
  }
  async function save(post: InstagramPost) {
    try {
      const next = saveInstagramPost(state, result!, post, target || undefined);
      if (await commit(next)) onSaved();
    } catch (e) {
      se("저장 실패: " + (e as Error).message);
    }
  }
  return (
    <>
      <section>
        <h2>Instagram 계정으로 가져오기</h2>
        <p>
          공개 비즈니스·크리에이터 계정 중 API가 지원하는 계정의 게시물을
          가져옵니다. 일반 키워드 검색과는 별개의 기능입니다.
        </p>
        <p role="status">{status}</p>
        <p>
          해시태그 검색: <strong>Meta 승인 대기</strong> · 댓글 본문 수집은
          포함하지 않습니다. 토큰 자동 갱신은 구현하지 않았습니다.
        </p>
        <form onSubmit={(e) => void run(e)}>
          <div className="form-grid">
            <label>
              Instagram 계정명
              <input
                required
                value={username}
                onChange={(e) => su(e.target.value)}
                placeholder="bluebottle / @bluebottle / 프로필 URL"
              />
            </label>
            <label>
              가져올 게시물 수
              <input
                type="number"
                required
                min="1"
                max="20"
                value={limit}
                onChange={(e) => sl(e.target.value)}
              />
            </label>
          </div>
          <button className="primary" disabled={busy}>
            {busy ? "게시물 가져오는 중…" : "게시물 가져오기"}
          </button>
        </form>
        <p>
          인증 오류 시 운영자가 서버 토큰을 교체해야 합니다. Meta 앱 설정·계정
          연결은 이 화면에서 변경하지 않습니다.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </section>
      {result && (
        <>
          <section>
            <span className="tag">실제 API 데이터</span>
            <h2>@{result.profile.username}</h2>
            <p>
              팔로워:{" "}
              {result.profile.followersCount === null
                ? "미확인"
                : result.profile.followersCount.toLocaleString("ko-KR")}{" "}
              · 계정 게시물 수:{" "}
              {result.profile.mediaCount === null
                ? "미확인"
                : result.profile.mediaCount.toLocaleString("ko-KR")}
            </p>
            <p>수집 시각: {result.collectedAt}</p>
            {result.warnings.map((w, i) => (
              <p className="banner" key={i}>
                {w}
              </p>
            ))}
            <label>
              후보 저장 대상 (사용자 데이터)
              <select
                aria-label="후보 저장 대상 (사용자 데이터)"
                value={target}
                onChange={(e) => st(e.target.value)}
              >
                <option value="">새 ‘제품 미분류 콘텐츠’ 후보 생성</option>
                {state.candidates
                  .filter((c) => c.mode === "user")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fields.name}
                    </option>
                  ))}
              </select>
            </label>
            <p>
              브랜드 계정을 제품명으로 확정하지 않습니다. 기존 게시물은 연결된
              후보를 유지하고 새 관측만 추가합니다. 저장은 사용자 작업 공간에만
              적용합니다.
            </p>
          </section>
          {!result.posts.length && (
            <p className="empty">
              API가 빈 게시물 목록을 반환했습니다. 이 결과는 지원되는 전체 공개
              계정 검색 결과가 아닙니다.
            </p>
          )}
          <div className="cards instagram-results">
            {result.posts.map((post) => {
              const existing = state.contents.find(
                (c) =>
                  c.mode === "user" &&
                  c.fields.platform === "인스타그램" &&
                  c.fields.platformId === post.id,
              );
              const alreadySaved =
                !!existing &&
                state.observations.some(
                  (o) =>
                    o.contentId === existing.id &&
                    o.method === "공식 API" &&
                    o.observedAt === post.observation.observedAt,
                );
              const metrics = post.observation.metrics;
              return (
                <article key={post.id}>
                  <div className="row">
                    <span className="tag">실제 API 데이터</span>
                    <span>
                      {post.mediaType === "IMAGE"
                        ? "이미지"
                        : post.mediaType === "VIDEO"
                          ? "영상"
                          : post.mediaType === "CAROUSEL_ALBUM"
                            ? "캐러셀"
                            : post.mediaType}
                    </span>
                  </div>
                  <Thumbnail
                    key={post.thumbnail}
                    src={post.thumbnail}
                    reason={post.thumbnailReason}
                  />
                  <h3>게시물 {post.id}</h3>
                  {post.caption ? (
                    <details>
                      <summary>본문 보기</summary>
                      <p className="caption">{post.caption}</p>
                    </details>
                  ) : (
                    <p>본문 미제공</p>
                  )}
                  <p>
                    게시일: {post.publishedAt || "미확인"}
                    <br />
                    수집 시각: {post.collectedAt}
                  </p>
                  <dl>
                    {(["likes", "comments", "views"] as const).map((k) => (
                      <div className="instagram-metric" key={k}>
                        <dt>
                          {k === "likes"
                            ? "좋아요 수"
                            : k === "comments"
                              ? "댓글 수"
                              : "조회수"}
                        </dt>
                        <dd>
                          {metrics[k].value === null
                            ? metrics[k].status
                            : metrics[k].value.toLocaleString("ko-KR")}
                          <small>{metrics[k].reason}</small>
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {post.permalink && (
                    <a href={post.permalink} target="_blank" rel="noreferrer">
                      Instagram 원문 보기 ↗
                    </a>
                  )}
                  <button
                    className="primary"
                    disabled={alreadySaved || busy}
                    onClick={() => void save(post)}
                  >
                    {alreadySaved
                      ? "저장됨 · 재수집 후 새 관측 저장"
                      : existing
                        ? "기존 콘텐츠에 관측 추가"
                        : "후보 저장"}
                  </button>
                </article>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
