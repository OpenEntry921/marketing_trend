export type ConnectionStatus = "미연결" | "시연" | "연결됨" | "오류";
export interface Provider {
  name: string;
  status: ConnectionStatus;
  searchLink?: (query: string) => string;
}
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
