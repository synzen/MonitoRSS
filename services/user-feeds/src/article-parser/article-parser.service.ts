import { Injectable } from "@nestjs/common";
import dayjs from "dayjs";
import { flatten } from "flat";
import { ARTICLE_FIELD_DELIMITER } from "../articles/constants";
import { Article, UserFeedFormatOptions } from "../shared";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { convert, HtmlToTextOptions, SelectorDefinition } from "html-to-text";

dayjs.extend(timezone);
dayjs.extend(utc);

type FlattenedArticleWithoutId = Omit<Article["flattened"], "id">;

@Injectable()
export class ArticleParserService {
  flatten(
    input: Record<string, unknown>,
    formatOptions?: UserFeedFormatOptions
  ): {
    flattened: FlattenedArticleWithoutId;
  } {
    const flattened = flatten(input, {
      delimiter: ARTICLE_FIELD_DELIMITER,
    }) as Record<string, unknown>;

    const newRecord: FlattenedArticleWithoutId = {};

    Object.entries(flattened).forEach(([key, value]) => {
      if (!value) {
        return;
      }

      if (typeof value === "string") {
        const trimmed = value.trim();

        if (trimmed.length) {
          newRecord[key] = trimmed;
        }

        return;
      }

      if (value instanceof Date) {
        const useTimezone = formatOptions?.dateTimezone || "UTC";
        const dateVal = dayjs(value).tz(useTimezone);
        let stringDate = dateVal.format();

        if (formatOptions?.dateFormat) {
          stringDate = dateVal.format(formatOptions.dateFormat);
        }

        newRecord[key] = stringDate;

        return;
      }

      if ({}.constructor === value.constructor) {
        if (Object.keys(value).length) {
          throw new Error(
            "Non-empty object found in flattened record. " +
              'Check that "flatten" is working as intended'
          );
        }

        return;
      }

      if (Array.isArray(value)) {
        if (value.length) {
          throw new Error(
            "Non-empty array found in flattened record. " +
              'Check that "flatten" is working as intended'
          );
        }

        return;
      }

      newRecord[key] = String(value);
    });

    Object.entries(newRecord).forEach(([key, value]) => {
      const { images: imageList, anchors: anchorList } =
        this.extractExtraInfo(value);

      if (imageList.length) {
        for (let i = 0; i < imageList.length; i++) {
          const image = imageList[i];

          newRecord[`extracted::${key}::image::${i + 1}`] = image;
        }
      }

      if (anchorList.length) {
        for (let i = 0; i < anchorList.length; i++) {
          const anchor = anchorList[i];

          newRecord[`extracted::${key}::anchor::${i + 1}`] = anchor;
        }
      }
    });

    return {
      flattened: newRecord,
    };
  }

  extractExtraInfo(inputString: string): {
    images: string[];
    anchors: string[];
  } {
    const images: string[] = [];
    const anchors: string[] = [];

    const imageSelector: SelectorDefinition = {
      selector: "img",
      format: "images",
    };

    const anchorSelector: SelectorDefinition = {
      selector: "a",
      format: "anchors",
      options: {
        ignoreHref: true,
      },
    };

    const htmlToTextOptions: HtmlToTextOptions = {
      formatters: {
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
      selectors: [imageSelector, anchorSelector],
    };

    convert(inputString, htmlToTextOptions);

    return {
      images,
      anchors,
    };
  }
}
