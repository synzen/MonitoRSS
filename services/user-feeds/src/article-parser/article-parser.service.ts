import { Injectable } from "@nestjs/common";
import dayjs from "dayjs";
import { flatten } from "flat";
import { ARTICLE_FIELD_DELIMITER } from "../articles/constants";
import { Article, UserFeedFormatOptions } from "../shared";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(timezone);
dayjs.extend(utc);

type ArticleWithoutId = Omit<Article, "id">;

@Injectable()
export class ArticleParserService {
  flatten(
    input: Record<string, unknown>,
    formatOptions?: UserFeedFormatOptions
  ): ArticleWithoutId {
    const flattened = flatten(input, {
      delimiter: ARTICLE_FIELD_DELIMITER,
    }) as Record<string, unknown>;

    const newRecord: ArticleWithoutId = {};

    Object.entries(flattened).forEach(([key, value]) => {
      if (!value) {
        return;
      }

      if (typeof value === "string") {
        const trimmed = value.trim();

        if (trimmed.length) {
          newRecord[key] = value;
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

    return newRecord;
  }
}
