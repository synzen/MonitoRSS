import { FieldError, FieldErrorsImpl, Merge } from "react-hook-form";
import {
  ComponentType,
  Component,
  PreviewerProblem,
  MessageComponentRoot,
  LegacyEmbedAuthorComponent,
  LegacyEmbedTitleComponent,
  LegacyEmbedDescriptionComponent,
  LegacyEmbedFooterComponent,
  LegacyEmbedImageComponent,
  LegacyEmbedThumbnailComponent,
} from "../types";
import getPreviewerComponentLabel from "./getPreviewerComponentLabel";

const getComponentPath = (
  component: Component,
  targetId: string,
  currentPath = ""
): string | null => {
  interface StackItem {
    component: Component;
    path: string;
  }

  const stack: StackItem[] = [
    { component, path: currentPath || getPreviewerComponentLabel(component.type) },
  ];

  while (stack.length > 0) {
    const { component: currentComponent, path } = stack.pop()!;

    if (currentComponent.id === targetId) {
      return path;
    }

    // Add accessory to stack (will be processed first due to stack LIFO nature)
    if (currentComponent.type === ComponentType.V2Section && currentComponent.accessory) {
      const accessoryPath = `${path} > ${getPreviewerComponentLabel(
        currentComponent.type
      )} (accessory)`;
      stack.push({ component: currentComponent.accessory, path: accessoryPath });
    }

    // Add children to stack in reverse order to maintain left-to-right processing
    if (currentComponent.children) {
      for (let i = currentComponent.children.length - 1; i >= 0; i -= 1) {
        const child = currentComponent.children[i];
        const childPath = `${path} > ${getPreviewerComponentLabel(child.type)}`;
        stack.push({ component: child, path: childPath });
      }
    }
  }

  return null;
};

const extractPreviewerProblems = (
  formStateErrors: Merge<FieldError, FieldErrorsImpl<any>> | undefined,
  messageComponent?: MessageComponentRoot
) => {
  const problems: Array<PreviewerProblem> = [];

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

      // Example key would be "content" for a text display component
      if (typeof errors[key] === "object" && errors[key].message) {
        // This is a direct error message for the current component
        problems.push({
          message: errors[key].message,
          path: getComponentPath(messageComponent, component.id) || component.name,
          componentId: component.id,
        });
      }

      if (key === "children" && Array.isArray(errors[key])) {
        errors.children.forEach((childError: any, index: number) => {
          if (childError && component.children?.[index]) {
            processErrors(childError, component.children[index], currentPath);
          }
        });
      }

      if (
        key === "accessory" &&
        errors[key] &&
        component.type === ComponentType.V2Section &&
        component.accessory
      ) {
        processErrors(errors.accessory, component.accessory, currentPath);
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
    });
  }

  if (messageComponent.type === ComponentType.LegacyRoot) {
    messageComponent.children.forEach((component) => {
      if (component.type !== ComponentType.LegacyEmbed) {
        return;
      }

      const authorComponent = component.children?.find(
        (c) => c.type === ComponentType.LegacyEmbedAuthor
      ) as LegacyEmbedAuthorComponent | undefined;
      const titleComponent = component.children?.find(
        (c) => c.type === ComponentType.LegacyEmbedTitle
      ) as LegacyEmbedTitleComponent | undefined;
      const descriptionComponent = component.children?.find(
        (c) => c.type === ComponentType.LegacyEmbedDescription
      ) as LegacyEmbedDescriptionComponent | undefined;
      const footerComponent = component.children?.find(
        (c) => c.type === ComponentType.LegacyEmbedFooter
      ) as LegacyEmbedFooterComponent | undefined;
      const imageComponent = component.children?.find(
        (c) => c.type === ComponentType.LegacyEmbedImage
      ) as LegacyEmbedImageComponent | undefined;
      const thumbnailComponent = component.children?.find(
        (c) => c.type === ComponentType.LegacyEmbedThumbnail
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
        });
      }
    });
  }

  return problems;
};

export default extractPreviewerProblems;
