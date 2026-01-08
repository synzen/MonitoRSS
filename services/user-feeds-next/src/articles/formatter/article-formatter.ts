import vm from "node:vm";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import objectPath from "object-path";
import {
  convert,
  type HtmlToTextOptions,
  type SelectorDefinition,
} from "html-to-text";
import type { Article, FlattenedArticle } from "../parser";
import { getArticleFilterResults, type LogicalExpression } from "../filters";
import { CustomPlaceholderRegexEvalException } from "./exceptions";

dayjs.extend(timezone);
dayjs.extend(utc);

// ============================================================================
// Constants
// ============================================================================

const ARTICLE_FIELD_DELIMITER = "__";

// ============================================================================
// Utilities
// ============================================================================

/**
 * Get a nested value with an accessor string where the fields are separated with
 * the delimiter (__).
 */
export function getNestedPrimitiveValue(
  object: Record<string, unknown>,
  accessor: string
): string | null {
  const fields = accessor.split(ARTICLE_FIELD_DELIMITER);
  const value = objectPath.get(object, fields);

  if (value == null) {
    return null;
  }

  if (Array.isArray(value)) {
    return null;
  }

  if (value.constructor.name === "Object") {
    return null;
  }

  if (value instanceof Date) {
    const date = dayjs(value);

    if (date.isValid()) {
      return date.toISOString();
    }

    return null;
  }

  return String(value);
}

// ============================================================================
// Types
// ============================================================================

export enum CustomPlaceholderStepType {
  UrlEncode = "URL_ENCODE",
  DateFormat = "DATE_FORMAT",
  Regex = "REGEX",
  Uppercase = "UPPERCASE",
  Lowercase = "LOWERCASE",
}

export interface CustomPlaceholderStep {
  type: CustomPlaceholderStepType;
  regexSearch?: string;
  regexSearchFlags?: string;
  replacementString?: string;
  format?: string;
  timezone?: string;
  locale?: string;
}

export interface CustomPlaceholder {
  id: string;
  referenceName: string;
  sourcePlaceholder: string;
  steps: CustomPlaceholderStep[];
}

export interface PlaceholderLimit {
  placeholder: string;
  characterCount: number;
  appendString?: string;
}

export interface SplitOptions {
  splitChar?: string;
  appendChar?: string;
  prependChar?: string;
  limit?: number;
  isEnabled?: boolean;
}

export interface FormatOptions {
  stripImages?: boolean;
  formatTables?: boolean;
  disableImageLinkPreviews?: boolean;
  ignoreNewLines?: boolean;
  customPlaceholders?: CustomPlaceholder[];
}

// ============================================================================
// HTML to Discord Formatting
// ============================================================================

/**
 * Convert HTML to Discord-formatted text.
 * Converts HTML elements to Discord markdown equivalents.
 */
export function formatValueForDiscord(
  value: string,
  options?: FormatOptions
): { value: string } {
  const tableSelector: SelectorDefinition = {
    selector: "table",
    format: "codedDataTable",
    options: {
      maxColumnWidth: 60,
    },
  };

  const imageSelector: SelectorDefinition = {
    selector: "img",
    format: "images",
    options: {
      linkBrackets: false,
    },
  };

  const strongSelector: SelectorDefinition = {
    selector: "strong",
    format: "heading",
    options: {
      trailingLineBreaks: 0,
      leadingLineBreaks: 0,
    },
  };

  const emSelector: SelectorDefinition = {
    selector: "em",
    format: "italicize",
  };

  const uSelector: SelectorDefinition = {
    selector: "u",
    format: "underline",
  };

  const anchorSelector: SelectorDefinition = {
    selector: "a",
    format: "anchors",
    options: {
      ignoreHref: true,
    },
  };

  const unorderedListSelector: SelectorDefinition = {
    selector: "ul",
    options: {
      itemPrefix: "* ",
    },
  };

  const codeSelector: SelectorDefinition = {
    selector: "code",
    format: "inlineCode",
  };

  const preSelector: SelectorDefinition = {
    selector: "pre",
    format: "blockCode",
  };

  const pSelector: SelectorDefinition = {
    selector: "p",
    format: "paragraph",
  };

  const divSelector: SelectorDefinition = {
    selector: "div",
    format: "div",
  };

  const htmlToTextOptions: HtmlToTextOptions = {
    wordwrap: false,
    preserveNewlines: options?.ignoreNewLines ? false : true,
    formatters: {
      div: (elem, walk, builder, formatOptions) => {
        if (elem.children.length === 0) {
          return;
        }

        builder.openBlock(formatOptions);
        walk(elem.children, builder);
        builder.closeBlock(formatOptions);
      },
      heading: (elem, walk, builder, formatOptions) => {
        /**
         * Spacing should normally be around bolded elements, but is excluded for paragraphs
         * since spacing is accounted for in the paragraph formatter, and anchors since they
         * are converted to masked links
         */
        const skipSpacingAround =
          elem.parent?.type === "tag" &&
          elem.parent.name &&
          ["p", "a"].includes(elem.parent.name);

        builder.openBlock(formatOptions);
        builder.addLiteral(`${skipSpacingAround ? "" : " "}**`);
        walk(elem.children, builder);
        builder.addLiteral(`**${skipSpacingAround ? "" : " "}`);
        builder.closeBlock(formatOptions);
      },
      paragraph: (elem, walk, builder, formatOptions) => {
        if (elem.children.length === 0) {
          return;
        }

        builder.openBlock(formatOptions);

        for (const child of elem.children) {
          if (child.type === "text") {
            builder.addLiteral(child.data || "");
          } else {
            walk([child], builder);
          }
        }

        builder.closeBlock(formatOptions);
      },
      italicize: (elem, walk, builder, formatOptions) => {
        builder.openBlock(formatOptions);
        builder.addInline("*");
        walk(elem.children, builder);
        builder.addInline("*");
        builder.closeBlock(formatOptions);
      },
      underline: (elem, walk, builder, formatOptions) => {
        builder.openBlock(formatOptions);
        builder.addInline("__");
        walk(elem.children, builder);
        builder.addInline("__");
        builder.closeBlock(formatOptions);
      },
      codedDataTable: (elem, walk, builder, formatOptions) => {
        const dataTableFormatter = builder.options.formatters.dataTable;

        if (dataTableFormatter) {
          builder.openBlock(formatOptions);
          builder.addInline("```");
          dataTableFormatter(elem, walk, builder, formatOptions);
          builder.addInline("```");
          builder.closeBlock(formatOptions);
        }
      },
      images: (elem, walk, builder) => {
        const attribs = elem.attribs || {};
        const src = (attribs.src || "").trim();

        if (options?.disableImageLinkPreviews) {
          builder.addInline("<");
        }

        builder.addInline(src);

        if (options?.disableImageLinkPreviews) {
          builder.addInline(">");
        }
      },
      anchors: (elem, walk, builder, formatOptions) => {
        const anchorsFormatter = builder.options.formatters.anchor;

        if (!anchorsFormatter) {
          return;
        }

        const href = elem.attribs.href;

        if (!href) {
          anchorsFormatter(elem, walk, builder, formatOptions);
          return;
        }

        const firstChild = elem.children[0];

        if (
          elem.children.length === 1 &&
          firstChild?.type === "text" &&
          firstChild?.data === href
        ) {
          builder.addInline(href);
        } else if (
          elem.children.length === 1 &&
          firstChild?.name !== "img"
          // For anchors with images, we might end up with "[](image-link-here)"
        ) {
          builder.addInline("[");
          walk(elem.children, builder);
          builder.addInline("]");
          builder.addInline(`(${href})`);
        } else {
          anchorsFormatter(elem, walk, builder, formatOptions);
        }
      },
      inlineCode: (elem, walk, builder) => {
        builder.addLiteral("`");
        walk(elem.children, builder);
        builder.addLiteral("`");
      },
      blockCode: (elem, walk, builder, formatOptions) => {
        // Handle <pre><code>...</code></pre> as ```...``` instead of ````...````
        const firstChild = elem.children[0];
        const codeContent = firstChild?.children?.[0];

        if (
          elem.children.length === 1 &&
          firstChild?.name === "code" &&
          firstChild?.children?.length === 1 &&
          codeContent?.type === "text" &&
          codeContent?.data
        ) {
          builder.addLiteral("```");
          builder.addLiteral(codeContent.data);
          builder.addLiteral("```");
          return;
        }

        builder.openBlock(formatOptions);
        builder.addInline("```");
        walk(elem.children, builder);
        builder.addInline("```");
        builder.closeBlock(formatOptions);
      },
    },
    selectors: [
      imageSelector,
      strongSelector,
      emSelector,
      uSelector,
      anchorSelector,
      unorderedListSelector,
      codeSelector,
      preSelector,
      pSelector,
      divSelector,
    ],
  };

  if (options?.formatTables) {
    htmlToTextOptions.selectors?.push(tableSelector);
  }

  if (options?.stripImages) {
    imageSelector.format = "skip";
  }

  return {
    value: convert(value, htmlToTextOptions).trim(),
  };
}

export interface FormatArticleForDiscordResult {
  article: Article;
  customPlaceholderPreviews: string[][];
}

/**
 * Format an article for Discord output.
 * Converts HTML in all article fields to Discord markdown and processes custom placeholders.
 * This matches the behavior of user-feeds DiscordMediumService.formatArticle.
 */
export function formatArticleForDiscord(
  article: Article,
  options?: FormatOptions
): FormatArticleForDiscordResult {
  const flattened: FlattenedArticle = {
    id: article.flattened.id,
    idHash: article.flattened.idHash,
  };

  // Format each property for Discord
  for (const [key, value] of Object.entries(article.flattened)) {
    if (key === "id" || key === "idHash") continue;

    const { value: formatted } = formatValueForDiscord(value, options);
    flattened[key] = formatted;
  }

  // Process custom placeholders
  if (options?.customPlaceholders?.length) {
    const { flattened: withCustom, previews } = processCustomPlaceholders(
      flattened,
      options.customPlaceholders
    );
    return {
      article: { flattened: withCustom, raw: article.raw },
      customPlaceholderPreviews: previews,
    };
  }

  return {
    article: { flattened, raw: article.raw },
    customPlaceholderPreviews: [],
  };
}

// ============================================================================
// Discord Component Types
// ============================================================================

export enum DiscordComponentType {
  // Legacy components (numeric for backwards compatibility)
  ActionRow = 1,
  Button = 2,

  // V2 components (string enums for easier debugging)
  Section = "SECTION",
  TextDisplay = "TEXT_DISPLAY",
  Thumbnail = "THUMBNAIL",
  ActionRowV2 = "ACTION_ROW",
  ButtonV2 = "BUTTON",
  SeparatorV2 = "SEPARATOR",
  ContainerV2 = "CONTAINER",
  MediaGalleryV2 = "MEDIA_GALLERY",
}

// Mapping from string enum values to Discord API numeric values
export const DISCORD_COMPONENT_TYPE_TO_NUMBER = {
  [DiscordComponentType.Section]: 9,
  [DiscordComponentType.TextDisplay]: 10,
  [DiscordComponentType.Thumbnail]: 11,
  [DiscordComponentType.ActionRowV2]: 1,
  [DiscordComponentType.ButtonV2]: 2,
  [DiscordComponentType.SeparatorV2]: 14,
  [DiscordComponentType.ContainerV2]: 17,
  [DiscordComponentType.MediaGalleryV2]: 12,
} as const;

// V2 Components Flag
export const DISCORD_COMPONENTS_V2_FLAG = 1 << 15; // 32768

// ============================================================================
// V2 Component Types
// ============================================================================

export interface DiscordTextDisplayV2 {
  type: number;
  content: string;
}

export interface DiscordThumbnailV2 {
  type: number;
  media: {
    url: string;
  };
  description?: string | null;
  spoiler?: boolean;
}

export interface DiscordButtonV2 {
  type: number;
  custom_id?: string;
  style: number;
  label?: string;
  emoji?: {
    id: string;
    name?: string | null;
    animated?: boolean | null;
  } | null;
  url?: string | null;
  disabled?: boolean;
}

export interface DiscordSectionV2 {
  type: number;
  components: DiscordTextDisplayV2[];
  accessory: DiscordButtonV2 | DiscordThumbnailV2;
}

export interface DiscordActionRowV2 {
  type: number;
  components: DiscordButtonV2[];
}

export interface DiscordSeparatorV2 {
  type: number;
  divider?: boolean;
  spacing?: number;
}

export interface DiscordMediaGalleryItemV2 {
  media: {
    url: string;
  };
  description?: string | null;
  spoiler?: boolean;
}

export interface DiscordMediaGalleryV2 {
  type: number;
  items: DiscordMediaGalleryItemV2[];
}

export interface DiscordContainerV2 {
  type: number;
  accent_color?: number | null;
  spoiler?: boolean;
  components: DiscordMessageComponentV2[];
}

export type DiscordMessageComponentV2 =
  | DiscordSectionV2
  | DiscordActionRowV2
  | DiscordSeparatorV2
  | DiscordMediaGalleryV2
  | DiscordContainerV2;

// ============================================================================
// V1 Component Types (API output)
// ============================================================================

export interface DiscordMessageComponent {
  type: number;
  components: Array<{
    type: number;
    style: number;
    label: string;
    emoji?: {
      id: string;
      name?: string | null;
      animated?: boolean | null;
    } | null;
    url?: string | null;
  }>;
}

// ============================================================================
// Component Input Types (for configuration)
// ============================================================================

export interface ButtonInput {
  type: typeof DiscordComponentType.Button;
  style: number;
  label: string;
  emoji?: {
    id: string;
    name?: string | null;
    animated?: boolean | null;
  } | null;
  url?: string | null;
}

export interface ActionRowInput {
  type: typeof DiscordComponentType.ActionRow;
  components: ButtonInput[];
}

// V2 Input Types
export interface TextDisplayV2Input {
  type: "TEXT_DISPLAY";
  content: string;
}

export interface ThumbnailV2Input {
  type: "THUMBNAIL";
  media: { url: string };
  description?: string | null;
  spoiler?: boolean;
}

export interface ButtonV2Input {
  type: "BUTTON";
  style: number;
  label?: string;
  emoji?: {
    id: string;
    name?: string | null;
    animated?: boolean | null;
  } | null;
  url?: string | null;
  disabled?: boolean;
}

export interface SectionV2Input {
  type: "SECTION";
  components: TextDisplayV2Input[];
  accessory: ButtonV2Input | ThumbnailV2Input;
}

export interface ActionRowV2Input {
  type: "ACTION_ROW";
  components: ButtonV2Input[];
}

export interface SeparatorV2Input {
  type: "SEPARATOR";
  divider?: boolean;
  spacing?: number;
}

export interface MediaGalleryItemV2Input {
  media: { url: string };
  description?: string | null;
  spoiler?: boolean;
}

export interface MediaGalleryV2Input {
  type: "MEDIA_GALLERY";
  items: MediaGalleryItemV2Input[];
}

export interface ContainerV2Input {
  type: "CONTAINER";
  accent_color?: number | null;
  spoiler?: boolean;
  components: ContainerChildV2Input[];
}

export type ContainerChildV2Input =
  | SeparatorV2Input
  | ActionRowV2Input
  | SectionV2Input
  | TextDisplayV2Input
  | MediaGalleryV2Input;

export type ComponentV2Input =
  | SectionV2Input
  | ActionRowV2Input
  | SeparatorV2Input
  | ContainerV2Input;

export interface MentionTarget {
  id: string;
  type: "user" | "role";
  filters?: {
    expression: LogicalExpression;
  };
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  footer?: { text?: string; iconUrl?: string };
  image?: { url?: string };
  thumbnail?: { url?: string };
  author?: { name?: string; url?: string; iconUrl?: string };
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  timestamp?: "now" | "article" | "";
}

export interface DiscordMessageApiPayload {
  content?: string;
  embeds?: Array<{
    title?: string;
    description?: string;
    url?: string;
    color?: number;
    footer?: { text: string; icon_url?: string };
    image?: { url: string };
    thumbnail?: { url: string };
    author?: { name: string; url?: string; icon_url?: string };
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    timestamp?: string;
  }>;
  components?: DiscordMessageComponent[] | DiscordMessageComponentV2[];
  flags?: number;
}

// ============================================================================
// Placeholder Replacement
// ============================================================================

/**
 * Replace {{placeholder}} syntax in a string with values from an object.
 * Supports fallbacks: {{foo||bar}} uses bar if foo is empty.
 * Supports literal text: {{text::fallback text}}
 */
export function replaceTemplateString(
  object: Record<string, string | undefined>,
  str: string | undefined | null,
  options?: {
    supportFallbacks?: boolean;
    split?: {
      func: (
        str: string,
        options: { appendString?: string | null; limit: number }
      ) => string;
      limits?: PlaceholderLimit[] | null;
    };
  }
): string | undefined {
  if (!str) return str || undefined;

  const regex = /\{\{(.+?)\}\}/gi;
  let result: RegExpExecArray | null;
  let outputStr = str;

  while ((result = regex.exec(str)) !== null) {
    const accessor = result[1]!;
    let value = "";
    let usedPlaceholder: string | null = null;

    if (options?.supportFallbacks) {
      const values = accessor.split("||");
      for (const subvalue of values) {
        // Special "text::" prefix for literal fallback text
        if (subvalue.startsWith("text::")) {
          value = subvalue.replace("text::", "");
          usedPlaceholder = null; // literal text, no placeholder limit applies
          break;
        }
        const valueInObject = object[subvalue];
        if (valueInObject) {
          value = valueInObject;
          usedPlaceholder = subvalue;
          break;
        }
      }
    } else {
      value = object[accessor] || "";
      usedPlaceholder = accessor;
    }

    // Apply split limits for specific placeholders
    // Check for limit on: 1) the specific placeholder that provided the value, 2) the full accessor
    if (options?.split?.func && options.split.limits) {
      const limit = options.split.limits.find(
        (i) =>
          (usedPlaceholder && i.placeholder === usedPlaceholder) ||
          i.placeholder === accessor
      );
      if (limit) {
        const appendString = replaceTemplateString(object, limit.appendString, {
          supportFallbacks: true,
        });
        value = options.split.func(value, {
          limit: limit.characterCount,
          appendString: appendString ?? null,
        });
      }
    }

    outputStr = outputStr.replaceAll(result[0], value);
  }

  return outputStr;
}

// ============================================================================
// Text Splitting
// ============================================================================

/**
 * Escape special regex characters in a string.
 */
function escapeRegexString(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Compact an array of strings by joining adjacent items that fit within the limit.
 */
function compactStringsToLimit(arr: string[], limit: number): string[] {
  let curIndex = 0;
  const copy = [...arr];

  while (curIndex < copy.length - 1) {
    const curString = copy[curIndex]!;
    const nextString = copy[curIndex + 1]!;

    if (curString.length + nextString.length <= limit) {
      copy.splice(curIndex, 2, curString + nextString);
    } else {
      curIndex++;
    }
  }

  return copy;
}

/**
 * Split text into parts that fit within the limit.
 */
function splitText(
  text: string,
  options: {
    splitChars: string[];
    limit: number;
    appendChar: string;
    prependChar: string;
  }
): string[] {
  if (!text) {
    return [""];
  }

  const initialSplit = text
    .trim()
    .split(/(\n)/) // Split without removing the new line char
    .filter((item) => item.length > 0);

  let useLimit =
    options.limit - options.appendChar.length - options.prependChar.length;

  if (useLimit <= 0) {
    useLimit = 1;
  }

  let i = 0;

  while (i < initialSplit.length) {
    const item = initialSplit[i]!;

    if (item.length > useLimit) {
      // Some will be empty spaces since "hello." will split into ["hello", ""]
      const splitByPeriod = item
        .split(
          new RegExp(`(${options.splitChars.map(escapeRegexString).join("|")})`)
        )
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (splitByPeriod.length > 1) {
        initialSplit.splice(i, 1, ...splitByPeriod);
      } else {
        const splitBySpace = item
          .split(" ")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        // Add the char back to the end of the split
        splitBySpace.forEach((_, index) => {
          splitBySpace[index] = splitBySpace[index] + " ";
        });

        if (splitBySpace.length > 1) {
          initialSplit.splice(i, 1, ...splitBySpace);
        } else {
          // If it's still too long, just split by characters of length limit
          const splitByChar = initialSplit[i]!.match(
            new RegExp(`.{1,${useLimit}}`, "g")
          ) as string[];

          initialSplit.splice(i, 1, ...splitByChar);
        }
      }
    } else {
      i++;
    }
  }

  const combined = compactStringsToLimit(initialSplit, useLimit);

  return combined.map((s) => s.trim()).filter((s) => s);
}

/**
 * Split text to fit within character limits.
 */
export function applySplit(
  text: string | undefined,
  options?: SplitOptions & { includeAppendInFirstPart?: boolean }
): string[] {
  if (!text) return [""];

  const limit = options?.limit || 2000;
  const splitChars = options?.splitChar ? [options.splitChar] : [".", "!", "?"];
  const appendChar = options?.appendChar ?? "";
  const prependChar = options?.prependChar ?? "";
  const includeAppendInFirstPart = options?.includeAppendInFirstPart ?? false;

  const split = splitText(text, {
    splitChars,
    limit,
    appendChar,
    prependChar,
  });

  if (options?.isEnabled) {
    if (split.length === 0) {
      return [""];
    } else if (split.length === 1) {
      return [split[0]!.trim()];
    } else if (split.length === 2) {
      const firstPart = split[0]!.trimStart();
      const lastPart = split[1]!.trimEnd();

      if (includeAppendInFirstPart) {
        return [prependChar + firstPart + appendChar, lastPart];
      } else {
        return [prependChar + firstPart, lastPart + appendChar];
      }
    } else {
      const firstPart = split[0]!.trimStart();
      const lastPart = split[split.length - 1]!.trimEnd();

      if (includeAppendInFirstPart) {
        return [
          prependChar + firstPart + appendChar,
          ...split.slice(1, split.length - 1),
          lastPart,
        ];
      }

      return [
        prependChar + firstPart,
        ...split.slice(1, split.length - 1),
        lastPart + appendChar,
      ];
    }
  } else {
    return [split[0]?.trim() || ""];
  }
}

/**
 * Apply split and return first part only.
 */
export function truncateText(text: string | undefined, limit: number): string {
  return applySplit(text, { limit })[0] || "";
}

// ============================================================================
// Custom Placeholders
// ============================================================================

const REGEX_TIMEOUT_MS = 5000;

export interface ProcessCustomPlaceholdersResult {
  flattened: FlattenedArticle;
  previews: string[][];
}

/**
 * Process custom placeholders (regex, URL encode, date format, etc.)
 * Returns the modified flattened article and an array of previews showing
 * the output at each step for each custom placeholder.
 */
export function processCustomPlaceholders(
  flattened: FlattenedArticle,
  customPlaceholders: CustomPlaceholder[]
): ProcessCustomPlaceholdersResult {
  const result = { ...flattened };
  const allPreviews: string[][] = [];

  for (const {
    sourcePlaceholder,
    referenceName,
    steps,
  } of customPlaceholders) {
    const sourceValue = result[sourcePlaceholder];
    const placeholderKey = `custom::${referenceName}`;

    if (!sourceValue) {
      result[placeholderKey] = "";
      continue;
    }

    let lastOutput = sourceValue;
    const stepOutputs: string[] = [lastOutput];

    for (const step of steps) {
      switch (step.type) {
        case CustomPlaceholderStepType.Regex: {
          if (!step.regexSearch) break;
          const context = {
            reference: lastOutput,
            replacementString: step.replacementString || "",
            inputRegex: step.regexSearch,
            inputRegexFlags: step.regexSearchFlags || "gmi",
            finalVal: lastOutput,
          };
          const script = new vm.Script(`
            const regex = new RegExp(inputRegex, inputRegexFlags);
            finalVal = reference.replace(regex, replacementString).trim();
          `);
          try {
            script.runInNewContext(context, { timeout: REGEX_TIMEOUT_MS });
            lastOutput = context.finalVal;
          } catch (err) {
            throw new CustomPlaceholderRegexEvalException(
              `Custom placeholder with regex "${step.regexSearch}" with flags ` +
                `"${step.regexSearchFlags || "gmi"}" evaluation` +
                ` on text "${lastOutput}"` +
                ` with replacement string "${step.replacementString || ""}" errored: ` +
                `${(err as Error).message}`,
              {
                regexErrors: [err as Error],
              }
            );
          }
          break;
        }

        case CustomPlaceholderStepType.UrlEncode: {
          lastOutput = encodeURIComponent(lastOutput);
          break;
        }

        case CustomPlaceholderStepType.DateFormat: {
          let date = dayjs(lastOutput);

          if (!date.isValid()) {
            lastOutput = "";
            stepOutputs.push(lastOutput);
            continue;
          }

          if (step.timezone) {
            try {
              date = date.tz(step.timezone);
            } catch {
              lastOutput = "";
              stepOutputs.push(lastOutput);
              continue;
            }
          }

          if (step.locale) {
            date = date.locale(step.locale);
          }

          if (step.format) {
            lastOutput = date.format(step.format);
          }
          break;
        }

        case CustomPlaceholderStepType.Uppercase: {
          lastOutput = lastOutput.toUpperCase();
          break;
        }

        case CustomPlaceholderStepType.Lowercase: {
          lastOutput = lastOutput.toLowerCase();
          break;
        }
      }

      stepOutputs.push(lastOutput);
    }

    allPreviews.push(stepOutputs);
    result[placeholderKey] = lastOutput;
  }

  return { flattened: result, previews: allPreviews };
}

// ============================================================================
// Discord Message Building
// ============================================================================

export interface GeneratePayloadsOptions {
  content?: string;
  embeds?: DiscordEmbed[];
  splitOptions?: SplitOptions;
  placeholderLimits?: PlaceholderLimit[];
  enablePlaceholderFallback?: boolean;
  mentions?: { targets?: MentionTarget[] };
  components?: ActionRowInput[];
  componentsV2?: ComponentV2Input[];
}

// ============================================================================
// V2 Component Builders
// ============================================================================

interface ReplacePlaceholderContext {
  flattened: Record<string, string | undefined>;
  replaceOptions: {
    supportFallbacks?: boolean;
    split?: {
      func: (
        str: string,
        options: { appendString?: string | null; limit: number }
      ) => string;
      limits?: PlaceholderLimit[] | null;
    };
  };
}

function buildButtonV2(
  button: ButtonV2Input,
  ctx: ReplacePlaceholderContext
): DiscordButtonV2 {
  const isLinkButton = button.style === 5 && button.url;

  return {
    type: DISCORD_COMPONENT_TYPE_TO_NUMBER[DiscordComponentType.ButtonV2],
    ...(isLinkButton ? {} : { custom_id: crypto.randomUUID() }),
    style: button.style,
    label: button.label
      ? truncateText(
          replaceTemplateString(
            ctx.flattened,
            button.label,
            ctx.replaceOptions
          ),
          80
        )
      : undefined,
    emoji: button.emoji,
    url: button.url
      ? replaceTemplateString(
          ctx.flattened,
          button.url,
          ctx.replaceOptions
        )?.replace(/\s/g, "%20")
      : undefined,
    disabled: button.disabled,
  };
}

function buildThumbnailV2(
  thumbnail: ThumbnailV2Input,
  ctx: ReplacePlaceholderContext
): DiscordThumbnailV2 {
  return {
    type: DISCORD_COMPONENT_TYPE_TO_NUMBER[DiscordComponentType.Thumbnail],
    media: {
      url:
        replaceTemplateString(
          ctx.flattened,
          thumbnail.media.url,
          ctx.replaceOptions
        )?.replace(/\s/g, "%20") || "",
    },
    description: thumbnail.description
      ? truncateText(
          replaceTemplateString(
            ctx.flattened,
            thumbnail.description,
            ctx.replaceOptions
          ),
          1024
        )
      : undefined,
    spoiler: thumbnail.spoiler,
  };
}

function buildTextDisplayV2(
  textDisplay: TextDisplayV2Input,
  ctx: ReplacePlaceholderContext
): DiscordTextDisplayV2 {
  return {
    type: DISCORD_COMPONENT_TYPE_TO_NUMBER[DiscordComponentType.TextDisplay],
    content:
      replaceTemplateString(
        ctx.flattened,
        textDisplay.content,
        ctx.replaceOptions
      )?.trim() || "",
  };
}

function buildSectionV2(
  section: SectionV2Input,
  ctx: ReplacePlaceholderContext
): DiscordSectionV2 {
  const components = section.components.map((child) =>
    buildTextDisplayV2(child, ctx)
  );

  const accessory =
    section.accessory.type === "THUMBNAIL"
      ? buildThumbnailV2(section.accessory, ctx)
      : buildButtonV2(section.accessory, ctx);

  return {
    type: DISCORD_COMPONENT_TYPE_TO_NUMBER[DiscordComponentType.Section],
    components,
    accessory,
  };
}

function buildActionRowV2(
  actionRow: ActionRowV2Input,
  ctx: ReplacePlaceholderContext
): DiscordActionRowV2 {
  const buttons = actionRow.components.map((button) =>
    buildButtonV2(button, ctx)
  );

  return {
    type: DISCORD_COMPONENT_TYPE_TO_NUMBER[DiscordComponentType.ActionRowV2],
    components: buttons,
  };
}

function buildSeparatorV2(separator: SeparatorV2Input): DiscordSeparatorV2 {
  return {
    type: DISCORD_COMPONENT_TYPE_TO_NUMBER[DiscordComponentType.SeparatorV2],
    divider: separator.divider,
    spacing: separator.spacing,
  };
}

function buildMediaGalleryV2(
  mediaGallery: MediaGalleryV2Input,
  ctx: ReplacePlaceholderContext
): DiscordMediaGalleryV2 {
  const items = mediaGallery.items.map((item) => ({
    media: {
      url:
        replaceTemplateString(
          ctx.flattened,
          item.media.url,
          ctx.replaceOptions
        )?.replace(/\s/g, "%20") || "",
    },
    description: item.description
      ? truncateText(
          replaceTemplateString(
            ctx.flattened,
            item.description,
            ctx.replaceOptions
          ),
          1024
        )
      : undefined,
    spoiler: item.spoiler,
  })).filter((item) => !!item.media.url);

  return {
    type: DISCORD_COMPONENT_TYPE_TO_NUMBER[DiscordComponentType.MediaGalleryV2],
    items,
  };
}

function buildContainerChildV2(
  child: ContainerChildV2Input,
  ctx: ReplacePlaceholderContext
): DiscordMessageComponentV2 | null {
  switch (child.type) {
    case "SEPARATOR":
      return buildSeparatorV2(child);
    case "ACTION_ROW":
      return buildActionRowV2(child, ctx);
    case "SECTION":
      return buildSectionV2(child, ctx);
    case "TEXT_DISPLAY":
      return buildTextDisplayV2(
        child,
        ctx
      ) as unknown as DiscordMessageComponentV2;
    case "MEDIA_GALLERY": {
      const gallery = buildMediaGalleryV2(child, ctx);

      if (gallery.items.length === 0) {
        return null;
      }

      return gallery;
    } default:
      throw new Error(
        `Unknown container child type: ${(child as { type: string }).type}`
      );
  }
}

function buildContainerV2(
  container: ContainerV2Input,
  ctx: ReplacePlaceholderContext
): DiscordContainerV2 {
  const components = container.components.map((child) =>
    buildContainerChildV2(child, ctx)
  ).filter((c): c is DiscordMessageComponentV2 => c !== null);

  return {
    type: DISCORD_COMPONENT_TYPE_TO_NUMBER[DiscordComponentType.ContainerV2],
    accent_color: container.accent_color ?? undefined,
    spoiler: container.spoiler,
    components,
  };
}

function buildComponentsV2(
  componentsV2: ComponentV2Input[],
  ctx: ReplacePlaceholderContext
): DiscordMessageComponentV2[] {
  return componentsV2.map((component) => {
    switch (component.type) {
      case "ACTION_ROW":
        return buildActionRowV2(component, ctx);
      case "SEPARATOR":
        return buildSeparatorV2(component);
      case "CONTAINER":
        return buildContainerV2(component, ctx);
      case "SECTION":
        return buildSectionV2(component, ctx);
      default:
        throw new Error(
          `Unknown V2 component type: ${(component as { type: string }).type}`
        );
    }
  });
}

// ============================================================================
// V1 Component Builders
// ============================================================================

function buildComponentsV1(
  components: ActionRowInput[],
  ctx: ReplacePlaceholderContext
): DiscordMessageComponent[] {
  return components.map(({ type, components: buttons }) => ({
    type,
    components: buttons.map(({ style, type, label, url, emoji }) => ({
      style,
      type,
      label: truncateText(
        replaceTemplateString(ctx.flattened, label, ctx.replaceOptions) ||
          label,
        80
      ),
      url: url
        ? replaceTemplateString(
            ctx.flattened,
            url,
            ctx.replaceOptions
          )?.replace(/\s/g, "%20")
        : undefined,
      emoji,
    })),
  }));
}

/**
 * Generate Discord API payloads from an article and template options.
 */
export function generateDiscordPayloads(
  article: Article,
  options: GeneratePayloadsOptions
): DiscordMessageApiPayload[] {
  // Custom placeholders are already processed by formatArticleForDiscord()
  const flattened = { ...article.flattened };

  // Build mentions
  if (options.mentions?.targets?.length) {
    const mentions = options.mentions.targets
      .filter((m) => {
        if (!m.filters) return true;
        return getArticleFilterResults(m.filters.expression, article).result;
      })
      .map((m) => (m.type === "role" ? `<@&${m.id}>` : `<@${m.id}>`))
      .join(" ");
    flattened["discord::mentions"] = mentions;
  }

  const replaceOptions = {
    supportFallbacks: options.enablePlaceholderFallback,
    split: options.placeholderLimits
      ? {
          func: (
            str: string,
            opts: { appendString?: string | null; limit: number }
          ) => {
            return applySplit(str, {
              appendChar: opts.appendString ?? undefined,
              limit: opts.limit,
              isEnabled: true,
              includeAppendInFirstPart: true,
            })[0] || ""
          },
          limits: options.placeholderLimits,
        }
      : undefined,
  };

  const ctx: ReplacePlaceholderContext = {
    flattened,
    replaceOptions,
  };

  // V2 components take precedence over V1 - they cannot be mixed
  // V2 components also cannot have content field set
  if (options.componentsV2?.length) {
    return [
      {
        flags: DISCORD_COMPONENTS_V2_FLAG,
        components: buildComponentsV2(options.componentsV2, ctx),
      },
    ];
  }

  // Process content with splitting
  const contentTemplate = replaceTemplateString(
    flattened,
    options.content,
    replaceOptions
  );
  const contentParts = applySplit(contentTemplate, {
    ...options.splitOptions,
    isEnabled: !!options.splitOptions,
  });

  // Create payloads for each content part
  const payloads: DiscordMessageApiPayload[] = contentParts.map((content) => ({
    content: content || undefined,
    embeds: [],
  }));

  // Process embeds and add to last payload
  if (options.embeds?.length) {
    const processedEmbeds = options.embeds
      .map((embed) => {
        const title = truncateText(
          replaceTemplateString(flattened, embed.title, replaceOptions),
          256
        );
        const description = truncateText(
          replaceTemplateString(flattened, embed.description, replaceOptions),
          4096
        );
        const url = replaceTemplateString(flattened, embed.url, replaceOptions);

        // Skip embeds with no content
        if (
          !title &&
          !description &&
          !url &&
          !embed.image?.url &&
          !embed.thumbnail?.url
        ) {
          return null;
        }

        const result: DiscordMessageApiPayload["embeds"] extends
          | (infer T)[]
          | undefined
          ? T
          : never = {
          color: embed.color,
        };

        if (title) result.title = title;
        if (description) result.description = description;
        if (url) result.url = url.replace(/\s/g, "%20");

        if (embed.footer?.text) {
          result.footer = {
            text: truncateText(
              replaceTemplateString(
                flattened,
                embed.footer.text,
                replaceOptions
              ),
              2048
            ),
          };
          if (embed.footer.iconUrl) {
            const iconUrl = replaceTemplateString(
              flattened,
              embed.footer.iconUrl,
              replaceOptions
            );
            if (iconUrl) result.footer.icon_url = iconUrl.replace(/\s/g, "%20");
          }
        }

        if (embed.image?.url) {
          const imageUrl = replaceTemplateString(
            flattened,
            embed.image.url,
            replaceOptions
          );
          if (imageUrl) result.image = { url: imageUrl.replace(/\s/g, "%20") };
        }

        if (embed.thumbnail?.url) {
          const thumbUrl = replaceTemplateString(
            flattened,
            embed.thumbnail.url,
            replaceOptions
          );
          if (thumbUrl)
            result.thumbnail = { url: thumbUrl.replace(/\s/g, "%20") };
        }

        if (embed.author?.name) {
          result.author = {
            name: truncateText(
              replaceTemplateString(
                flattened,
                embed.author.name,
                replaceOptions
              ),
              256
            ),
          };
          if (embed.author.url) {
            const authorUrl = replaceTemplateString(
              flattened,
              embed.author.url,
              replaceOptions
            );
            if (authorUrl) result.author.url = authorUrl.replace(/\s/g, "%20");
          }
          if (embed.author.iconUrl) {
            const iconUrl = replaceTemplateString(
              flattened,
              embed.author.iconUrl,
              replaceOptions
            );
            if (iconUrl) result.author.icon_url = iconUrl.replace(/\s/g, "%20");
          }
        }

        if (embed.fields?.length) {
          result.fields = embed.fields
            .map((field) => ({
              name: truncateText(
                replaceTemplateString(flattened, field.name, replaceOptions),
                256
              ),
              value: truncateText(
                replaceTemplateString(flattened, field.value, replaceOptions),
                1024
              ),
              inline: field.inline,
            }))
            .filter((f) => f.name && f.value);
        }

        if (embed.timestamp === "now") {
          result.timestamp = new Date().toISOString();
        } else if (embed.timestamp === "article" && article.raw.date) {
          const date = dayjs(article.raw.date);
          if (date.isValid()) {
            result.timestamp = date.toISOString();
          }
        }

        return result;
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .slice(0, 10); // Max 10 embeds

    if (processedEmbeds.length > 0) {
      payloads[payloads.length - 1]!.embeds = processedEmbeds;
    }
  }

  // Add V1 components to the last payload
  if (options.components?.length && payloads.length > 0) {
    payloads[payloads.length - 1]!.components = buildComponentsV1(
      options.components,
      ctx
    );
  }

  // Filter out empty payloads
  return payloads.filter(
    (p) =>
      p.content ||
      (p.embeds && p.embeds.length > 0) ||
      (p.components && p.components.length > 0)
  );
}

// ============================================================================
// Forum Thread Types
// ============================================================================

export interface ForumThreadTag {
  id: string;
  filters?: {
    expression: LogicalExpression;
  };
}

// ============================================================================
// Forum Thread and Webhook Helpers
// ============================================================================

export interface GenerateTextOptions {
  content: string | undefined;
  limit?: number;
  flattened: Record<string, string | undefined>;
  enablePlaceholderFallback?: boolean;
}

/**
 * Generate a text string with placeholder replacement and optional limit.
 */
export function generateText(options: GenerateTextOptions): string | undefined {
  const { content, limit, flattened, enablePlaceholderFallback } = options;

  if (!content) return undefined;

  const replaced = replaceTemplateString(flattened, content, {
    supportFallbacks: enablePlaceholderFallback,
  });

  if (limit && replaced) {
    return truncateText(replaced, limit);
  }

  return replaced;
}

/**
 * Get forum tags that should be applied based on article filters.
 */
export function getForumTagsToSend(
  tags: ForumThreadTag[] | undefined | null,
  article: Article
): string[] {
  if (!tags?.length) return [];

  return tags
    .filter((tag) => {
      if (!tag.filters) return true;
      return getArticleFilterResults(tag.filters.expression, article).result;
    })
    .map((tag) => tag.id);
}

/**
 * Generate a thread name from a title template, with fallback to "New Article".
 */
export function generateThreadName(
  article: Article,
  titleTemplate: string | null | undefined,
  options: {
    enablePlaceholderFallback?: boolean;
    customPlaceholders?: CustomPlaceholder[];
  }
): string {
  let flattened = { ...article.flattened };

  if (options.customPlaceholders?.length) {
    const result = processCustomPlaceholders(
      flattened,
      options.customPlaceholders
    );
    flattened = result.flattened;
  }

  return (
    generateText({
      content: titleTemplate || "{{title}}",
      limit: 100,
      flattened,
      enablePlaceholderFallback: options.enablePlaceholderFallback,
    }) || "New Article"
  );
}

/**
 * Build a forum thread body for either channel or webhook forum.
 */
export function buildForumThreadBody(options: {
  isWebhook: boolean;
  threadName: string;
  firstPayload: DiscordMessageApiPayload;
  tags: string[];
}): Record<string, unknown> {
  const { isWebhook, threadName, firstPayload, tags } = options;

  if (isWebhook) {
    return {
      ...firstPayload,
      thread_name: threadName,
      applied_tags: tags,
    };
  }

  return {
    name: threadName,
    message: firstPayload,
    applied_tags: tags,
    type: 11, // GUILD_PUBLIC_THREAD
  };
}

export interface WebhookPayload extends DiscordMessageApiPayload {
  username?: string;
  avatar_url?: string;
}

/**
 * Enhance payloads with webhook username and avatar_url fields.
 */
export function enhancePayloadsWithWebhookDetails(
  article: Article,
  payloads: DiscordMessageApiPayload[],
  webhookName: string | undefined,
  webhookIconUrl: string | undefined,
  options: {
    enablePlaceholderFallback?: boolean;
    customPlaceholders?: CustomPlaceholder[];
  }
): WebhookPayload[] {
  let flattened = { ...article.flattened };

  if (options.customPlaceholders?.length) {
    const result = processCustomPlaceholders(
      flattened,
      options.customPlaceholders
    );
    flattened = result.flattened;
  }

  return payloads.map((payload) => ({
    ...payload,
    username: generateText({
      content: webhookName,
      limit: 256,
      flattened,
      enablePlaceholderFallback: options.enablePlaceholderFallback,
    }),
    avatar_url: generateText({
      content: webhookIconUrl,
      flattened,
      enablePlaceholderFallback: options.enablePlaceholderFallback,
    }),
  }));
}
