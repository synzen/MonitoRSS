import { Injectable } from "@nestjs/common";
import { convert, HtmlToTextOptions, SelectorDefinition } from "html-to-text";
import { Article, ArticleDiscordFormatted } from "../shared";
import { FormatOptions } from "./types";
import vm from "node:vm";
import { CustomPlaceholderRegexEvalException } from "../shared/exceptions";

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

    if (options.customPlaceholders) {
      for (const {
        sourcePlaceholder,
        referenceName,
        steps,
      } of options.customPlaceholders) {
        const sourceValue = flattened[sourcePlaceholder];
        const placeholderKeyToUse = `custom::${referenceName}`;

        if (!sourceValue) {
          flattened[placeholderKeyToUse] = "";

          continue;
        }

        let lastOutput = sourceValue;

        for (let i = 0; i < steps.length; ++i) {
          const { regexSearch, replacementString, regexSearchFlags } = steps[i];

          const context = {
            reference: lastOutput,
            replacementString,
            inputRegex: regexSearch,
            inputRegexFlags: regexSearchFlags || "gmi",
            finalVal: lastOutput,
          };

          const script = new vm.Script(`
            const regex = new RegExp(inputRegex, inputRegexFlags);
            finalVal = reference.replace(regex, replacementString || '').trim();
        `);

          try {
            script.runInNewContext(context, {
              timeout: 5000,
            });

            lastOutput = context.finalVal;
          } catch (err) {
            throw new CustomPlaceholderRegexEvalException(
              `Custom placeholder with regex "${regexSearch}" with flags ` +
                `"${regexSearchFlags}" evaluation` +
                ` on text "${lastOutput}"` +
                ` with replacement string "${replacementString}" errored: ` +
                `${(err as Error).message}`,
              {
                regexErrors: [err as Error],
              }
            );
          }
        }

        flattened[placeholderKeyToUse] = lastOutput;
      }
    }

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

    const htmlToTextOptions: HtmlToTextOptions = {
      wordwrap: false,
      formatters: {
        heading: (elem, walk, builder, options) => {
          builder.openBlock(options);
          builder.addLiteral("**");
          walk(elem.children, builder);
          builder.addLiteral("**");
          builder.closeBlock(options);
        },
        paragraph: (elem, walk, builder, options) => {
          builder.openBlock(options);

          for (const child of elem.children) {
            if (child.type === "text") {
              builder.addLiteral(child.data || "");
            } else {
              walk([child], builder);
            }
          }

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

          if (src) {
            images.push(elem.attribs.src);
          }
        },
        anchors: (elem, walk, builder, htmlToTextOptions) => {
          const anchorsFormatter = builder.options.formatters.anchor;

          if (!anchorsFormatter) {
            return;
          }

          const href = elem.attribs.href;

          if (!href) {
            anchorsFormatter(elem, walk, builder, htmlToTextOptions);

            return;
          }

          anchors.push(href);

          if (
            elem.children.length === 1 &&
            elem.children[0].type === "text" &&
            elem.children[0].data === href
          ) {
            builder.addInline(href);
          } else {
            builder.addInline("[");
            walk(elem.children, builder);
            builder.addInline("]");
            builder.addInline(`(${href})`);
          }
        },
        inlineCode: (elem, walk, builder, options) => {
          builder.openBlock(options);
          builder.addInline("`");
          walk(elem.children, builder);
          builder.addInline("`");
          builder.closeBlock(options);
        },
        blockCode: (elem, walk, builder, options) => {
          builder.openBlock(options);
          builder.addInline("```");
          walk(elem.children, builder);
          builder.addInline("```");
          builder.closeBlock(options);
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

  applySplit(
    text: string,
    splitOptions?: FormatOptions["split"] & {
      includeAppendInFirstPart?: boolean;
    }
  ) {
    const limit = splitOptions?.limit || 2000;
    const splitChars = splitOptions?.splitChar
      ? [splitOptions.splitChar]
      : [".", "!", "?"];
    const appendChar = splitOptions?.appendChar ?? "";
    const prependChar = splitOptions?.prependChar ?? "";
    const includeAppendInFirstPart =
      splitOptions?.includeAppendInFirstPart ?? false;

    const split = this.splitText(text, {
      splitChars: splitChars,
      limit,
      appendChar,
      prependChar,
    });

    if (splitOptions?.isEnabled) {
      if (split.length === 1) {
        return [split[0].trim()];
      } else if (split.length === 2) {
        const firstPart = split[0].trimStart();
        const lastPart = split[1].trimEnd();

        if (includeAppendInFirstPart) {
          return [prependChar + firstPart + appendChar, lastPart];
        } else {
          return [prependChar + firstPart, lastPart + appendChar];
        }
      } else {
        const firstPart = split[0].trimStart();
        const lastPart = split[split.length - 1].trimEnd();

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

  private splitText(
    text: string,
    options: {
      splitChars: string[];
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
    let useLimit =
      options.limit - options.appendChar.length - options.prependChar.length;

    if (useLimit <= 0) {
      useLimit = 1;
    }

    let i = 0;

    while (i < initialSplit.length) {
      const item = initialSplit[i];

      if (item.length > useLimit) {
        // Some will be empty spaces since "hello." will split into ["hello", ""]
        const splitByPeriod = item
          .split(
            new RegExp(
              `(${options.splitChars.map(this.escapeRegexString).join("|")})`
            )
          )
          .map((i) => i.trim())
          .filter((item) => item.length > 0);

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

  private escapeRegexString(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
