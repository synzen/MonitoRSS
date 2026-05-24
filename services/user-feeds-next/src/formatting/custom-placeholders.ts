import vm from "node:vm";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import type { FlattenedArticle } from "../articles/parser";
import { CustomPlaceholderRegexEvalException } from "./exceptions";
import {
  CustomPlaceholderStepType,
  type CustomPlaceholder,
  type ProcessCustomPlaceholdersResult,
} from "./types";

dayjs.extend(timezone);
dayjs.extend(utc);

const REGEX_TIMEOUT_MS = 5000;

export function processCustomPlaceholders(
  flattened: FlattenedArticle,
  customPlaceholders: CustomPlaceholder[]
): ProcessCustomPlaceholdersResult {
  const result = { ...flattened };
  const allPreviews: string[][] = [];

  for (const {
    sourcePlaceholder,
    referenceName,
    steps,
  } of customPlaceholders) {
    const sourceValue = result[sourcePlaceholder];
    const placeholderKey = `custom::${referenceName}`;

    if (!sourceValue) {
      result[placeholderKey] = "";
      continue;
    }

    let lastOutput = sourceValue;
    const stepOutputs: string[] = [lastOutput];

    for (const step of steps) {
      switch (step.type) {
        case CustomPlaceholderStepType.Regex: {
          if (!step.regexSearch) break;
          const context = {
            reference: lastOutput,
            replacementString: step.replacementString || "",
            inputRegex: step.regexSearch,
            inputRegexFlags: step.regexSearchFlags || "gmi",
            finalVal: lastOutput,
          };
          const script = new vm.Script(`
            const regex = new RegExp(inputRegex, inputRegexFlags);
            finalVal = reference.replace(regex, replacementString).trim();
          `);
          try {
            script.runInNewContext(context, { timeout: REGEX_TIMEOUT_MS });
            lastOutput = context.finalVal;
          } catch (err) {
            throw new CustomPlaceholderRegexEvalException(
              `Custom placeholder with regex "${step.regexSearch}" with flags ` +
                `"${step.regexSearchFlags || "gmi"}" evaluation` +
                ` on text "${lastOutput}"` +
                ` with replacement string "${step.replacementString || ""}" errored: ` +
                `${(err as Error).message}`,
              {
                regexErrors: [err as Error],
              }
            );
          }
          break;
        }

        case CustomPlaceholderStepType.UrlEncode: {
          lastOutput = encodeURIComponent(lastOutput);
          break;
        }

        case CustomPlaceholderStepType.DateFormat: {
          let date = dayjs(lastOutput);

          if (!date.isValid()) {
            lastOutput = "";
            stepOutputs.push(lastOutput);
            continue;
          }

          if (step.timezone) {
            try {
              date = date.tz(step.timezone);
            } catch {
              lastOutput = "";
              stepOutputs.push(lastOutput);
              continue;
            }
          }

          if (step.locale) {
            date = date.locale(step.locale);
          }

          if (step.format) {
            lastOutput = date.format(step.format);
          }
          break;
        }

        case CustomPlaceholderStepType.Uppercase: {
          lastOutput = lastOutput.toUpperCase();
          break;
        }

        case CustomPlaceholderStepType.Lowercase: {
          lastOutput = lastOutput.toLowerCase();
          break;
        }
      }

      stepOutputs.push(lastOutput);
    }

    allPreviews.push(stepOutputs);
    result[placeholderKey] = lastOutput;
  }

  return { flattened: result, previews: allPreviews };
}
