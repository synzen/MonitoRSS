export function replaceTemplateString(
  object: Record<string, string>,
  str: string | undefined,
  options?: {
    split?: {
      func: (
        str: string,
        options: { appendString?: string | null; limit: number }
      ) => string;
      limits?: Array<{
        characterCount: number;
        key: string;
        appendString?: string | null;
      }> | null;
    };
  }
) {
  if (!str) {
    return str;
  }

  const regex = new RegExp(/{{2}(.+?)}{2}/gi);
  let result: RegExpExecArray | null;

  let outputStr = str;

  while ((result = regex.exec(str)) !== null) {
    const accessor = result[1];
    let value = object[accessor] || "";

    if (typeof value !== "string") {
      throw new Error(
        `Value for ${accessor} is not a string. Value: ${value}. Input values when replacing` +
          ` template strings must be strings. Object: ${JSON.stringify(object)}`
      );
    }

    if (!!options?.split?.func) {
      const limit = options?.split?.limits?.find((i) => i.key === accessor);

      if (limit) {
        value = options.split.func(value, {
          limit: limit.characterCount,
          appendString: limit.appendString,
        });
      }
    }

    outputStr = outputStr.replaceAll(result[0], value);
  }

  return outputStr;
}
