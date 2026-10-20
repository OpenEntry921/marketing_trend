export type ConnectionStatus = "미연결" | "시연" | "연결됨" | "오류";
export interface Provider {
  name: string;
  status: ConnectionStatus;
  searchLink?: (query: string) => string;
}
export type ProviderCapability = "search" | "basic" | "metrics" | "comments";
export type CapabilityInfo = {
  status: ConnectionStatus;
  scope: string;
  auth: string;
  limit: string;
  retention: string;
  error: string;
};
export type ProviderResult<T> = {
  data: Partial<T>;
  errors: Partial<Record<keyof T, string>>;
};
export interface DataProvider {
  name: string;
  capabilities: Record<ProviderCapability, CapabilityInfo>;
  // 검색·기본 정보·지표·댓글은 독립적으로 구현한다. 성공값과 실패항목은 함께 반환한다.
  search?: (query: string) => Promise<ProviderResult<{ items: unknown[] }>>;
  basic?: (id: string) => Promise<ProviderResult<Record<string, unknown>>>;
  metrics?: (id: string) => Promise<ProviderResult<Record<string, unknown>>>;
  comments?: (id: string) => Promise<ProviderResult<{ items: unknown[] }>>;
}
export const capabilityLabels: Record<ProviderCapability, string> = {
  search: "검색",
  basic: "기본 정보",
  metrics: "반응 지표",
  comments: "댓글",
};
export const dataProviders: DataProvider[] = [
  "유튜브",
  "인스타그램",
  "틱톡",
  "홈페이지",
  "AI 답변",
].map((name) => ({
  name,
  capabilities: Object.fromEntries(
    (["search", "basic", "metrics", "comments"] as ProviderCapability[]).map(
      (k) => [
        k,
        {
          status: "미연결",
          scope:
            name === "유튜브" && ["basic", "metrics"].includes(k)
              ? "서버 경로 준비 · 지정한 공개 동영상 ID. 실제 권한·호출 검증 전"
              : name === "인스타그램" || name === "틱톡"
                ? "허용 계정·콘텐츠 범위 확인 전; 임의 공개 계정 전체 수집을 전제하지 않음"
                : "수동 기록만 제공",
          auth:
            name === "유튜브"
              ? "서버 YOUTUBE_API_KEY / YouTube Data API v3 활성화; 비공개·계정 전용 자료는 별도 OAuth 검토"
              : "공식 문서와 실제 발급 권한 확인 필요",
          limit:
            name === "유튜브"
              ? "videos.list 요청당 할당량·일일 프로젝트 한도는 최신 콘솔·공식 문서 확인"
              : "미확인 · 연결 시 최신 문서 확인",
          retention:
            "수동 기록은 사용자 삭제까지 로컬 보존. API 자료 보관·갱신 제한은 연결 시 제공업체 정책 확인",
          error:
            "실제 호출 전; 일부 실패 시 성공한 항목을 유지하고 실패 상태 별도 기록",
        },
      ],
    ),
  ) as Record<ProviderCapability, CapabilityInfo>,
}));
export const providers: Provider[] = [
  { name: "인스타그램", status: "미연결" },
  {
    name: "틱톡",
    status: "미연결",
    searchLink: (q) =>
      `https://www.tiktok.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    name: "유튜브",
    status: "미연결",
    searchLink: (q) =>
      `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
  },
  {
    name: "네이버",
    status: "미연결",
    searchLink: (q) =>
      `https://search.naver.com/search.naver?query=${encodeURIComponent(q)}`,
  },
  {
    name: "구글 트렌드",
    status: "미연결",
    searchLink: (q) =>
      `https://trends.google.com/trends/explore?q=${encodeURIComponent(q)}`,
  },
  { name: "수동 조사 자료", status: "연결됨" },
];
