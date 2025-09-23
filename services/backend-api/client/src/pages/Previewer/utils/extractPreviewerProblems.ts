import { FieldError, FieldErrorsImpl, Merge } from "react-hook-form";
import {
  MESSAGE_ROOT_ID,
  ComponentType,
  Component,
  PreviewerProblem,
  MessageComponentRoot,
} from "../types";

const getComponentPath = (
  component: Component,
  targetId: string,
  currentPath = ""
): string | null => {
  interface StackItem {
    component: Component;
    path: string;
  }

  const stack: StackItem[] = [{ component, path: currentPath || component.name }];

  while (stack.length > 0) {
    const { component: currentComponent, path } = stack.pop()!;

    if (currentComponent.id === targetId) {
      return path;
    }

    // Add accessory to stack (will be processed first due to stack LIFO nature)
    if (currentComponent.type === ComponentType.V2Section && currentComponent.accessory) {
      const accessoryPath = `${path} > ${currentComponent.accessory.name} (accessory)`;
      stack.push({ component: currentComponent.accessory, path: accessoryPath });
    }

    // Add children to stack in reverse order to maintain left-to-right processing
    if (currentComponent.children) {
      for (let i = currentComponent.children.length - 1; i >= 0; i -= 1) {
        const child = currentComponent.children[i];
        const childPath = `${path} > ${child.name}`;
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
      path: getComponentPath(messageComponent, MESSAGE_ROOT_ID) || "Message Root",
      componentId: MESSAGE_ROOT_ID,
    });
  }

  if (messageComponent.type === ComponentType.LegacyRoot) {
    messageComponent.children.forEach((component) => {
      if (component.type !== ComponentType.LegacyEmbed) {
        return;
      }

      const authorName = component.children?.find(
        (c) => c.type === ComponentType.LegacyEmbedAuthor
      )?.authorName;
      const title = component.children?.find(
        (c) => c.type === ComponentType.LegacyEmbedTitle
      )?.title;
      const description = component.children?.find(
        (c) => c.type === ComponentType.LegacyEmbedDescription
      )?.description;
      const footerText = component.children?.find(
        (c) => c.type === ComponentType.LegacyEmbedFooter
      )?.footerText;
      const imageUrl = component.children?.find(
        (c) => c.type === ComponentType.LegacyEmbedImage
      )?.imageUrl;
      const thumbnailUrl = component.children?.find(
        (c) => c.type === ComponentType.LegacyEmbedThumbnail
      )?.thumbnailUrl;

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
