/* eslint-disable @typescript-eslint/no-var-requires */
const htmlConvert = require("html-to-text");
const EXCLUDED_KEYS = [
  "title",
  "description",
  "summary",
  "author",
  "pubDate",
  "pubdate",
  "date",
];

/**
 *
 * @param {import('./Article').Feed} feed
 * @param {string} text
 * @param {import('./Article').DefaultOptions} defaultOptions
 * @returns
 */
function cleanup(feed, text, defaultOptions) {
  if (!text) {
    return "";
  }

  let newText = text;
  newText = newText
    .replace(/\*/gi, "")
    .replace(/<(strong|b)>(.*?)<\/(strong|b)>/gi, "**$2**") // Bolded markdown
    .replace(/<(em|i)>(.*?)<(\/(em|i))>/gi, "*$2*") // Italicized markdown
    .replace(/<(u)>(.*?)<(\/(u))>/gi, "__$2__"); // Underlined markdown

  newText = htmlConvert.fromString(newText, {
    tables:
      (feed.formatTables !== undefined && typeof feed.formatTables === "boolean"
        ? feed.formatTables
        : defaultOptions.formatTables) === true
        ? true
        : [],
    wordwrap: null,
    ignoreHref: true,
    noLinkBrackets: true,
    format: {
      image: (node) => {
        const isStr = typeof node.attribs.src === "string";
        let link = isStr ? node.attribs.src.trim() : node.attribs.src;

        if (isStr && link.startsWith("//")) {
          link = "http:" + link;
        } else if (
          isStr &&
          !link.startsWith("http://") &&
          !link.startsWith("https://")
        ) {
          link = "http://" + link;
        }

        let exist = true;
        const globalExistOption = defaultOptions.imgLinksExistence;
        exist = globalExistOption;
        const specificExistOption = feed.imgLinksExistence;
        exist =
          typeof specificExistOption !== "boolean"
            ? exist
            : specificExistOption;

        if (!exist) {
          return "";
        }

        let image = "";
        const globalPreviewOption = defaultOptions.imgPreviews;
        image = globalPreviewOption ? link : `<${link}>`;
        const specificPreviewOption = feed.imgPreviews;
        image =
          typeof specificPreviewOption !== "boolean"
            ? image
            : specificPreviewOption === true
              ? link
              : `<${link}>`;

        return image;
      },
      blockquote: (node, fn, options) => {
        const orig = fn(node.children, options).trim();

        return "> " + orig.replace(/(?:\n)/g, "\n> ") + "\n";
      },
    },
  });

  newText = newText.replace(/\n\s*\n\s*\n/g, "\n\n"); // Replace triple line breaks with double
  const arr = newText.split("\n");

  for (var q = 0; q < arr.length; ++q) {
    arr[q] = arr[q].replace(/\s+$/, "");
  } // Remove trailing spaces

  return arr.join("\n");
}

class FlattenedJSON {
  /**
   *
   * @param {Record<string, any>} data
   * @param {import('./Article').Feed} feed
   * @param {import('./Article').DefaultOptions} defaultOptions
   */
  constructor(data, feed, defaultOptions) {
    this.feed = feed;
    this.data = data;
    this.defaultOptions = defaultOptions;
    this.results = {};
    this.text = "";
    // Populate this.results with a trampoline to avoid stack call exceeded
    this._trampolineIteration(this._iterateOverObject.bind(this), data);
    // Generate the text from this.results
    this._generateText();
  }

  static isObject(value) {
    return Object.prototype.toString.call(value) === "[object Object]";
  }

  static isDateObject(value) {
    return Object.prototype.toString.call(value) === "[object Date]";
  }

  _trampolineIteration(fun, obj, previousKeyNames) {
    for (var key in obj) {
      let val = fun.bind(this)(obj[key], key, previousKeyNames);

      while (typeof val === "function") {
        val = val();
      }
    }
  }

  _iterateOverObject(item, keyName, previousKeyNames) {
    const keyNameWithPrevious = (
      previousKeyNames ? `${previousKeyNames}_${keyName}` : keyName
    ).replace(":", "-"); // Replace colons to avoid emoji conflicts

    if (
      !item ||
      EXCLUDED_KEYS.includes(keyName) ||
      item === this.results[keyNameWithPrevious.toLowerCase()]
    ) {
      return;
    }

    if (Array.isArray(item)) {
      for (let i = 0; i < item.length; ++i) {
        const entry = item[i];
        const thisKeyNameWithPrevious = `${keyNameWithPrevious}[${i}]`;

        if (FlattenedJSON.isObject(entry)) {
          this._trampolineIteration(
            this._iterateOverObject,
            entry,
            thisKeyNameWithPrevious,
          );
        } else {
          this.results[thisKeyNameWithPrevious] = entry;
        }
      }
    } else if (FlattenedJSON.isObject(item)) {
      this._trampolineIteration(
        this._iterateOverObject,
        item,
        keyNameWithPrevious,
      );
    } else {
      this.results[keyNameWithPrevious] = cleanup(
        this.feed,
        item,
        this.defaultOptions,
      );
    }
  }

  _generateText() {
    let nameHeader = "PROPERTY NAME";
    let valueHeader = "VALUE";
    let longestNameLen = 0;
    let longestValLen = 0;

    for (const key in this.results) {
      const val = this.data[key];

      if (key.length > longestNameLen) {
        longestNameLen = key.length;
      }

      if (val && val.length > longestValLen) {
        longestValLen = val.length;
      }
    }

    if (nameHeader.length > longestNameLen) {
      longestNameLen = nameHeader;
    }

    if (valueHeader.length > longestValLen) {
      longestValLen = valueHeader;
    }

    longestNameLen += 10;

    while (nameHeader.length < longestNameLen) {
      nameHeader += " ";
    }

    while (valueHeader.length < longestValLen) {
      valueHeader += " ";
    }

    nameHeader += "|  ";
    const header = nameHeader + valueHeader;
    let bar = "";

    while (bar.length < header.length) {
      bar += "-";
    }

    this.text = header + "\r\n" + bar + "\r\n";

    // Add in the key/values
    for (const key in this.results) {
      let curStr = key;

      while (curStr.length < longestNameLen) {
        curStr += " ";
      }

      const propNameLength = curStr.length;
      const valueLines = FlattenedJSON.isDateObject(this.results[key])
        ? [this.results[key].toString() + " [DATE OBJECT]"]
        : cleanup(
            this.feed,
            this.results[key].toString(),
            this.defaultOptions,
          ).split("\n");

      for (let u = 0; u < valueLines.length; ++u) {
        curStr +=
          u === 0 ? `|  ${valueLines[u]}\r\n` : `   ${valueLines[u]}\r\n`;

        if (u < valueLines.length - 1) {
          let emptyPropName = "";

          while (emptyPropName.length < propNameLength) {
            emptyPropName += " ";
          }

          curStr += emptyPropName;
        }
      }

      this.text += curStr;
    }
  }

  getValue(str) {
    return this.results[str] || "";
  }
}

module.exports = FlattenedJSON;
