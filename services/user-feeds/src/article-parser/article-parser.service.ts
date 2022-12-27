import { Injectable } from "@nestjs/common";
import { flatten } from "flat";
import { ARTICLE_FIELD_DELIMITER } from "../articles/constants";

@Injectable()
export class ArticleParserService {
  flatten(input: Record<string, unknown>): Record<string, string> {
    const flattened = flatten(input, {
      delimiter: ARTICLE_FIELD_DELIMITER,
    }) as Record<string, unknown>;

    const newRecord: Record<string, string> = {};

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
