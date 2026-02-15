import { Type } from "@sinclair/typebox";

export const NullableString = Type.Union([Type.String(), Type.Null()]);

export const EmbedFieldSchema = Type.Object(
  {
    name: Type.Optional(NullableString),
    value: Type.Optional(NullableString),
    inline: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
  },
  { additionalProperties: false },
);

export const EmbedImageSchema = Type.Object(
  {
    url: Type.Optional(NullableString),
  },
  { additionalProperties: false },
);

export const EmbedAuthorSchema = Type.Object(
  {
    name: Type.Optional(NullableString),
    url: Type.Optional(NullableString),
    iconUrl: Type.Optional(NullableString),
  },
  { additionalProperties: false },
);

export const EmbedFooterSchema = Type.Object(
  {
    text: Type.Optional(NullableString),
    iconUrl: Type.Optional(NullableString),
  },
  { additionalProperties: false },
);

export const EmbedSchema = Type.Object(
  {
    title: Type.Optional(NullableString),
    description: Type.Optional(NullableString),
    url: Type.Optional(NullableString),
    color: Type.Optional(NullableString),
    timestamp: Type.Optional(
      Type.Union([
        Type.Literal("now"),
        Type.Literal("article"),
        Type.Literal(""),
      ]),
    ),
    image: Type.Optional(Type.Union([EmbedImageSchema, Type.Null()])),
    thumbnail: Type.Optional(Type.Union([EmbedImageSchema, Type.Null()])),
    author: Type.Optional(Type.Union([EmbedAuthorSchema, Type.Null()])),
    footer: Type.Optional(Type.Union([EmbedFooterSchema, Type.Null()])),
    fields: Type.Optional(
      Type.Union([Type.Array(EmbedFieldSchema), Type.Null()]),
    ),
  },
  { additionalProperties: false },
);

export const PlaceholderLimitSchema = Type.Object(
  {
    placeholder: Type.String({ minLength: 1 }),
    characterCount: Type.Integer({ minimum: 1 }),
    appendString: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);
