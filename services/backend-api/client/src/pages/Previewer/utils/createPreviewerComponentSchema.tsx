import * as yup from "yup";
import { Component, ComponentType } from "../types";

// Recursive schema for component validation
const createPreviewerComponentSchema = (): yup.Lazy<any, yup.AnyObject, any> => {
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
        .required("Button label cannot be empty")
        .min(1, "Button label cannot be empty")
        .max(80, "Button label cannot exceed 80 characters"),
    });

    const textDisplaySchema = baseSchema.shape({
      content: yup
        .string()
        .min(1, "Text display content cannot be empty")
        .max(2000, "Text display content cannot exceed 2000 characters"),
    });

    const legacyTextSchema = baseSchema.shape({
      content: yup.string().max(2000, "Legacy text content cannot exceed 2000 characters"),
    });

    const legacyEmbedFieldSchema = baseSchema.shape({
      fieldName: yup
        .string()
        .required("Field name cannot be empty")
        .max(256, "Field name cannot exceed 256 characters"),
      fieldValue: yup
        .string()
        .required("Field value cannot be empty")
        .max(1024, "Field value cannot exceed 1024 characters"),
      inline: yup.boolean(),
    });

    switch (value.type) {
      case ComponentType.LegacyRoot:
        return baseSchema.shape({
          children: yup.array().of(createPreviewerComponentSchema()).default([]),
        });
      case ComponentType.LegacyText:
        return legacyTextSchema;
      case ComponentType.LegacyEmbed:
        return baseSchema.shape({
          children: yup
            .array()
            .of(createPreviewerComponentSchema())
            .test("max-embed-fields", "Expected fewer than 25 embed fields", (children) => {
              if (!children) return true;
              const fieldCount = children.filter(
                (child) => child.type === ComponentType.LegacyEmbedField
              ).length;

              return fieldCount <= 25;
            })
            .default([]),
        });

      case ComponentType.LegacyEmbedAuthor:
        return baseSchema.shape({
          authorName: yup.string().max(256, "Author name cannot exceed 256 characters"),
          authorUrl: yup.string(),
          authorIconUrl: yup.string(),
        });
      case ComponentType.LegacyEmbedTitle:
        return baseSchema.shape({
          title: yup.string().max(256, "Title cannot exceed 256 characters"),
          titleUrl: yup.string(),
        });
      case ComponentType.LegacyEmbedDescription:
        return baseSchema.shape({
          description: yup.string().max(4096, "Description cannot exceed 4096 characters"),
        });
      case ComponentType.LegacyEmbedImage:
        return baseSchema.shape({
          imageUrl: yup.string(),
        });
      case ComponentType.LegacyEmbedThumbnail:
        return baseSchema.shape({
          thumbnailUrl: yup.string(),
        });
      case ComponentType.LegacyEmbedFooter:
        return baseSchema.shape({
          footerText: yup.string().max(2048, "Footer text cannot exceed 2048 characters"),
          footerIconUrl: yup.string(),
        });
      case ComponentType.LegacyEmbedField:
        return legacyEmbedFieldSchema;
      case ComponentType.LegacyEmbedTimestamp:
        return baseSchema.shape({
          timestamp: yup.string(), // ISO 8601 timestamp
        });
      case ComponentType.V2TextDisplay:
        return textDisplaySchema;
      case ComponentType.V2ActionRow:
        return baseSchema.shape({
          children: yup
            .array()
            .of(createPreviewerComponentSchema())
            .min(1, "Action Row must have at least one child component")
            .max(5, "Action Row can have at most 5 child components")
            .required("Action Row must have at least one child component"),
        });
      case ComponentType.V2Root:
        return baseSchema.shape({
          children: yup.array().of(createPreviewerComponentSchema()).default([]),
        });
      case ComponentType.V2Section:
        return baseSchema.shape({
          children: yup
            .array()
            .of(createPreviewerComponentSchema())
            .default([])
            .min(1, "Section must have at least 1 child component")
            .max(3, "Section can have at most 3 child components"),
          accessory: buttonSchema.required(),
        });
      case ComponentType.V2Divider:
        return baseSchema;
      case ComponentType.V2Button:
        return buttonSchema;
      default:
        return baseSchema;
    }
  });
};

export default createPreviewerComponentSchema;
