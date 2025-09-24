import { FieldError, FieldErrorsImpl, Merge } from "react-hook-form";
import { MESSAGE_ROOT_ID } from "../types";
import MessageBuilderComponent from "../components/base";
import { DiscordComponentType } from "../constants/DiscordComponentType";
import MessageComponentV2Section from "../components/MessageComponentV2Section";
import PreviewerProblem from "../types/PreviewerProblem";
import MessageComponentV2TextDisplay from "../components/MessageComponentV2TextDisplay";
import MessageComponentLegacyEmbedAuthor from "../components/MessageComponentLegacyEmbedAuthor";
import MessageComponentLegacyEmbedTitle from "../components/MessageComponentLegacyEmbedTitle";
import MessageComponentLegacyEmbedDescription from "../components/MessageComponentLegacyEmbedDescription";
import MessageComponentLegacyEmbedFooter from "../components/MessageComponentLegacyEmbedFooter";
import MessageComponentLegacyEmbedImage from "../components/MessageComponentLegacyEmbedImage";
import MessageComponentLegacyEmbedThumbnail from "../components/MessageComponentLegacyEmbedThumbnail";

const getComponentPath = (
  component: MessageBuilderComponent,
  targetId: string,
  currentPath = ""
): string | null => {
  interface StackItem {
    component: MessageBuilderComponent;
    path: string;
  }

  const stack: StackItem[] = [{ component, path: currentPath || component.label }];

  while (stack.length > 0) {
    const { component: currentComponent, path } = stack.pop()!;

    if (currentComponent.id === targetId) {
      return path;
    }

    // Add accessory to stack (will be processed first due to stack LIFO nature)
    if (
      currentComponent.type === DiscordComponentType.V2Section &&
      (currentComponent as MessageComponentV2Section).accessory
    ) {
      const accessoryPath = `${path} > ${currentComponent.label} (accessory)`;
      stack.push({
        component: (currentComponent as MessageComponentV2Section)
          .accessory as MessageBuilderComponent,
        path: accessoryPath,
      });
    }

    // Add children to stack in reverse order to maintain left-to-right processing
    if (currentComponent.children) {
      for (let i = currentComponent.children.length - 1; i >= 0; i -= 1) {
        const child = currentComponent.children[i];
        const childPath = `${path} > ${child.label}`;
        stack.push({ component: child, path: childPath });
      }
    }
  }

  return null;
};

const extractPreviewerProblems = (
  formStateErrors: Merge<FieldError, FieldErrorsImpl<any>> | undefined,
  messageComponent?: MessageBuilderComponent
) => {
  const problems: Array<PreviewerProblem> = [];

  if (!messageComponent) {
    return problems;
  }

  let textDisplayCharacterCount = 0;

  const processErrors = (
    errors: Record<string, any>,
    component: MessageBuilderComponent,
    currentPath = ""
  ) => {
    if (!errors || typeof errors !== "object") return;

    Object.keys(errors).forEach((key) => {
      if (component.type === DiscordComponentType.V2TextDisplay && key === "content") {
        const content = (component as MessageComponentV2TextDisplay).data?.content || "";
        const charCount = content.length;
        textDisplayCharacterCount += charCount;
      }

      // Example key would be "content" for a text display component
      if (typeof errors[key] === "object" && errors[key].message) {
        // This is a direct error message for the current component
        problems.push({
          message: errors[key].message,
          path: getComponentPath(messageComponent, component.id) || component.label,
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
        component.type === DiscordComponentType.V2Section &&
        (component as MessageComponentV2Section).accessory
      ) {
        processErrors(
          errors.accessory,
          (component as MessageComponentV2Section).accessory as MessageBuilderComponent,
          currentPath
        );
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

  if (messageComponent.type === DiscordComponentType.LegacyRoot) {
    messageComponent.children?.forEach((component) => {
      if (component.type !== DiscordComponentType.LegacyEmbed) {
        return;
      }

      const authorComponent = component.children?.find(
        (c) => c.type === DiscordComponentType.LegacyEmbedAuthor
      ) as MessageComponentLegacyEmbedAuthor | undefined;
      const titleComponent = component.children?.find(
        (c) => c.type === DiscordComponentType.LegacyEmbedTitle
      ) as MessageComponentLegacyEmbedTitle | undefined;
      const descriptionComponent = component.children?.find(
        (c) => c.type === DiscordComponentType.LegacyEmbedDescription
      ) as MessageComponentLegacyEmbedDescription | undefined;
      const footerComponent = component.children?.find(
        (c) => c.type === DiscordComponentType.LegacyEmbedFooter
      ) as MessageComponentLegacyEmbedFooter | undefined;
      const imageComponent = component.children?.find(
        (c) => c.type === DiscordComponentType.LegacyEmbedImage
      ) as MessageComponentLegacyEmbedImage | undefined;
      const thumbnailComponent = component.children?.find(
        (c) => c.type === DiscordComponentType.LegacyEmbedThumbnail
      ) as MessageComponentLegacyEmbedThumbnail | undefined;

      const authorName = authorComponent?.data?.authorName;
      const title = titleComponent?.data?.title;
      const description = descriptionComponent?.data?.description;
      const footerText = footerComponent?.data?.footerText;
      const imageUrl = imageComponent?.data?.imageUrl;
      const thumbnailUrl = thumbnailComponent?.data?.thumbnailUrl;

      if (!authorName && !title && !description && !footerText && !imageUrl && !thumbnailUrl) {
        problems.push({
          message:
            "Embed must have at least one of author name, title text, description text, footer text, image URL, or thumbnail URL defined",
          path: getComponentPath(messageComponent, component.id) || component.label,
          componentId: component.id,
        });
      }
    });
  }

  return problems;
};

export default extractPreviewerProblems;
