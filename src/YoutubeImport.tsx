import { useEffect, useState } from "react";
import { uid, type Content, type State } from "./domain";
import { validateResearch, type Observation } from "./research";
export default function YoutubeImport({
  state,
  content,
  commit,
}: {
  state: State;
  content: Content;
  commit: (s: State) => Promise<boolean>;
}) {
  const [configured, sc] = useState(false),
    [status, ss] = useState("서버 연결 설정 확인 중"),
    [busy, sb] = useState(false);
  useEffect(() => {
    if (content.mode !== "user" || content.fields.platform !== "유튜브") return;
    fetch("/api/youtube/status")
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => {
        sc(data.configured === true);
        ss(
          data.configured
            ? "서버 키 설정 있음 · 실제 API 조회 전"
            : "미연결 · 서버 YOUTUBE_API_KEY 미설정",
        );
      })
      .catch(() => ss("미연결 · API 서버 사용 불가"));
  }, [content.id, content.mode, content.fields.platform]);
  async function run() {
    sb(true);
    ss("공식 API 조회 중");
    try {
      let id = content.fields.platformId;
      if (!id) {
        const u = new URL(content.fields.url);
        id =
          u.hostname === "youtu.be"
            ? u.pathname.slice(1)
            : (u.searchParams.get("v") ?? u.pathname.split("/").at(-1) ?? "");
      }
      const r = await fetch("/api/youtube/video?id=" + encodeURIComponent(id));
      const result = await r.json();
      if (!r.ok) throw Error(result.error ?? "조회 실패");
      const observation: Observation = {
        ...result.observation,
        id: uid(),
        contentId: content.id,
        mode: "user",
      };
      validateResearch(
        {
          observations: [observation],
          commentEvidence: [],
          siteReviews: [],
          aiRecords: [],
        },
        [content],
        state.candidates,
      );
      if (
        await commit({
          ...state,
          contents: state.contents.map((c) =>
            c.id === content.id
              ? {
                  ...c,
                  fields: {
                    ...c.fields,
                    platformId: result.platformId,
                    title: result.title || c.fields.title,
                    published:
                      result.published?.slice(0, 10) || c.fields.published,
                  },
                }
              : c,
          ),
          observations: [...state.observations, observation],
        })
      )
        ss(
          "연결됨 · 공식 API 관측을 추가했습니다. 미확보 지표는 별도 상태로 보존합니다.",
        );
    } catch (e) {
      ss("오류 · " + String(e) + " 기존 기록은 보존됩니다.");
    } finally {
      sb(false);
    }
  }
  if (content.mode !== "user" || content.fields.platform !== "유튜브")
    return null;
  return (
    <div className="banner">
      <p role="status">YouTube: {status}</p>
      {configured && (
        <button disabled={busy} onClick={() => void run()}>
          공식 API 최신 지표 조회
        </button>
      )}
      <small>
        검색·댓글 수집은 미연결입니다. 이 기능은 등록한 단일 콘텐츠의 기본
        정보·공개 반응 지표만 조회합니다.
      </small>
    </div>
  );
}
