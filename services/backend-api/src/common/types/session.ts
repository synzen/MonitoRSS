import { SessionAccessToken } from "../../features/discord-auth/types/SessionAccessToken.type";

export enum SessionKey {
  ACCESS_TOKEN = "accessToken",
}

export interface Session {
  [SessionKey.ACCESS_TOKEN]?: SessionAccessToken;
}
