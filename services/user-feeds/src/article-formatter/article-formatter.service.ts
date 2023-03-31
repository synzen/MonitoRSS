import { Injectable } from "@nestjs/common";
import { convert, HtmlToTextOptions, SelectorDefinition } from "html-to-text";
import { Article } from "../shared";
import { FormatOptions } from "./types";

@Injectable()
export class ArticleFormatterService {
  async formatArticleForDiscord(
    article: Article,
    options: Omit<FormatOptions, "split">
  ): Promise<Article> {
    const newRecord: Article = {
      flattened: {
        ...article.flattened,
      },
      raw: {
        ...article.raw,
      },
    };

    await Promise.all(
      Object.keys(newRecord.flattened).map(async (key) => {
        newRecord.flattened[key] = await this.formatValueForDiscord(
          newRecord.flattened[key],
          options
        );
      })
    );

    return newRecord;
  }

  async formatValueForDiscord(value: string, options?: FormatOptions) {
    const tableSelector: SelectorDefinition = {
      selector: "table",
      format: "dataTable",
      options: {
        maxColumnWidth: 60,
      },
    };

    const imageSelector: SelectorDefinition = {
      selector: "img",
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
      options: {
        ignoreHref: true,
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
          builder.addInline("__");
          walk(elem.children, builder);
          builder.addInline("__");
          builder.closeBlock(options);
        },
      },
      selectors: [
        imageSelector,
        strongSelector,
        emSelector,
        uSelector,
        anchorSelector,
      ],
    };

    if (options?.formatTables) {
      htmlToTextOptions.selectors?.push(tableSelector);
    }

    if (options?.stripImages) {
      imageSelector.format = "skip";
    }

    return convert(value, htmlToTextOptions);
  }

  applySplit(text: string, splitOptions?: FormatOptions["split"]) {
    const limit = splitOptions?.limit || 2000;
    const splitChar = splitOptions?.splitChar || ".";
    const appendChar = splitOptions?.appendChar ?? "...";
    const prependChar = splitOptions?.prependChar ?? "";

    console.log(splitOptions, appendChar);

    const split = this.splitText(text, {
      splitChar,
      limit,
      appendChar,
      prependChar,
    });

    if (splitOptions?.isEnabled) {
      if (split.length === 1) {
        return [prependChar + split[0] + appendChar];
      } else if (split.length === 2) {
        const firstPart = split[0];
        const lastPart = split[1];

        return [prependChar + firstPart, lastPart + appendChar];
      } else {
        const firstPart = split[0];
        const lastPart = split[split.length - 1];

        return [
          prependChar + firstPart,
          ...split.slice(1, split.length - 1),
          lastPart + appendChar,
        ];
      }
    } else {
      return [split[0]];
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
    const initialSplit = text
      .trim()
      .split("\n")
      .filter((item) => item.length > 0);
    const useLimit =
      options.limit - options.appendChar.length - options.prependChar.length;

    let i = 0;

    // Add the char back to the end of the split
    initialSplit.forEach((item, index) => {
      initialSplit[index] = item + "\n";
    });

    while (i < initialSplit.length) {
      const item = initialSplit[i];

      if (item.length > useLimit) {
        // Some will be empty spaces since "hello." will split into ["hello", ""]
        const splitByPeriod = item
          .split(options.splitChar)
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
