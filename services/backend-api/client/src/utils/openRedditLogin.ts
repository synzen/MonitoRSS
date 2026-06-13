import { pages } from "../constants";

export const openRedditLogin = (workspaceId?: string) => {
  const url = workspaceId
    ? `${pages.loginReddit()}?workspaceId=${encodeURIComponent(workspaceId)}`
    : pages.loginReddit();

  window.open(url, "_blank", `popup=true,width=600,height=600`);
};
