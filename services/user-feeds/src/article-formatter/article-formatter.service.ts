import { Injectable } from "@nestjs/common";
import { convert, HtmlToTextOptions, SelectorDefinition } from "html-to-text";
import { Article } from "../shared";
import { FormatOptions } from "./types";

@Injectable()
export class ArticleFormatterService {
  async formatArticleForDiscord(
    article: Article,
    options: FormatOptions
  ): Promise<Article> {
    const newRecord: Article = {
      ...article,
    };

    await Promise.all(
      Object.keys(newRecord).map(async (key) => {
        newRecord[key] = await this.formatValueForDiscord(
          newRecord[key],
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
}
