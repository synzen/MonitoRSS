import { Injectable } from "@nestjs/common";
import dayjs from "dayjs";
import { flatten } from "flat";
import { ARTICLE_FIELD_DELIMITER } from "../articles/constants";
import { Article, UserFeedFormatOptions } from "../shared";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { parse, valid } from "node-html-parser";

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

    const entries = Object.entries(newRecord);

    for (let i = 0; i < entries.length; i++) {
      const [key, value] = entries[i];

      const { images: imageList, anchors: anchorList } =
        this.extractExtraInfo(value);

      if (imageList.length) {
        for (let i = 0; i < imageList.length; i++) {
          const image = imageList[i];

          newRecord[`extracted::${key}::image${i + 1}`] = image;
        }
      }

      if (anchorList.length) {
        for (let i = 0; i < anchorList.length; i++) {
          const anchor = anchorList[i];

          newRecord[`extracted::${key}::anchor${i + 1}`] = anchor;
        }
      }
    }

    return {
      flattened: newRecord,
    };
  }

  extractExtraInfo(inputString: string): {
    images: string[];
    anchors: string[];
  } {
    const isValid = valid(inputString);

    if (!isValid) {
      return {
        images: [],
        anchors: [],
      };
    }

    const root = parse(inputString);

    const images = root
      .getElementsByTagName("img")
      .map((e) => e.getAttribute("src"))
      .filter((e): e is string => !!e);

    const anchors = root
      .querySelectorAll("a")
      .map((e) => e.getAttribute("href"))
      .filter((e): e is string => !!e);

    return {
      images,
      anchors,
    };
  }
}
