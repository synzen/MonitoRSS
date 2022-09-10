import { getNestedPrimitiveValue } from "./get-nested-primitive-value";

export function replaceTemplateString(
  object: Record<string, unknown>,
  str?: string
) {
  if (!str) {
    return str;
  }

  const regex = new RegExp(/{{2}(.+?)}{2}/gi);
  let result: RegExpExecArray | null;

  let outputStr = str;

  while ((result = regex.exec(str)) !== null) {
    const value = getNestedPrimitiveValue(object, result[1]);
    outputStr = outputStr.replaceAll(result[0], value || "");
  }

  return outputStr;
}
