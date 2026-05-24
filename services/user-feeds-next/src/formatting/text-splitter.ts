import type { SplitOptions } from "./types";

function escapeRegexString(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compactStringsToLimit(arr: string[], limit: number): string[] {
  let curIndex = 0;
  const copy = [...arr];

  while (curIndex < copy.length - 1) {
    const curString = copy[curIndex]!;
    const nextString = copy[curIndex + 1]!;

    if (curString.length + nextString.length <= limit) {
      copy.splice(curIndex, 2, curString + nextString);
    } else {
      curIndex++;
    }
  }

  return copy;
}

function splitText(
  text: string,
  options: {
    splitChars: string[];
    limit: number;
    appendChar: string;
    prependChar: string;
  }
): string[] {
  if (!text) {
    return [""];
  }

  const initialSplit = text
    .trim()
    .split(/(\n)/) // Split without removing the new line char
    .filter((item) => item.length > 0);

  let useLimit =
    options.limit - options.appendChar.length - options.prependChar.length;

  if (useLimit <= 0) {
    useLimit = 1;
  }

  let i = 0;

  while (i < initialSplit.length) {
    const item = initialSplit[i]!;

    if (item.length > useLimit) {
      // Some will be empty spaces since "hello." will split into ["hello", ""]
      const splitByPeriod = item
        .split(
          new RegExp(`(${options.splitChars.map(escapeRegexString).join("|")})`)
        )
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (splitByPeriod.length > 1) {
        initialSplit.splice(i, 1, ...splitByPeriod);
      } else {
        const splitBySpace = item
          .split(" ")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        // Add the char back to the end of the split
        splitBySpace.forEach((_, index) => {
          splitBySpace[index] = splitBySpace[index] + " ";
        });

        if (splitBySpace.length > 1) {
          initialSplit.splice(i, 1, ...splitBySpace);
        } else {
          // If it's still too long, just split by characters of length limit
          const splitByChar = initialSplit[i]!.match(
            new RegExp(`.{1,${useLimit}}`, "g")
          ) as string[];

          initialSplit.splice(i, 1, ...splitByChar);
        }
      }
    } else {
      i++;
    }
  }

  const combined = compactStringsToLimit(initialSplit, useLimit);

  return combined.map((s) => s.trim()).filter((s) => s);
}

export function applySplit(
  text: string | undefined,
  options?: SplitOptions & { includeAppendInFirstPart?: boolean }
): string[] {
  if (!text) return [""];

  const limit = options?.limit || 2000;
  const splitChars = options?.splitChar ? [options.splitChar] : [".", "!", "?"];
  const appendChar = options?.appendChar ?? "";
  const prependChar = options?.prependChar ?? "";
  const includeAppendInFirstPart = options?.includeAppendInFirstPart ?? false;

  const split = splitText(text, {
    splitChars,
    limit,
    appendChar,
    prependChar,
  });

  if (options?.isEnabled) {
    if (split.length === 0) {
      return [""];
    } else if (split.length === 1) {
      return [split[0]!.trim()];
    } else if (split.length === 2) {
      const firstPart = split[0]!.trimStart();
      const lastPart = split[1]!.trimEnd();

      if (includeAppendInFirstPart) {
        return [prependChar + firstPart + appendChar, lastPart];
      } else {
        return [prependChar + firstPart, lastPart + appendChar];
      }
    } else {
      const firstPart = split[0]!.trimStart();
      const lastPart = split[split.length - 1]!.trimEnd();

      if (includeAppendInFirstPart) {
        return [
          prependChar + firstPart + appendChar,
          ...split.slice(1, split.length - 1),
          lastPart,
        ];
      }

      return [
        prependChar + firstPart,
        ...split.slice(1, split.length - 1),
        lastPart + appendChar,
      ];
    }
  } else {
    return [split[0]?.trim() || ""];
  }
}

export function truncateText(text: string | undefined, limit: number): string {
  return applySplit(text, { limit })[0] || "";
}
