import type Ajv from "ajv";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export const AjvKeyword = {
  IS_DATE_LOCALE: "isDateLocale",
  IS_TIMEZONE: "isTimezone",
  HAS_AT_LEAST_ONE_VISIBLE_COLUMN: "hasAtLeastOneVisibleColumn",
} as const;

const SUPPORTED_LOCALES = new Set([
  "af",
  "am",
  "ar-dz",
  "ar-iq",
  "ar-kw",
  "ar-ly",
  "ar-ma",
  "ar-sa",
  "ar-tn",
  "ar",
  "az",
  "be",
  "bg",
  "bi",
  "bm",
  "bn-bd",
  "bn",
  "bo",
  "br",
  "bs",
  "ca",
  "cs",
  "cv",
  "cy",
  "da",
  "de-at",
  "de-ch",
  "de",
  "dv",
  "el",
  "en-au",
  "en-ca",
  "en-gb",
  "en-ie",
  "en-il",
  "en-in",
  "en-nz",
  "en-sg",
  "en-tt",
  "en",
  "eo",
  "es-do",
  "es",
  "et",
  "eu",
  "fa",
  "fi",
  "fo",
  "fr-ca",
  "fr-ch",
  "fr",
  "fy",
  "ga",
  "gd",
  "gl",
  "gom-latn",
  "gu",
  "he",
  "hi",
  "hr",
  "ht",
  "hu",
  "hy-am",
  "id",
  "is",
  "it-ch",
  "it",
  "ja",
  "jv",
  "ka",
  "kk",
  "km",
  "kn",
  "ko",
  "ku",
  "ky",
  "lb",
  "lo",
  "lt",
  "lv",
  "me",
  "mi",
  "mk",
  "ml",
  "mn",
  "mr",
  "ms-my",
  "ms",
  "mt",
  "my",
  "nb",
  "ne",
  "nl-be",
  "nl",
  "nn",
  "oc-lnc",
  "pa-in",
  "pl",
  "pt-br",
  "pt",
  "rn",
  "ro",
  "ru",
  "rw",
  "sd",
  "se",
  "si",
  "sk",
  "sl",
  "sq",
  "sr-cyrl",
  "sr",
  "ss",
  "sv-fi",
  "sv",
  "sw",
  "ta",
  "te",
  "tet",
  "tg",
  "th",
  "tk",
  "tl-ph",
  "tlh",
  "tr",
  "tzl",
  "tzm-latn",
  "tzm",
  "ug-cn",
  "uk",
  "ur",
  "uz-latn",
  "uz",
  "vi",
  "x-pseudo",
  "yo",
  "zh-cn",
  "zh-hk",
  "zh-tw",
  "zh",
  "es-pr",
  "es-mx",
  "es-us",
]);

export function dateLocaleKeywordPlugin(ajv: Ajv): Ajv {
  ajv.addKeyword({
    keyword: AjvKeyword.IS_DATE_LOCALE,
    type: "string",
    validate(_schema: boolean, data: string) {
      if (!data) {
        return true;
      }

      return SUPPORTED_LOCALES.has(data);
    },
    error: {
      message: "Invalid date locale",
    },
  });

  return ajv;
}

export function timezoneKeywordPlugin(ajv: Ajv): Ajv {
  ajv.addKeyword({
    keyword: AjvKeyword.IS_TIMEZONE,
    type: "string",
    validate(_schema: boolean, data: string) {
      if (!data) {
        return true;
      }

      try {
        dayjs.tz(undefined, data);

        return true;
      } catch {
        return false;
      }
    },
    error: {
      message: "Invalid timezone",
    },
  });

  return ajv;
}

export function hasAtLeastOneVisibleColumnPlugin(ajv: Ajv): Ajv {
  ajv.addKeyword({
    keyword: AjvKeyword.HAS_AT_LEAST_ONE_VISIBLE_COLUMN,
    type: "object",
    validate(_schema: boolean, data: Record<string, boolean | undefined>) {
      if (!data || typeof data !== "object") {
        return true;
      }

      const values = Object.values(data);

      if (values.every((v) => v === undefined)) {
        return true;
      }

      return values.some((v) => v === true);
    },
    error: {
      message: "At least one column must be visible",
    },
  });

  return ajv;
}
