import type { PlaceholderLimit, GenerateTextOptions } from "./types";
import { truncateText } from "./text-splitter";

export function replaceTemplateString(
  object: Record<string, string | undefined>,
  str: string | undefined | null,
  options?: {
    supportFallbacks?: boolean;
    split?: {
      func: (
        str: string,
        options: { appendString?: string | null; limit: number }
      ) => string;
      limits?: PlaceholderLimit[] | null;
    };
  }
): string | undefined {
  if (!str) return str || undefined;

  const regex = /\{\{(.+?)\}\}/gi;
  let result: RegExpExecArray | null;
  let outputStr = str;

  while ((result = regex.exec(str)) !== null) {
    const accessor = result[1]!;
    let value = "";
    let usedPlaceholder: string | null = null;

    if (options?.supportFallbacks) {
      const values = accessor.split("||");
      for (const subvalue of values) {
        // Special "text::" prefix for literal fallback text
        if (subvalue.startsWith("text::")) {
          value = subvalue.replace("text::", "");
          usedPlaceholder = null; // literal text, no placeholder limit applies
          break;
        }
        const valueInObject = object[subvalue];
        if (valueInObject) {
          value = valueInObject;
          usedPlaceholder = subvalue;
          break;
        }
      }
    } else {
      value = object[accessor] || "";
      usedPlaceholder = accessor;
    }

    // Apply split limits for specific placeholders
    // Check for limit on: 1) the specific placeholder that provided the value, 2) the full accessor
    if (options?.split?.func && options.split.limits) {
      const limit = options.split.limits.find(
        (i) =>
          (usedPlaceholder && i.placeholder === usedPlaceholder) ||
          i.placeholder === accessor
      );
      if (limit) {
        const appendString = replaceTemplateString(object, limit.appendString, {
          supportFallbacks: true,
        });
        value = options.split.func(value, {
          limit: limit.characterCount,
          appendString: appendString ?? null,
        });
      }
    }

    outputStr = outputStr.replaceAll(result[0], value);
  }

  return outputStr;
}

export function generateText(options: GenerateTextOptions): string | undefined {
  const { content, limit, flattened, enablePlaceholderFallback } = options;

  if (!content) return undefined;

  const replaced = replaceTemplateString(flattened, content, {
    supportFallbacks: enablePlaceholderFallback,
  });

  if (limit && replaced) {
    return truncateText(replaced, limit);
  }

  return replaced;
}
