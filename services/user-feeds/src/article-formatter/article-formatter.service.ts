import { Injectable } from "@nestjs/common";
import { convert, HtmlToTextOptions, SelectorDefinition } from "html-to-text";
import { Article, ArticleDiscordFormatted } from "../shared";
import { FormatOptions } from "./types";

@Injectable()
export class ArticleFormatterService {
  async formatArticleForDiscord(
    article: Article,
    options: Omit<FormatOptions, "split">
  ): Promise<ArticleDiscordFormatted> {
    const flattened: Article["flattened"] = {
      ...article.flattened,
    };

    Object.keys(flattened).map((key) => {
      const { value } = this.formatValueForDiscord(flattened[key], options);

      flattened[key] = value;
    });

    return {
      flattened,
      raw: {
        ...article.raw,
      },
    };
  }

  formatValueForDiscord(
    value: string,
    options?: FormatOptions
  ): { value: string } {
    const images: string[] = [];
    const anchors: string[] = [];

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
        itemPrefix: "• ",
      },
    };

    const htmlToTextOptions: HtmlToTextOptions = {
      wordwrap: false,
      formatters: {
        heading: (elem, walk, builder, options) => {
          builder.openBlock(options);
          builder.addInline("**");
          walk(elem.children, builder);
          builder.addInline("**");
          builder.closeBlock(options);
        },
        italicize: (elem, walk, builder, options) => {
          builder.openBlock(options);
          builder.addInline("*");
          walk(elem.children, builder);
          builder.addInline("*");
          builder.closeBlock(options);
        },
        underline: (elem, walk, builder, options) => {
          builder.openBlock(options);
          builder.options.formatters.dataTable;
          builder.addInline("__");
          walk(elem.children, builder);
          builder.addInline("__");
          builder.closeBlock(options);
        },
        codedDataTable: (elem, walk, builder, options) => {
          const dataTableFormatter = builder.options.formatters.dataTable;

          if (dataTableFormatter) {
            builder.openBlock(options);
            builder.addInline("```");
            dataTableFormatter(elem, walk, builder, options);
            builder.addInline("```");
            builder.closeBlock(options);
          }
        },
        images: (elem, walk, builder, options) => {
          const imagesFormatter = builder.options.formatters.image;

          if (imagesFormatter) {
            imagesFormatter(elem, walk, builder, options);

            if (elem.attribs.src) {
              images.push(elem.attribs.src);
            }
          }
        },
        anchors: (elem, walk, builder, options) => {
          const anchorsFormatter = builder.options.formatters.anchor;

          if (anchorsFormatter) {
            anchorsFormatter(elem, walk, builder, options);

            if (elem.attribs.href) {
              anchors.push(elem.attribs.href);
            }
          }
        },
      },
      selectors: [
        imageSelector,
        strongSelector,
        emSelector,
        uSelector,
        anchorSelector,
        unorderedListSelector,
      ],
    };

    if (options?.formatTables) {
      htmlToTextOptions.selectors?.push(tableSelector);
    }

    if (options?.stripImages) {
      imageSelector.format = "skip";
    }

    return {
      value: convert(value, htmlToTextOptions),
    };
  }

  applySplit(text: string, splitOptions?: FormatOptions["split"]) {
    const limit = splitOptions?.limit || 2000;
    const splitChar = splitOptions?.splitChar || ".";
    const appendChar = splitOptions?.appendChar ?? "";
    const prependChar = splitOptions?.prependChar ?? "";

    const split = this.splitText(text, {
      splitChar,
      limit,
      appendChar,
      prependChar,
    });

    if (splitOptions?.isEnabled) {
      if (split.length === 1) {
        return [prependChar + split[0].trim() + appendChar];
      } else if (split.length === 2) {
        const firstPart = split[0].trimStart();
        const lastPart = split[1].trimEnd();

        return [prependChar + firstPart, lastPart + appendChar];
      } else {
        const firstPart = split[0].trimStart();
        const lastPart = split[split.length - 1].trimEnd();

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

  private splitText(
    text: string,
    options: {
      splitChar: string;
      limit: number;
      appendChar: string;
      prependChar: string;
    }
  ) {
    if (!text) {
      return [""];
    }

    const initialSplit = text
      .trim()
      .split(/(\n)/) // Split without removing the new line char
      .filter((item) => item.length > 0);
    const useLimit =
      options.limit - options.appendChar.length - options.prependChar.length;

    let i = 0;

    while (i < initialSplit.length) {
      const item = initialSplit[i];

      if (item.length > useLimit) {
        // Some will be empty spaces since "hello." will split into ["hello", ""]
        const splitByPeriod = item
          .split(options.splitChar)
          .map((i) => i.trim())
          .filter((item) => item.length > 0);

        // Add the char back to the end of the split
        splitByPeriod.forEach((item, index) => {
          splitByPeriod[index] = item + options.splitChar;
        });

        if (splitByPeriod.length > 1) {
          initialSplit.splice(i, 1, ...splitByPeriod);
        } else {
          const splitBySpace = item
            .split(" ")
            .map((i) => i.trim())
            .filter((item) => item.length > 0);

          // Add the char back to the end of the split
          splitBySpace.forEach((item, index) => {
            splitBySpace[index] = item + " ";
          });

          if (splitBySpace.length > 1) {
            initialSplit.splice(i, 1, ...splitBySpace);
          } else {
            // If it's still too long, just split by characters of length limit
            const splitByChar = initialSplit[i].match(
              new RegExp(`.{1,${useLimit}}`, "g")
            ) as string[];

            initialSplit.splice(i, 1, ...splitByChar);
          }
        }
      } else {
        i++;
      }
    }

    const combined = this.compactStringsToLimit(initialSplit, useLimit);

    return combined.map((i) => i.trim()).filter((i) => i);
  }

  private compactStringsToLimit(arr: string[], limit: number) {
    let curIndex = 0;
    const copy = [...arr];

    while (curIndex < copy.length - 1) {
      const curString = copy[curIndex];
      const nextString = copy[curIndex + 1];

      if (curString.length + nextString.length <= limit) {
        copy.splice(curIndex, 2, curString + nextString);
      } else {
        curIndex++;
      }
    }

    return copy;
  }
}
