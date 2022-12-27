export function replaceTemplateString(
  object: Record<string, string>,
  str?: string
) {
  if (!str) {
    return str;
  }

  const regex = new RegExp(/{{2}(.+?)}{2}/gi);
  let result: RegExpExecArray | null;

  let outputStr = str;

  while ((result = regex.exec(str)) !== null) {
    const accessor = result[1];
    const value = object[accessor] || "";

    if (typeof value !== "string") {
      throw new Error(
        `Value for ${accessor} is not a string. Value: ${value}. Input values when replacing` +
          ` template strings must be strings. Object: ${JSON.stringify(object)}`
      );
    }

    outputStr = outputStr.replaceAll(result[0], value);
  }

  return outputStr;
}
