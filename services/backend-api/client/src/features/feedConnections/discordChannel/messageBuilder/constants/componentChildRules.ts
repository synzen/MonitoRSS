import { AddableComponentType, Component, ComponentType } from "../types";

/**
 * Whether a child rule's limit counts occurrences of that specific child type
 * ("per-type": a parent may hold one Text AND one Embeds List) or the parent's
 * total child count ("total": a V2 container caps at 10 children of any mix).
 */
export type ChildLimitScope = "per-type" | "total";

export interface ComponentChildRule {
  type: AddableComponentType;
  /** Menu item text and empty-state add-button text. */
  addLabel: string;
  /** Stable id for the menu item (used as the Ark menu item value). */
  value: string;
  max: number;
  limitScope: ChildLimitScope;
  /** Section accessory slot: added to `accessory`, not `children`. */
  isAccessory?: boolean;
}

export interface ComponentChildGroup {
  /** Menu group heading. The live "(n/max)" suffix is appended at render time. */
  title: string;
  /** When true the heading shows "(n/max)"; counted groups in the add menu. */
  showCount?: boolean;
  rules: ComponentChildRule[];
}

/**
 * The single source of truth for "what can be added under each parent component",
 * with the same limits and ordering the add menu and the empty-state prompts both
 * render. Adding a new child type to a parent is a one-entry edit here.
 */
export const COMPONENT_CHILD_RULES: Partial<Record<ComponentType, ComponentChildGroup[]>> = {
  [ComponentType.LegacyRoot]: [
    {
      title: "Text",
      showCount: true,
      rules: [
        {
          type: ComponentType.LegacyText,
          addLabel: "Add Custom Text",
          value: "add-legacy-text",
          max: 1,
          limitScope: "per-type",
        },
      ],
    },
    {
      title: "Embeds List",
      showCount: true,
      rules: [
        {
          type: ComponentType.LegacyEmbedContainer,
          addLabel: "Add Embeds List",
          value: "add-legacy-embed-container",
          max: 1,
          limitScope: "per-type",
        },
      ],
    },
    {
      title: "Action Rows",
      showCount: true,
      rules: [
        {
          type: ComponentType.LegacyActionRow,
          addLabel: "Add Action Row",
          value: "add-legacy-action-row",
          max: 5,
          limitScope: "per-type",
        },
      ],
    },
  ],
  [ComponentType.LegacyEmbed]: [
    {
      title: "Embed Components",
      rules: [
        {
          type: ComponentType.LegacyEmbedAuthor,
          addLabel: "Add Author",
          value: "add-legacy-embed-author",
          max: 1,
          limitScope: "per-type",
        },
        {
          type: ComponentType.LegacyEmbedTitle,
          addLabel: "Add Title",
          value: "add-legacy-embed-title",
          max: 1,
          limitScope: "per-type",
        },
        {
          type: ComponentType.LegacyEmbedDescription,
          addLabel: "Add Description",
          value: "add-legacy-embed-description",
          max: 1,
          limitScope: "per-type",
        },
        {
          type: ComponentType.LegacyEmbedImage,
          addLabel: "Add Image",
          value: "add-legacy-embed-image",
          max: 1,
          limitScope: "per-type",
        },
        {
          type: ComponentType.LegacyEmbedThumbnail,
          addLabel: "Add Thumbnail",
          value: "add-legacy-embed-thumbnail",
          max: 1,
          limitScope: "per-type",
        },
        {
          type: ComponentType.LegacyEmbedFooter,
          addLabel: "Add Footer",
          value: "add-legacy-embed-footer",
          max: 1,
          limitScope: "per-type",
        },
        {
          type: ComponentType.LegacyEmbedTimestamp,
          addLabel: "Add Timestamp",
          value: "add-legacy-embed-timestamp",
          max: 1,
          limitScope: "per-type",
        },
      ],
    },
    {
      title: "Embed Fields",
      showCount: true,
      rules: [
        {
          type: ComponentType.LegacyEmbedField,
          addLabel: "Add Field",
          value: "add-legacy-embed-field",
          max: 25,
          limitScope: "per-type",
        },
      ],
    },
  ],
  [ComponentType.LegacyEmbedContainer]: [
    {
      title: "Embeds",
      showCount: true,
      rules: [
        {
          type: ComponentType.LegacyEmbed,
          addLabel: "Add Embed",
          value: "add-legacy-embed",
          max: 9,
          limitScope: "total",
        },
      ],
    },
  ],
  [ComponentType.LegacyActionRow]: [
    {
      title: "Buttons",
      showCount: true,
      rules: [
        {
          type: ComponentType.LegacyButton,
          addLabel: "Add Button",
          value: "add-legacy-button",
          max: 5,
          limitScope: "total",
        },
      ],
    },
  ],
  [ComponentType.V2Root]: [
    {
      title: "Components",
      showCount: true,
      rules: [
        {
          type: ComponentType.V2ActionRow,
          addLabel: "Add Action Row",
          value: "add-v2-action-row",
          max: 10,
          limitScope: "total",
        },
        {
          type: ComponentType.V2Section,
          addLabel: "Add Section",
          value: "add-v2-section",
          max: 10,
          limitScope: "total",
        },
        {
          type: ComponentType.V2Divider,
          addLabel: "Add Divider",
          value: "add-v2-divider",
          max: 10,
          limitScope: "total",
        },
        {
          type: ComponentType.V2Container,
          addLabel: "Add Container",
          value: "add-v2-container",
          max: 10,
          limitScope: "total",
        },
      ],
    },
  ],
  [ComponentType.V2Container]: [
    {
      title: "Components",
      showCount: true,
      rules: [
        {
          type: ComponentType.V2Section,
          addLabel: "Add Section",
          value: "add-v2-section-in-container",
          max: 10,
          limitScope: "total",
        },
        {
          type: ComponentType.V2ActionRow,
          addLabel: "Add Action Row",
          value: "add-v2-action-row-in-container",
          max: 10,
          limitScope: "total",
        },
        {
          type: ComponentType.V2TextDisplay,
          addLabel: "Add Text Display",
          value: "add-v2-text-display-in-container",
          max: 10,
          limitScope: "total",
        },
        {
          type: ComponentType.V2MediaGallery,
          addLabel: "Add Media Gallery",
          value: "add-v2-media-gallery-in-container",
          max: 10,
          limitScope: "total",
        },
        {
          type: ComponentType.V2Divider,
          addLabel: "Add Divider",
          value: "add-v2-divider-in-container",
          max: 10,
          limitScope: "total",
        },
      ],
    },
  ],
  [ComponentType.V2ActionRow]: [
    {
      title: "Buttons",
      showCount: true,
      rules: [
        {
          type: ComponentType.V2Button,
          addLabel: "Add Button",
          value: "add-v2-button",
          max: 5,
          limitScope: "total",
        },
      ],
    },
  ],
  [ComponentType.V2MediaGallery]: [
    {
      title: "Gallery Items",
      showCount: true,
      rules: [
        {
          type: ComponentType.V2MediaGalleryItem,
          addLabel: "Add Gallery Item",
          value: "add-v2-media-gallery-item",
          max: 10,
          limitScope: "total",
        },
      ],
    },
  ],
  [ComponentType.V2Section]: [
    {
      title: "Text Displays",
      showCount: true,
      rules: [
        {
          type: ComponentType.V2TextDisplay,
          addLabel: "Add Text Display",
          value: "add-v2-text-display-in-section",
          max: 3,
          limitScope: "total",
        },
      ],
    },
    {
      title: "Accessory",
      showCount: true,
      rules: [
        {
          type: ComponentType.V2Button,
          addLabel: "Add Button Accessory",
          value: "add-v2-button-accessory",
          max: 1,
          limitScope: "total",
          isAccessory: true,
        },
        {
          type: ComponentType.V2Thumbnail,
          addLabel: "Add Thumbnail Accessory",
          value: "add-v2-thumbnail-accessory",
          max: 1,
          limitScope: "total",
          isAccessory: true,
        },
      ],
    },
  ],
};

export interface EmptyStateAction {
  type: AddableComponentType;
  label: string;
  isAccessory?: boolean;
}

export interface EmptyStatePrompt {
  /** Distinguishes a parent that needs >1 prompt (e.g. Section: children + accessory). */
  key: string;
  message: string;
  actions: EmptyStateAction[];
  /** Shown only while this returns true (component is missing the relevant child). */
  isMissing: (component: Component) => boolean;
}

const isChildless = (component: Component): boolean =>
  ("children" in component ? component.children : undefined)?.length === 0;

const isAccessoryMissing = (component: Component): boolean =>
  "accessory" in component && component.accessory === undefined;

/**
 * The "this parent is missing a required child — add one" prompts rendered at the top of the
 * component properties panel. Driven by the same child types as the add menu but with their own
 * (shorter) copy, and with the per-parent prompt wording the panel has always shown.
 */
export const EMPTY_STATE_PROMPTS: Partial<Record<ComponentType, EmptyStatePrompt[]>> = {
  [ComponentType.LegacyRoot]: [
    {
      key: "children",
      message: "Add at least one component to your message.",
      isMissing: isChildless,
      actions: [
        { type: ComponentType.LegacyText, label: "Add Text" },
        { type: ComponentType.LegacyEmbedContainer, label: "Add Embeds" },
        { type: ComponentType.LegacyActionRow, label: "Add Action Row" },
      ],
    },
  ],
  [ComponentType.V2Root]: [
    {
      key: "children",
      message: "Add at least one component to your message.",
      isMissing: isChildless,
      actions: [
        { type: ComponentType.V2Section, label: "Add Section" },
        { type: ComponentType.V2ActionRow, label: "Add Action Row" },
        { type: ComponentType.V2Container, label: "Add Container" },
        { type: ComponentType.V2Divider, label: "Add Divider" },
      ],
    },
  ],
  [ComponentType.LegacyActionRow]: [
    {
      key: "children",
      message: "Add at least one button to your Action Row.",
      isMissing: isChildless,
      actions: [{ type: ComponentType.LegacyButton, label: "Add Button" }],
    },
  ],
  [ComponentType.V2ActionRow]: [
    {
      key: "children",
      message: "Add at least one button to your Action Row.",
      isMissing: isChildless,
      actions: [{ type: ComponentType.V2Button, label: "Add Button" }],
    },
  ],
  [ComponentType.V2Container]: [
    {
      key: "children",
      message: "Add at least one component to your Container.",
      isMissing: isChildless,
      actions: [
        { type: ComponentType.V2Section, label: "Add Section" },
        { type: ComponentType.V2TextDisplay, label: "Add Text Display" },
        { type: ComponentType.V2ActionRow, label: "Add Action Row" },
        { type: ComponentType.V2MediaGallery, label: "Add Media Gallery" },
        { type: ComponentType.V2Divider, label: "Add Divider" },
      ],
    },
  ],
  [ComponentType.V2MediaGallery]: [
    {
      key: "children",
      message: "Add at least one item to your Media Gallery.",
      isMissing: isChildless,
      actions: [{ type: ComponentType.V2MediaGalleryItem, label: "Add Gallery Item" }],
    },
  ],
  [ComponentType.V2Section]: [
    {
      key: "children",
      message: "Add at least one text display to your Section.",
      isMissing: isChildless,
      actions: [{ type: ComponentType.V2TextDisplay, label: "Add Text Display" }],
    },
    {
      key: "accessory",
      message: "An accessory (thumbnail or button) is required for Sections.",
      isMissing: isAccessoryMissing,
      actions: [
        { type: ComponentType.V2Thumbnail, label: "Add Thumbnail", isAccessory: true },
        { type: ComponentType.V2Button, label: "Add Button", isAccessory: true },
      ],
    },
  ],
};

const getChildren = (component: Component): Component[] =>
  "children" in component && Array.isArray(component.children) ? component.children : [];

const hasAccessory = (component: Component): boolean =>
  "accessory" in component && component.accessory !== undefined;

/** Live count shown in a group's "(n/max)" heading. */
export const getGroupCount = (component: Component, group: ComponentChildGroup): number => {
  const [firstRule] = group.rules;

  if (firstRule.isAccessory) {
    return hasAccessory(component) ? 1 : 0;
  }

  if (firstRule.limitScope === "total") {
    return getChildren(component).length;
  }

  const children = getChildren(component);

  return group.rules.reduce(
    (sum, rule) => sum + children.filter((c) => c.type === rule.type).length,
    0,
  );
};

/** Whether adding this child is blocked because the relevant limit is reached. */
export const isChildRuleAtLimit = (component: Component, rule: ComponentChildRule): boolean => {
  if (rule.isAccessory) {
    return hasAccessory(component);
  }

  const children = getChildren(component);

  if (rule.limitScope === "total") {
    return children.length >= rule.max;
  }

  return children.filter((c) => c.type === rule.type).length >= rule.max;
};

const nonAccessoryRules = (parentType: ComponentType): ComponentChildRule[] =>
  (COMPONENT_CHILD_RULES[parentType] ?? [])
    .flatMap((group) => group.rules)
    .filter((rule) => !rule.isAccessory);

/**
 * The cap on a parent's total `children` count, if it has one. Returns null for parents whose
 * children are limited per-type rather than by a single total (LegacyRoot, LegacyEmbed) — those have
 * no array-level max. Source of truth for the schema's array `.max()`.
 */
export const getMaxTotalChildren = (parentType: ComponentType): number | null => {
  const totalRules = nonAccessoryRules(parentType).filter((rule) => rule.limitScope === "total");

  if (!totalRules.length) {
    return null;
  }

  return Math.min(...totalRules.map((rule) => rule.max));
};

/** The cap on a specific child type under a parent, if one is declared. */
export const getMaxForChildType = (
  parentType: ComponentType,
  childType: AddableComponentType,
): number | null => {
  const rule = nonAccessoryRules(parentType).find((r) => r.type === childType);

  return rule ? rule.max : null;
};
