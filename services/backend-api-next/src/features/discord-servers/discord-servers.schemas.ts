import { Type, type Static } from "@sinclair/typebox";

export const ServerParamsSchema = Type.Object({
  serverId: Type.String(),
});
export type ServerParams = Static<typeof ServerParamsSchema>;

export const MemberParamsSchema = Type.Object({
  serverId: Type.String(),
  memberId: Type.String(),
});
export type MemberParams = Static<typeof MemberParamsSchema>;

export const ActiveThreadsQuerystringSchema = Type.Object({
  parentChannelId: Type.Optional(Type.String()),
});
export type ActiveThreadsQuerystring = Static<
  typeof ActiveThreadsQuerystringSchema
>;

export const ChannelsQuerystringSchema = Type.Object({
  types: Type.Optional(Type.String()),
});
export type ChannelsQuerystring = Static<typeof ChannelsQuerystringSchema>;

export const MembersQuerystringSchema = Type.Object({
  search: Type.String({ minLength: 1 }),
  limit: Type.Integer({ minimum: 1 }),
});
export type MembersQuerystring = Static<typeof MembersQuerystringSchema>;
