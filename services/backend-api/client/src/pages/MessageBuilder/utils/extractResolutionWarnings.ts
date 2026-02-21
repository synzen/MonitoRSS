import {
  ComponentType,
  MessageBuilderProblem,
  MessageComponentRoot,
  Component,
  ButtonComponent,
  ThumbnailComponent,
} from "../types";
import getComponentPath from "./getComponentPath";
import getMessageBuilderComponentLabel from "./getMessageBuilderComponentLabel";

const PLACEHOLDER_REGEX = /\{\{[^}]+\}\}/;

const COMPONENT_TYPE_TO_DISCORD: Partial<Record<ComponentType, number>> = {
  [ComponentType.V2ActionRow]: 1,
  [ComponentType.V2Button]: 2,
  [ComponentType.V2Section]: 9,
  [ComponentType.V2TextDisplay]: 10,
  [ComponentType.V2Thumbnail]: 11,
  [ComponentType.V2MediaGallery]: 12,
  [ComponentType.V2Divider]: 14,
  [ComponentType.V2Container]: 17,
};

// eslint-disable-next-line no-bitwise
const DISCORD_COMPONENTS_V2_FLAG = 1 << 15;

const hasPlaceholder = (value: string | undefined | null): boolean =>
  !!value && PLACEHOLDER_REGEX.test(value);

const isEmptyResolved = (value: unknown): boolean => !value;

interface WarningContext {
  warnings: MessageBuilderProblem[];
  root: MessageComponentRoot;
}

type ResolvedComponent = Record<string, any>;

const CONSEQUENCE =
  "This may cause article delivery to fail, which can result in this feed getting disabled.";

const checkField = (
  ctx: WarningContext,
  templateComponent: Component,
  templateField: string | undefined | null,
  resolvedValue: unknown,
  fieldLabel: string,
) => {
  if (!hasPlaceholder(templateField) || !isEmptyResolved(resolvedValue)) {
    return;
  }

  const path = getComponentPath(ctx.root, templateComponent.id) || templateComponent.name;
  const componentName = getMessageBuilderComponentLabel(templateComponent.type);

  ctx.warnings.push({
    message: `${componentName} "${fieldLabel}" has a placeholder that resolved to be empty for this article. ${CONSEQUENCE}`,
    path,
    componentId: templateComponent.id,
    severity: "warning",
  });
};

const checkAccessory = (
  ctx: WarningContext,
  accessory: ButtonComponent | ThumbnailComponent,
  resolvedAccessory: ResolvedComponent,
) => {
  switch (accessory.type) {
    case ComponentType.V2Thumbnail:
      checkField(ctx, accessory, accessory.mediaUrl, resolvedAccessory.media?.url, "Image URL");
      break;
    case ComponentType.V2Button:
      checkField(ctx, accessory, accessory.label, resolvedAccessory.label, "Button Label");
      break;
    default: {
      // Compile error here means a new accessory type was added - handle it above
      const _exhaustive: never = accessory;
      break;
    }
  }
};

const walkV2Components = (
  ctx: WarningContext,
  templateChildren: Component[],
  resolvedComponents: ResolvedComponent[],
) => {
  let resolvedIdx = 0;

  for (const templateChild of templateChildren) {
    const expectedDiscordType = COMPONENT_TYPE_TO_DISCORD[templateChild.type];
    const resolved = resolvedComponents[resolvedIdx];

    // If the resolved component doesn't match the expected type, this template component
    // was stripped by the backend (e.g. MediaGallery with stripImages). Skip this template
    // component without advancing resolvedIdx so the next template component can match.
    if (!resolved || (expectedDiscordType != null && resolved.type !== expectedDiscordType)) {
      continue;
    }

    resolvedIdx += 1;

    switch (templateChild.type) {
      case ComponentType.V2TextDisplay:
        checkField(ctx, templateChild, templateChild.content, resolved.content, "Text Content");
        break;

      case ComponentType.V2Button:
        checkField(ctx, templateChild, templateChild.label, resolved.label, "Button Label");
        break;

      case ComponentType.V2Thumbnail:
        checkField(ctx, templateChild, templateChild.mediaUrl, resolved.media?.url, "Image URL");
        break;

      case ComponentType.V2Section: {
        if (resolved.components && templateChild.children) {
          walkV2Components(ctx, templateChild.children, resolved.components);
        }

        if (templateChild.accessory && resolved.accessory) {
          checkAccessory(ctx, templateChild.accessory, resolved.accessory);
        }
        break;
      }

      case ComponentType.V2ActionRow: {
        if (resolved.components && templateChild.children) {
          walkV2Components(ctx, templateChild.children, resolved.components);
        }
        break;
      }

      case ComponentType.V2Container: {
        if (resolved.components && templateChild.children) {
          walkV2Components(ctx, templateChild.children, resolved.components);
        }
        break;
      }

      case ComponentType.V2MediaGallery: {
        const resolvedItems: ResolvedComponent[] = resolved.items || [];
        const templateItems = templateChild.children || [];
        for (let i = 0; i < templateItems.length; i += 1) {
          const tItem = templateItems[i];
          const rItem = resolvedItems[i];
          if (!tItem || !rItem) continue;

          if (tItem.type === ComponentType.V2MediaGalleryItem) {
            checkField(ctx, tItem, tItem.mediaUrl, rItem.media?.url, "Media URL");
          }
        }
        break;
      }

      case ComponentType.V2MediaGalleryItem:
      case ComponentType.V2Divider:
      case ComponentType.V2Root:
      case ComponentType.LegacyRoot:
      case ComponentType.LegacyText:
      case ComponentType.LegacyEmbedContainer:
      case ComponentType.LegacyEmbed:
      case ComponentType.LegacyEmbedAuthor:
      case ComponentType.LegacyEmbedTitle:
      case ComponentType.LegacyEmbedDescription:
      case ComponentType.LegacyEmbedImage:
      case ComponentType.LegacyEmbedThumbnail:
      case ComponentType.LegacyEmbedFooter:
      case ComponentType.LegacyEmbedField:
      case ComponentType.LegacyEmbedTimestamp:
      case ComponentType.LegacyActionRow:
      case ComponentType.LegacyButton:
        break;

      default: {
        // Compile error here means a new ComponentType was added - handle it above
        const _exhaustive: never = templateChild;
        break;
      }
    }
  }
};

const walkLegacyEmbeds = (
  ctx: WarningContext,
  templateRoot: MessageComponentRoot,
  resolvedEmbeds: ResolvedComponent[],
) => {
  let embedIdx = 0;
  const embedContainerChildren =
    templateRoot.children.find((c) => c.type === ComponentType.LegacyEmbedContainer)?.children ||
    [];

  for (const embedComponent of embedContainerChildren) {
    if (embedComponent.type !== ComponentType.LegacyEmbed) continue;

    const resolved = resolvedEmbeds[embedIdx];
    embedIdx += 1;
    if (!resolved) continue;

    for (const subComponent of embedComponent.children || []) {
      switch (subComponent.type) {
        case ComponentType.LegacyEmbedTitle:
          checkField(ctx, subComponent, subComponent.title, resolved.title, "Text");
          break;
        case ComponentType.LegacyEmbedDescription:
          checkField(
            ctx,
            subComponent,
            subComponent.description,
            resolved.description,
            "Description",
          );
          break;
        case ComponentType.LegacyEmbedThumbnail:
          checkField(
            ctx,
            subComponent,
            subComponent.thumbnailUrl,
            resolved.thumbnail?.url,
            "Image URL",
          );
          break;
        case ComponentType.LegacyEmbedImage:
          checkField(ctx, subComponent, subComponent.imageUrl, resolved.image?.url, "Image URL");
          break;
        case ComponentType.LegacyEmbedAuthor:
          checkField(ctx, subComponent, subComponent.authorName, resolved.author?.name, "Name");
          break;
        case ComponentType.LegacyEmbedFooter:
          checkField(ctx, subComponent, subComponent.footerText, resolved.footer?.text, "Text");
          break;
        case ComponentType.LegacyEmbedField:
        case ComponentType.LegacyEmbedTimestamp:
        case ComponentType.LegacyRoot:
        case ComponentType.LegacyText:
        case ComponentType.LegacyEmbedContainer:
        case ComponentType.LegacyEmbed:
        case ComponentType.LegacyActionRow:
        case ComponentType.LegacyButton:
        case ComponentType.V2Root:
        case ComponentType.V2TextDisplay:
        case ComponentType.V2ActionRow:
        case ComponentType.V2Button:
        case ComponentType.V2Section:
        case ComponentType.V2Divider:
        case ComponentType.V2Thumbnail:
        case ComponentType.V2Container:
        case ComponentType.V2MediaGallery:
        case ComponentType.V2MediaGalleryItem:
          break;
        default: {
          // Compile error here means a new ComponentType was added - handle it above
          const _exhaustive: never = subComponent;
          break;
        }
      }
    }
  }
};

const walkLegacyButtons = (
  ctx: WarningContext,
  templateRoot: MessageComponentRoot,
  resolvedComponentRows: ResolvedComponent[],
) => {
  const actionRows = templateRoot.children.filter((c) => c.type === ComponentType.LegacyActionRow);

  for (let rowIdx = 0; rowIdx < actionRows.length; rowIdx += 1) {
    const templateRow = actionRows[rowIdx];
    const resolvedRow = resolvedComponentRows[rowIdx];
    if (!resolvedRow?.components || !templateRow.children) continue;

    for (let btnIdx = 0; btnIdx < templateRow.children.length; btnIdx += 1) {
      const templateBtn = templateRow.children[btnIdx];
      const resolvedBtn = resolvedRow.components[btnIdx];
      if (!templateBtn || !resolvedBtn) continue;

      if (templateBtn.type === ComponentType.LegacyButton) {
        checkField(ctx, templateBtn, templateBtn.label, resolvedBtn.label, "Button Label");
      }
    }
  }
};

const extractResolutionWarnings = (
  templateRoot: MessageComponentRoot | undefined,
  resolvedMessages: ResolvedComponent[] | undefined,
): MessageBuilderProblem[] => {
  if (!templateRoot || !resolvedMessages?.length) {
    return [];
  }

  const ctx: WarningContext = {
    warnings: [],
    root: templateRoot,
  };

  const firstMessage = resolvedMessages[0];

  if (templateRoot.type === ComponentType.V2Root) {
    // eslint-disable-next-line no-bitwise
    const isV2 = ((firstMessage.flags ?? 0) & DISCORD_COMPONENTS_V2_FLAG) !== 0;
    const resolvedComponents: ResolvedComponent[] = isV2 ? firstMessage.components || [] : [];

    walkV2Components(ctx, templateRoot.children, resolvedComponents);
  } else if (templateRoot.type === ComponentType.LegacyRoot) {
    if (firstMessage.embeds) {
      walkLegacyEmbeds(ctx, templateRoot, firstMessage.embeds);
    }

    if (firstMessage.components) {
      walkLegacyButtons(ctx, templateRoot, firstMessage.components);
    }
  }

  return ctx.warnings;
};

export default extractResolutionWarnings;
