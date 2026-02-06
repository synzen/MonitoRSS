import type Ajv from "ajv";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export function timezoneKeywordPlugin(ajv: Ajv): Ajv {
  ajv.addKeyword({
    keyword: "isTimezone",
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
