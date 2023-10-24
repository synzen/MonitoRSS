import { SessionAccessToken } from "../../features/discord-auth/types/SessionAccessToken.type";

export interface UserAuthDetails {
  sessionAccessToken: SessionAccessToken;
  email?: string;
}
