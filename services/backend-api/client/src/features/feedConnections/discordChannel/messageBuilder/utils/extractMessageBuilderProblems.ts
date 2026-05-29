import { FieldError, FieldErrorsImpl, Merge } from "react-hook-form";
import {
  ComponentType,
  Component,
  MessageBuilderProblem,
  MessageComponentRoot,
  LegacyEmbedAuthorComponent,
  LegacyEmbedTitleComponent,
  LegacyEmbedDescriptionComponent,
  LegacyEmbedFooterComponent,
  LegacyEmbedImageComponent,
  LegacyEmbedThumbnailComponent,
} from "../types";
import getComponentPath from "./getComponentPath";

const extractMessageBuilderProblems = (
  formStateErrors: Merge<FieldError, FieldErrorsImpl<any>> | undefined,
  messageComponent?: MessageComponentRoot,
) => {
  const problems: Array<MessageBuilderProblem> = [];

  if (!messageComponent) {
    return problems;
  }

  let textDisplayCharacterCount = 0;

  const processErrors = (errors: Record<string, any>, component: Component, currentPath = "") => {
    if (!errors || typeof errors !== "object") return;

    Object.keys(errors).forEach((key) => {
      if (component.type === ComponentType.V2TextDisplay && key === "content") {
        const content = component.content || "";
        const charCount = content.length;
        textDisplayCharacterCount += charCount;
      }

      // Handle children and accessory separately since they have special handling
      if (key === "children") {
        // Handle array-level errors (e.g., min/max validation)
        if (errors[key]?.message) {
          problems.push({
            message: errors[key].message,
            path: getComponentPath(messageComponent, component.id) || component.name,
            componentId: component.id,
            severity: "error",
          });
        }

        // Handle individual child errors
        if (Array.isArray(errors[key])) {
          errors.children.forEach((childError: any, index: number) => {
            if (childError && component.children?.[index]) {
              processErrors(childError, component.children[index], currentPath);
            }
          });
        }

        return;
      }

      if (key === "accessory" && component.type === ComponentType.V2Section) {
        // Handle accessory-level errors (e.g., required validation when accessory is missing)
        if (errors[key]?.message) {
          problems.push({
            message: errors[key].message,
            path: getComponentPath(messageComponent, component.id) || component.name,
            componentId: component.id,
            severity: "error",
          });
        }

        // Handle errors on the accessory component itself (nested field errors)
        if (component.accessory && typeof errors[key] === "object") {
          processErrors(errors.accessory, component.accessory, currentPath);
        }

        return;
      }

      // Example key would be "content" for a text display component
      if (typeof errors[key] === "object" && errors[key].message) {
        // This is a direct error message for the current component
        problems.push({
          message: errors[key].message,
          path: getComponentPath(messageComponent, component.id) || component.name,
          componentId: component.id,
          severity: "error",
        });
      }
    });
  };

  if (formStateErrors) {
    processErrors(formStateErrors, messageComponent);
  }

  if (textDisplayCharacterCount > 4000) {
    problems.push({
      message: `Total character length for all Text Display components exceeds Discord limit of 4000. Current length: ${textDisplayCharacterCount}.`,
      path: getComponentPath(messageComponent, messageComponent.id) || "Message Root",
      componentId: messageComponent.id,
      severity: "error",
    });
  }

  if (messageComponent.type === ComponentType.LegacyRoot) {
    messageComponent.children.forEach((component) => {
      if (component.type !== ComponentType.LegacyEmbed) {
        return;
      }

      const authorComponent = component.children?.find(
        (c) => c.type === ComponentType.LegacyEmbedAuthor,
      ) as LegacyEmbedAuthorComponent | undefined;
      const titleComponent = component.children?.find(
        (c) => c.type === ComponentType.LegacyEmbedTitle,
      ) as LegacyEmbedTitleComponent | undefined;
      const descriptionComponent = component.children?.find(
        (c) => c.type === ComponentType.LegacyEmbedDescription,
      ) as LegacyEmbedDescriptionComponent | undefined;
      const footerComponent = component.children?.find(
        (c) => c.type === ComponentType.LegacyEmbedFooter,
      ) as LegacyEmbedFooterComponent | undefined;
      const imageComponent = component.children?.find(
        (c) => c.type === ComponentType.LegacyEmbedImage,
      ) as LegacyEmbedImageComponent | undefined;
      const thumbnailComponent = component.children?.find(
        (c) => c.type === ComponentType.LegacyEmbedThumbnail,
      ) as LegacyEmbedThumbnailComponent | undefined;

      const authorName = authorComponent?.authorName;
      const title = titleComponent?.title;
      const description = descriptionComponent?.description;
      const footerText = footerComponent?.footerText;
      const imageUrl = imageComponent?.imageUrl;
      const thumbnailUrl = thumbnailComponent?.thumbnailUrl;

      if (!authorName && !title && !description && !footerText && !imageUrl && !thumbnailUrl) {
        problems.push({
          message:
            "Embed must have at least one of author name, title text, description text, footer text, image URL, or thumbnail URL defined",
          path: getComponentPath(messageComponent, component.id) || component.name,
          componentId: component.id,
          severity: "error",
        });
      }
    });
  }

  return problems;
};

export default extractMessageBuilderProblems;
