import { Injectable } from "@nestjs/common";
import { convert, HtmlToTextOptions, SelectorDefinition } from "html-to-text";
import {
  Article,
  ArticleDiscordFormatted,
  CustomPlaceholderStepType,
} from "../shared";
import {
  CustomPlaceholderDateFormatStep,
  CustomPlaceholderRegexStep,
  FormatOptions,
} from "./types";
import vm from "node:vm";
import { CustomPlaceholderRegexEvalException } from "../shared/exceptions";
import dayjs from "dayjs";
import tz from "dayjs/plugin/timezone";

// Add for tests to import this file exclusively
dayjs.extend(tz);

@Injectable()
export class ArticleFormatterService {
  async formatArticleForDiscord(
    article: Article,
    options: Omit<FormatOptions, "split">
  ): Promise<{
    article: ArticleDiscordFormatted;
    customPlaceholderPreviews: Array<Array<string>>;
  }> {
    const flattened: Article["flattened"] = {
      ...article.flattened,
    };

    Object.keys(flattened).map((key) => {
      if (key === "id") {
        return;
      }

      const { value } = this.formatValueForDiscord(flattened[key], options);

      flattened[key] = value;
    });

    const allCustomPlaceholderOutputs: string[][] = [];

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
        const allOutputs: string[] = [];

        allOutputs.push(lastOutput);

        for (let i = 0; i < steps.length; ++i) {
          const { type } = steps[i];

          if (type === CustomPlaceholderStepType.Regex) {
            const step = steps[i] as CustomPlaceholderRegexStep;
            const { regexSearch, replacementString, regexSearchFlags } = step;

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
          } else if (type === CustomPlaceholderStepType.UrlEncode) {
            lastOutput = encodeURIComponent(lastOutput);
          } else if (type === CustomPlaceholderStepType.DateFormat) {
            const step = steps[i] as CustomPlaceholderDateFormatStep;
            const { format, timezone, locale } = step;

            let date = dayjs(lastOutput);

            if (!date.isValid()) {
              lastOutput = "";

              continue;
            }

            if (timezone) {
              try {
                date = date.tz(timezone);
              } catch (err) {
                lastOutput = "";
              }
            }

            if (locale) {
              date = date.locale(locale);
            }

            lastOutput = date.format(format);
          } else if (type === CustomPlaceholderStepType.Uppercase) {
            lastOutput = lastOutput.toUpperCase();
          } else if (type === CustomPlaceholderStepType.Lowercase) {
            lastOutput = lastOutput.toLowerCase();
          } else {
            throw new Error(`Custom placeholder has unknown type "${type}"`);
          }

          allOutputs.push(lastOutput);
        }

        allCustomPlaceholderOutputs.push(allOutputs);
        flattened[placeholderKeyToUse] = lastOutput;
      }
    }

    return {
      article: {
        ...article,
        flattened,
        raw: {
          ...article.raw,
        },
      },
      customPlaceholderPreviews: allCustomPlaceholderOutputs,
    };
  }

  formatValueForDiscord(
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
        div: (elem, walk, builder, options) => {
          if (elem.children.length === 0) {
            return;
          }

          builder.openBlock(options);
          walk(elem.children, builder);
          builder.closeBlock(options);
        },
        heading: (elem, walk, builder, options) => {
          /**
           * Spacing should normally be around bolded elements, but is excluded for paragraphs
           * since spacing is accounted for in the paragraph formatter, and anchors since they
           * are converted to masked links
           */
          const skipSpacingAround =
            elem.parent?.type === "tag" &&
            elem.parent.name &&
            ["p", "a"].includes(elem.parent.name);

          builder.openBlock(options);
          builder.addLiteral(`${skipSpacingAround ? "" : " "}**`);
          walk(elem.children, builder);
          builder.addLiteral(`**${skipSpacingAround ? "" : " "}`);
          builder.closeBlock(options);
        },
        paragraph: (elem, walk, builder, options) => {
          if (elem.children.length === 0) {
            return;
          }

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
        },
        anchors: (elem, walk, builder, options) => {
          const anchorsFormatter = builder.options.formatters.anchor;

          if (!anchorsFormatter) {
            return;
          }

          const href = elem.attribs.href;

          if (!href) {
            anchorsFormatter(elem, walk, builder, options);

            return;
          }

          if (
            elem.children.length === 1 &&
            elem.children[0].type === "text" &&
            elem.children[0].data === href
          ) {
            builder.addInline(href);
          } else if (
            elem.children.length === 1 &&
            elem.children[0].name !== "img"
            // For anchors with images, we might end up with "[](image-link-here)"
          ) {
            builder.addInline("[");
            walk(elem.children, builder);
            builder.addInline("]");
            builder.addInline(`(${href})`);
          } else {
            anchorsFormatter(elem, walk, builder, options);
          }
        },
        inlineCode: (elem, walk, builder) => {
          builder.addLiteral("`");
          walk(elem.children, builder);
          builder.addLiteral("`");
        },
        blockCode: (elem, walk, builder, options) => {
          // Handle <pre><code>...</code></pre> as ```...``` instead of ````...````
          if (
            elem.children.length === 1 &&
            elem.children[0].name === "code" &&
            elem.children[0].children.length === 1 &&
            elem.children[0].children[0].type === "text" &&
            elem.children[0].children[0].data
          ) {
            builder.addLiteral("```");
            builder.addLiteral(elem.children[0].children[0].data);
            builder.addLiteral("```");

            return;
          }

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
