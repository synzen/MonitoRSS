import { pages } from "../constants";

export const openRedditLogin = () => {
  window.open(pages.loginReddit(), "_blank", "popup=true,width=600,height=600");
};
