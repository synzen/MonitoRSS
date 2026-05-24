import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import {
  convert,
  type HtmlToTextOptions,
  type SelectorDefinition,
} from "html-to-text";
import type { Article, FlattenedArticle } from "../../articles/parser";
import { processCustomPlaceholders } from "../../formatting";
import type { FormatOptions } from "../../formatting";
import type { FormatArticleForDiscordResult } from "./formatting-types";

dayjs.extend(timezone);
dayjs.extend(utc);

const FEATURE_CUTOFF_DATES = {
  inlineItalicFormatting: new Date("2026-01-11T01:00:00.000Z"),
} as const;

type FeatureFlag = keyof typeof FEATURE_CUTOFF_DATES;

function hasFeature(
  feature: FeatureFlag,
  connectionCreatedAt?: string
): boolean {
  if (!connectionCreatedAt) return false;
  const cutoff = FEATURE_CUTOFF_DATES[feature];
  return new Date(connectionCreatedAt) > cutoff;
}

export function formatValueForDiscord(
  value: string,
  options?: FormatOptions
): { value: string } {
  const useInlineItalics = hasFeature(
    "inlineItalicFormatting",
    options?.connectionCreatedAt
  );

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

  const bSelector: SelectorDefinition = {
    selector: "b",
    format: "heading",
    options: {
      trailingLineBreaks: 0,
      leadingLineBreaks: 0,
    },
  };

  const emSelector: SelectorDefinition = {
    selector: "em",
    format: useInlineItalics ? "italicizeInline" : "italicize",
  };

  const iSelector: SelectorDefinition = {
    selector: "i",
    format: "italicizeInline",
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
      italicizeInline: (elem, walk, builder) => {
        builder.addLiteral("*");
        walk(elem.children, builder);
        builder.addLiteral("*");
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
      ...(useInlineItalics ? [bSelector] : []),
      emSelector,
      ...(useInlineItalics ? [iSelector] : []),
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

export function formatArticleForDiscord(
  article: Article,
  options?: FormatOptions
): FormatArticleForDiscordResult {
  const flattened: FlattenedArticle = {
    id: article.flattened.id,
    idHash: article.flattened.idHash,
  };

  for (const [key, value] of Object.entries(article.flattened)) {
    if (key === "id" || key === "idHash") continue;

    const { value: formatted } = formatValueForDiscord(value, options);
    flattened[key] = formatted;
  }

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
