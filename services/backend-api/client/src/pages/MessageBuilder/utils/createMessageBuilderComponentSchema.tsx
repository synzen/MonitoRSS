import * as yup from "yup";
import { Component, ComponentType } from "../types";
import { DiscordButtonStyle } from "../constants/DiscordButtonStyle";

// Recursive schema for component validation
const createMessageBuilderComponentSchema = (): yup.Lazy<any, yup.AnyObject, any> => {
  return yup.lazy((value: Component | undefined) => {
    if (!value || !value.type) {
      return yup.object();
    }

    const baseSchema = yup.object({
      id: yup.string().required(),
      type: yup.string().required(),
      name: yup.string().required(),
    });

    const buttonSchema = baseSchema.shape({
      label: yup
        .string()
        .required("Expected non-empty Button label")
        .max(80, "Expected Button label to have at most 80 characters"),
      style: yup.string(),
      href: yup.string().when("style", {
        is: DiscordButtonStyle.Link,
        then: (schema) =>
          schema
            .required("Expected non-empty Link URL for Link-style button")
            .max(512, "Expected Link URL to have at most 512 characters"),
        otherwise: (schema) => schema.nullable(),
      }),
    });

    const textDisplaySchema = baseSchema.shape({
      content: yup
        .string()
        .required("Expected non-empty Text Display content")
        .max(2000, "Expected Text Display content to have at most 2000 characters"),
    });

    const legacyTextSchema = baseSchema.shape({
      content: yup
        .string()
        .required("Expected non-empty Text content")
        .max(2000, "Expected Text content to have at most 2000 characters"),
    });

    const legacyEmbedFieldSchema = baseSchema.shape({
      fieldName: yup
        .string()
        .required("Expected non-empty Field Name")
        .max(256, "Expected Field Name to have at most 256 characters"),
      fieldValue: yup
        .string()
        .required("Expected non-empty Field Value")
        .max(1024, "Expected Field Value to have at most 1024 characters"),
      inline: yup.boolean(),
    });

    const thumbnailSchema = baseSchema.shape({
      mediaUrl: yup
        .string()
        .required("Expected non-empty Image URL for thumbnail")
        .max(2048, "Expected Image URL to have at most 2048 characters"),
      description: yup.string().max(1024, "Expected description to have at most 1024 characters"),
      spoiler: yup.boolean(),
    });

    switch (value.type) {
      case ComponentType.LegacyRoot:
        return baseSchema.shape({
          children: yup.array().of(createMessageBuilderComponentSchema()).default([]),
        });
      case ComponentType.LegacyText:
        return legacyTextSchema;
      case ComponentType.LegacyEmbedContainer:
        return baseSchema.shape({
          children: yup
            .array()
            .of(createMessageBuilderComponentSchema())
            .max(9, "Expected fewer than 10 embeds")
            .default([]),
        });
      case ComponentType.LegacyEmbed:
        return baseSchema.shape({
          children: yup
            .array()
            .of(createMessageBuilderComponentSchema())
            .test("max-embed-fields", "Expected fewer than 25 embed fields", (children) => {
              if (!children) return true;
              const fieldCount = children.filter(
                (child) => child.type === ComponentType.LegacyEmbedField,
              ).length;

              return fieldCount <= 25;
            })
            .default([]),
        });

      case ComponentType.LegacyEmbedAuthor:
        return baseSchema.shape({
          authorName: yup
            .string()
            .required("Expected non-empty Author Name")
            .max(256, "Expected Author Name to have at most 256 characters"),
          authorUrl: yup.string(),
          authorIconUrl: yup.string(),
        });
      case ComponentType.LegacyEmbedTitle:
        return baseSchema.shape({
          title: yup
            .string()
            .required("Expected non-empty Embed Title text")
            .max(256, "Expected Embed Title to have at most 256 characters"),
          titleUrl: yup.string(),
        });
      case ComponentType.LegacyEmbedDescription:
        return baseSchema.shape({
          description: yup
            .string()
            .required("Expected non-empty Embed Description text")
            .max(4096, "Expected Embed Description to have at most 4096 characters"),
        });
      case ComponentType.LegacyEmbedImage:
        return baseSchema.shape({
          imageUrl: yup.string().required("Expected non-empty image URL"),
        });
      case ComponentType.LegacyEmbedThumbnail:
        return baseSchema.shape({
          thumbnailUrl: yup.string().required("Expected non-empty thumbnail URL"),
        });
      case ComponentType.LegacyEmbedFooter:
        return baseSchema.shape({
          footerText: yup
            .string()
            .required("Expected non-empty Footer Text")
            .max(2048, "Expected Footer Fext to have at most 2048 characters"),
          footerIconUrl: yup.string(),
        });
      case ComponentType.LegacyEmbedField:
        return legacyEmbedFieldSchema;
      case ComponentType.LegacyEmbedTimestamp:
        return baseSchema.shape({
          timestamp: yup.string().oneOf(["", "article", "now"]).nullable(), // ISO 8601 timestamp
        });
      case ComponentType.LegacyActionRow:
        return baseSchema.shape({
          children: yup
            .array()
            .of(createMessageBuilderComponentSchema())
            .min(1, "Expected Action Row to have at least one child component")
            .max(5, "Expected Action Row to have at most 5 child components")
            .required("Expected Action Row to have at least one child component"),
        });
      case ComponentType.LegacyButton:
        return baseSchema.shape({
          label: yup
            .string()
            .required("Expected non-empty Button label")
            .max(80, "Expected Button label to have at most 80 characters"),
          style: yup
            .string()
            .oneOf([DiscordButtonStyle.Link])
            .required()
            .default(DiscordButtonStyle.Link),
          disabled: yup.boolean().required(),
          url: yup.string().required("Expected non-empty URL for button"),
        });
      case ComponentType.V2TextDisplay:
        return textDisplaySchema;
      case ComponentType.V2ActionRow:
        return baseSchema.shape({
          children: yup
            .array()
            .of(createMessageBuilderComponentSchema())
            .min(1, "Expected Action Row to have at least one child component")
            .max(5, "Expected Action Row to have at most 5 child components"),
        });
      case ComponentType.V2Root:
        return baseSchema.shape({
          children: yup
            .array()
            .of(createMessageBuilderComponentSchema())
            .default([])
            .min(1, "Add at least one component to your message"),
        });
      case ComponentType.V2Section:
        return baseSchema.shape({
          children: yup
            .array()
            .of(createMessageBuilderComponentSchema())
            .default([])
            .min(1, "Expected Section to have at least 1 child component")
            .max(3, "Expected Section to have at fewer than 4 child components"),
          accessory: yup
            .mixed()
            .test(
              "is-button-or-thumbnail",
              "Expected Section to have an accessory component (Button or Thumbnail)",
              (val) => {
                if (!val) return false;
                const accessory = val as { type?: string };

                return (
                  accessory.type === ComponentType.V2Button ||
                  accessory.type === ComponentType.V2Thumbnail
                );
              },
            )
            .test(
              "validate-accessory-fields",
              "Accessory component has validation errors",
              function validateAccessoryFields(val) {
                if (!val) return true; // Let the required test handle missing accessory
                const accessory = val as { type?: string; mediaUrl?: string; label?: string };

                // Validate thumbnail mediaUrl
                if (accessory.type === ComponentType.V2Thumbnail) {
                  if (!accessory.mediaUrl || accessory.mediaUrl.trim() === "") {
                    return this.createError({
                      message: "Expected non-empty Image URL for thumbnail",
                      path: `${this.path}.mediaUrl`,
                    });
                  }
                }

                // Validate button label
                if (accessory.type === ComponentType.V2Button) {
                  if (!accessory.label || accessory.label.trim() === "") {
                    return this.createError({
                      message: "Expected non-empty Button label",
                      path: `${this.path}.label`,
                    });
                  }
                }

                return true;
              },
            )
            .required("Expected Section to have an accessory component"),
        });
      case ComponentType.V2Thumbnail:
        return thumbnailSchema;
      case ComponentType.V2Divider:
        return baseSchema;
      case ComponentType.V2Button:
        return buttonSchema;
      case ComponentType.V2Container:
        return baseSchema.shape({
          children: yup
            .array()
            .of(createMessageBuilderComponentSchema())
            .min(1, "Expected Container to have at least 1 child component")
            .required("Expected Container to have at least 1 child component"),
          accentColor: yup.number().nullable(),
          spoiler: yup.boolean(),
        });
      case ComponentType.V2MediaGallery:
        return baseSchema.shape({
          children: yup
            .array()
            .of(createMessageBuilderComponentSchema())
            .min(1, "Expected Media Gallery to have at least 1 item")
            .max(10, "Expected Media Gallery to have at most 10 items")
            .required("Expected Media Gallery to have at least 1 item"),
        });
      case ComponentType.V2MediaGalleryItem:
        return baseSchema.shape({
          mediaUrl: yup
            .string()
            .required("Expected non-empty media URL")
            .max(2048, "Expected media URL to have at most 2048 characters"),
          description: yup.string().max(256, "Expected description to have at most 256 characters"),
          spoiler: yup.boolean(),
        });
      default:
        return baseSchema;
    }
  });
};

export default createMessageBuilderComponentSchema;
