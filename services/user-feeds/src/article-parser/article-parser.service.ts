import { Injectable } from "@nestjs/common";
import dayjs from "dayjs";
import { flatten } from "flat";
import { ARTICLE_FIELD_DELIMITER } from "../articles/constants";
import { Article, UserFeedFormatOptions } from "../shared";

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
        if (formatOptions?.dateFormat) {
          newRecord[key] = dayjs(value).format(formatOptions.dateFormat);
        } else {
          newRecord[key] = value.toISOString();
        }

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
