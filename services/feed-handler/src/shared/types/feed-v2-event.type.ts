import { string, array, object, InferType, mixed } from "yup";

export enum MediumKey {
  Discord = "discord",
}

export const mediumKeySchema = string()
  .oneOf(Object.values(MediumKey))
  .required();

export const baseMediumpayloadSchema = object({
  key: mediumKeySchema,
  details: object().required(),
});

export type BaseMediumPayload = InferType<typeof baseMediumpayloadSchema>;

const discordMediumPayloadDetailsSchema = object({
  guildId: string().required(),
  channels: array(
    object({
      id: string().required(),
    })
  ),
  webhooks: array(
    object({
      id: string().required(),
      token: string().required(),
    })
  ),
  content: string(),
});

export type DiscordMediumPayloadDetails = InferType<
  typeof discordMediumPayloadDetailsSchema
>;

export const mediumPayloadSchema = baseMediumpayloadSchema.shape({
  key: string().oneOf([MediumKey.Discord]).required(),
  details: object()
    .oneOf([discordMediumPayloadDetailsSchema])
    .when("key", {
      is: MediumKey.Discord,
      then: () => discordMediumPayloadDetailsSchema,
    }),
});

export type MediumPayload = {
  key: MediumKey.Discord;
  details: InferType<typeof discordMediumPayloadDetailsSchema>;
};

export interface FeedV2Event {
  feed: {
    id: string;
    url: string;
    passingComparisons: string[];
    blockingComparisons: string[];
  };
  mediums: MediumPayload[];
}

export const feedV2EventSchema = object({
  feed: object({
    id: string().required(),
    url: string().required(),
    passingComparisons: array(string().required()),
    blockingComparisons: array(string().required()),
  }),
  mediums: array(mediumPayloadSchema.required()).min(1).required(),
});
