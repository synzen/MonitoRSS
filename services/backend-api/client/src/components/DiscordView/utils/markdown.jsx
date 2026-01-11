/**
 * Code is used and modified from https://github.com/leovoel/embed-visualizer
 */

/* eslint-disable no-useless-escape */
import SimpleMarkdown from "simple-markdown";
import Twemoji from "twemoji";
import hljs from "highlight.js";
import { uniqueId } from "lodash";
import { getChannelIcon } from "../../../utils/getChannelIcon";
import Emoji from "../../../constants/emojis";

// this is mostly translated from discord's client,
// although it's not 1:1 since the client js is minified
// and also is transformed into some tricky code

// names are weird and sometimes missing, as i'm not sure
// what all of these are doing exactly.

function flattenAst(node, parent) {
  if (Array.isArray(node)) {
    for (let n = 0; n < node.length; n++) {
      node[n] = flattenAst(node[n], parent);
    }

    return node;
  }

  if (node.content != null) {
    node.content = flattenAst(node.content, node);
  }

  if (parent != null && node.type === parent.type) {
    return node.content;
  }

  return node;
}

function astToString(node) {
  function inner(node, result = []) {
    if (Array.isArray(node)) {
      node.forEach((subNode) => astToString(subNode, result));
    } else if (typeof node.content === "string") {
      result.push(node.content);
    } else if (node.content != null) {
      astToString(node.content, result);
    }

    return result;
  }

  return inner(node).join("");
}

function parserFor(rules, returnAst) {
  const parser = SimpleMarkdown.parserFor(rules);
  const renderer = SimpleMarkdown.reactFor(SimpleMarkdown.ruleOutput(rules, "react"));

  return function (input = "", inline = true, state = {}, transform = null) {
    // Preserve multiple consecutive newlines (2+) by adding zero-width spaces
    // This prevents SimpleMarkdown from collapsing them into a single paragraph break
    // N newlines should produce N-1 visible line breaks
    input = input.replace(/\n{2,}/g, (match) => {
      // Paragraph break alone creates 0 visible spacing (margin:0), so add explicit breaks
      return `\n\n${"\u200B\n".repeat(match.length - 1)}`;
    });

    if (!inline) {
      input += "\n\n";
    }

    let ast = parser(input, { inline, ...state });
    ast = flattenAst(ast);

    if (transform) {
      ast = transform(ast);
    }

    if (returnAst) {
      return ast;
    }

    return renderer(ast, state);
  };
}

function omit(object, excluded) {
  return Object.keys(object).reduce((result, key) => {
    if (excluded.indexOf(key) === -1) {
      result[key] = object[key];
    }

    return result;
  }, {});
}

// emoji stuff

const getEmoteURL = (emote) => `${location.protocol}//cdn.discordapp.com/emojis/${emote.id}.png`;

function getEmojiURL(surrogate) {
  if (["™", "©", "®"].indexOf(surrogate) > -1) {
    return "";
  }

  try {
    // we could link to discord's cdn, but there's a lot of these
    // and i'd like to minimize the amount of data we need directly from them
    return `https://twemoji.maxcdn.com/2/svg/${Twemoji.convert.toCodePoint(surrogate)}.svg`;
  } catch (error) {
    return "";
  }
}

// emoji lookup tables

const DIVERSITY_SURROGATES = ["🏻", "🏼", "🏽", "🏾", "🏿"];
const NAME_TO_EMOJI = {};
const EMOJI_TO_NAME = {};

Object.keys(Emoji).forEach((category) => {
  Emoji[category].forEach((emoji) => {
    EMOJI_TO_NAME[emoji.surrogates] = emoji.names[0] || "";

    emoji.names.forEach((name) => {
      NAME_TO_EMOJI[name] = emoji.surrogates;

      DIVERSITY_SURROGATES.forEach((d, i) => {
        NAME_TO_EMOJI[`${name}::skin-tone-${i + 1}`] = emoji.surrogates.concat(d);
      });
    });

    DIVERSITY_SURROGATES.forEach((d, i) => {
      const surrogates = emoji.surrogates.concat(d);
      const name = emoji.names[0] || "";

      EMOJI_TO_NAME[surrogates] = `${name}::skin-tone-${i + 1}`;
    });
  });
});

const EMOJI_NAME_AND_DIVERSITY_RE = /^:([^\s:]+?(?:::skin\-tone\-\d)?):/;

function convertNameToSurrogate(name, t = "") {
  // what is t for?
  return NAME_TO_EMOJI.hasOwnProperty(name) ? NAME_TO_EMOJI[name] : t;
}

function convertSurrogateToName(surrogate, colons = true, n = "") {
  // what is n for?
  let a = n;

  if (EMOJI_TO_NAME.hasOwnProperty(surrogate)) {
    a = EMOJI_TO_NAME[surrogate];
  }

  return colons ? `:${a}:` : a;
}

const escape = (str) => str.replace(/[\-\[\]\/\{}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");

const replacer = (function () {
  const surrogates = Object.keys(EMOJI_TO_NAME)
    .sort((surrogate) => -surrogate.length)
    .map((surrogate) => escape(surrogate))
    .join("|");

  return new RegExp(`(${surrogates})`, "g");
})();

function translateSurrogatesToInlineEmoji(surrogates) {
  return surrogates.replace(replacer, (_, match) => convertSurrogateToName(match));
}

// i am not sure why are these rules split like this.

const baseRules = {
  newline: SimpleMarkdown.defaultRules.newline,
  heading: {
    order: SimpleMarkdown.defaultRules.heading.order,
    match: SimpleMarkdown.blockRegex(/^(#{1,3})\s+([^\n]+?)(?:\n|$)/),
    parse(capture, parse, state) {
      // Parse heading content in inline mode so links work inside headings
      const inlineState = { ...state, inline: true };

      return {
        level: capture[1].length,
        content: parse(capture[2].trim(), inlineState),
      };
    },
    react(node, recurseOutput, state) {
      return (
        <div key={state.key} className={`markdown-heading markdown-heading-${node.level}`}>
          {recurseOutput(node.content, state)}
        </div>
      );
    },
  },
  subtext: {
    order: SimpleMarkdown.defaultRules.heading.order,
    match(source) {
      // Match -# at start of source or after newlines
      return /^(?:\n)*-#\s+([^\n]+?)(?:\n|$)/.exec(source);
    },
    parse(capture, parse, state) {
      // Parse subtext content in inline mode so links work inside subtext
      const inlineState = { ...state, inline: true };

      return {
        content: parse(capture[1].trim(), inlineState),
      };
    },
    react(node, recurseOutput, state) {
      return (
        <div key={state.key} className="markdown-subtext">
          {recurseOutput(node.content, state)}
        </div>
      );
    },
  },
  blockQuote: {
    order: SimpleMarkdown.defaultRules.blockQuote.order,
    match(source) {
      // Match >>> for multi-line quotes (everything after)
      const multiLineMatch = /^>>>(?:[ \t]*)([^]*?)(?:\n\n|\n?$)/.exec(source);

      if (multiLineMatch) {
        return multiLineMatch;
      }

      // Match > for single-line quotes
      return /^>(?:[ \t]*)([^\n]*?)(?:\n|$)/.exec(source);
    },
    parse(capture, parse, state) {
      // Parse blockquote content in inline mode so links work inside quotes
      const inlineState = { ...state, inline: true };

      return {
        content: parse(capture[1].trim(), inlineState),
      };
    },
    react(node, recurseOutput, state) {
      return (
        <div key={state.key} className="markdown-blockquote">
          {recurseOutput(node.content, state)}
        </div>
      );
    },
  },
  list: {
    order: SimpleMarkdown.defaultRules.list.order,
    match(source) {
      // Match list items starting with - or * (but not -# which is subtext)
      // Captures multiple consecutive list items including nested ones
      return /^((?:[ \t]*[-*](?!#)[ \t]+[^\n]*(?:\n|$))+)/.exec(source);
    },
    parse(capture, parse, state) {
      const content = capture[1];
      const lines = content.split("\n").filter((line) => /^[ \t]*[-*](?!#)[ \t]+/.test(line));
      // Parse list item content in inline mode so links work inside list items
      const inlineState = { ...state, inline: true };

      // Get indentation level for a line
      const getIndent = (line) => {
        const match = /^([ \t]*)/.exec(line);

        return match ? match[1].length : 0;
      };

      // Parse lines into a nested structure based on indentation
      const parseItems = (linesList, minIndent = 0) => {
        const items = [];
        let i = 0;

        while (i < linesList.length) {
          const line = linesList[i];
          const indent = getIndent(line);

          // Skip lines with less indentation than expected
          if (indent < minIndent) {
            break;
          }

          const itemMatch = /^[ \t]*[-*][ \t]+(.*)$/.exec(line);

          if (!itemMatch) {
            i += 1;
          } else {
            const text = itemMatch[1].trim();

            // Collect nested items (any lines with greater indentation)
            const nestedLines = [];
            let j = i + 1;

            while (j < linesList.length) {
              const nextIndent = getIndent(linesList[j]);

              if (nextIndent <= indent) {
                break;
              }

              nestedLines.push(linesList[j]);
              j += 1;
            }

            const item = {
              content: parse(text, inlineState),
              children: nestedLines.length > 0 ? parseItems(nestedLines, indent + 1) : [],
            };

            items.push(item);
            i = j;
          }
        }

        return items;
      };

      return { items: parseItems(lines, 0) };
    },
    react(node, recurseOutput, state) {
      const renderItems = (items) => (
        <ul className="markdown-list">
          {items.map((item) => (
            <li key={uniqueId()} className="markdown-list-item">
              {recurseOutput(item.content, state)}
              {item.children && item.children.length > 0 && renderItems(item.children)}
            </li>
          ))}
        </ul>
      );

      return <div key={state.key}>{renderItems(node.items)}</div>;
    },
  },
  paragraph: SimpleMarkdown.defaultRules.paragraph,
  escape: SimpleMarkdown.defaultRules.escape,
  link: SimpleMarkdown.defaultRules.link,
  autolink: {
    ...SimpleMarkdown.defaultRules.autolink,
    match: SimpleMarkdown.inlineRegex(/^<(https?:\/\/[^ >]+)>/),
  },
  url: SimpleMarkdown.defaultRules.url,
  strong: SimpleMarkdown.defaultRules.strong,
  em: SimpleMarkdown.defaultRules.em,
  u: SimpleMarkdown.defaultRules.u,
  br: SimpleMarkdown.defaultRules.br,
  inlineCode: SimpleMarkdown.defaultRules.inlineCode,
  emoticon: {
    ...SimpleMarkdown.defaultRules.text,
    order: SimpleMarkdown.defaultRules.text.order,
    match(source) {
      return /^(¯\\_\(ツ\)_\/¯)/.exec(source);
    },
    parse(capture) {
      return { type: "text", content: capture[1] };
    },
  },
  codeBlock: {
    order: SimpleMarkdown.defaultRules.codeBlock.order,
    match(source) {
      // Match code blocks: ```lang\ncontent``` or ```content```
      // Handle optional newline after opening ``` and before closing ```
      return /^```(?:([a-zA-Z0-9-]+)?\n)?([\s\S]*?)\n?```(?=\s|$|[^`])/.exec(source);
    },
    parse(capture) {
      return { lang: (capture[1] || "").trim(), content: capture[2] || "" };
    },
  },
  emoji: {
    order: SimpleMarkdown.defaultRules.text.order,
    match(source) {
      return EMOJI_NAME_AND_DIVERSITY_RE.exec(source);
    },
    parse(capture) {
      const match = capture[0];
      const name = capture[1];
      const surrogate = convertNameToSurrogate(name);

      return surrogate
        ? {
            name: `:${name}:`,
            surrogate,
            src: getEmojiURL(surrogate),
          }
        : {
            type: "text",
            content: match,
          };
    },
    react(node, recurseOutput, state) {
      return node.src ? (
        <img
          draggable={false}
          className={`emoji ${node.jumboable ? "jumboable" : ""}`}
          alt={node.surrogate}
          title={node.name}
          src={node.src}
          key={state.key}
          style={{ display: "inline-block" }}
        />
      ) : (
        <span key={state.key}>{node.surrogate}</span>
      );
    },
  },
  discordMention: {
    order: SimpleMarkdown.defaultRules.escape.order,
    match(source) {
      // Match Discord mentions: <@userId>, <@!userId>, <@&roleId>, <#channelId>
      return /^<(@!?|@&|#)([a-zA-Z0-9_-]+)>/.exec(source);
    },
    parse(capture) {
      const prefix = capture[1];
      const id = capture[2];
      let type = "user";

      if (prefix === "@&") {
        type = "role";
      } else if (prefix === "#") {
        type = "channel";
      }

      return {
        type: "discordMention",
        mentionType: type,
        id,
        raw: capture[0],
      };
    },
    react(node, recurseOutput, state) {
      const { mentionResolvers } = state;

      if (mentionResolvers) {
        if (node.mentionType === "user") {
          mentionResolvers.requestUserFetch?.(node.id);
          const user = mentionResolvers.getUser?.(node.id);
          const isLoading = mentionResolvers.isUserLoading?.(node.id);

          if (isLoading) {
            return (
              <span key={state.key} className="discord-mention discord-mention-loading">
                {node.raw}
              </span>
            );
          }

          const displayName = user?.displayName || "Unknown User";

          return (
            <span key={state.key} className="discord-mention discord-mention-user">
              @{displayName}
            </span>
          );
        }

        if (node.mentionType === "role") {
          mentionResolvers.requestRolesFetch?.();
          const role = mentionResolvers.getRole?.(node.id);
          const displayName = role?.name || "Unknown Role";
          const roleColor = role?.color && role.color !== "#000000" ? role.color : undefined;

          return (
            <span
              key={state.key}
              className="discord-mention discord-mention-role"
              style={
                roleColor ? { color: roleColor, backgroundColor: `${roleColor}20` } : undefined
              }
            >
              @{displayName}
            </span>
          );
        }

        if (node.mentionType === "channel") {
          mentionResolvers.requestChannelsFetch?.();
          const channel = mentionResolvers.getChannel?.(node.id);
          const displayName = channel?.name || "unknown-channel";
          const channelIcon = getChannelIcon(channel?.type, {
            className: "discord-channel-icon",
          });

          return (
            <span key={state.key} className="discord-mention discord-mention-channel">
              {channelIcon}
              {displayName}
            </span>
          );
        }
      }

      return (
        <span key={state.key} className="discord-mention">
          {node.raw}
        </span>
      );
    },
  },
  everyoneMention: {
    order: SimpleMarkdown.defaultRules.escape.order,
    match(source) {
      // Match @everyone and @here
      return /^@(everyone|here)\b/.exec(source);
    },
    parse(capture) {
      return {
        type: "everyoneMention",
        mentionType: capture[1],
      };
    },
    react(node, recurseOutput, state) {
      return (
        <span key={state.key} className="discord-mention discord-mention-everyone">
          @{node.mentionType}
        </span>
      );
    },
  },
  customEmoji: {
    order: SimpleMarkdown.defaultRules.text.order,
    match(source) {
      return /^<:(\w+):(\d+)>/.exec(source);
    },
    parse(capture) {
      const name = capture[1];
      const id = capture[2];

      return {
        emojiId: id,
        // NOTE: we never actually try to fetch the emote
        // so checking if colons are required (for 'name') is not
        // something we can do to begin with
        name,
        src: getEmoteURL({
          id,
        }),
      };
    },
    react(node, recurseOutput, state) {
      return (
        <img
          draggable={false}
          className={`emoji ${node.jumboable ? "jumboable" : ""}`}
          alt={`<:${node.name}:${node.id}>`}
          title={node.name}
          src={node.src}
          key={state.key}
        />
      );
    },
  },
  text: {
    ...SimpleMarkdown.defaultRules.text,
    parse(capture, recurseParse, state) {
      return state.nested
        ? {
            content: capture[0],
          }
        : recurseParse(translateSurrogatesToInlineEmoji(capture[0]), {
            ...state,
            nested: true,
          });
    },
  },
  // s: {
  //   order: SimpleMarkdown.defaultRules.u.order,
  //   match: SimpleMarkdown.inlineRegex(/^~~([\s\S]+?)~~(?!_)/),
  //   parse: SimpleMarkdown.defaultRules.u.parse,
  // },
};

function createRules(r) {
  const { paragraph } = r;
  const { url } = r;
  const { link } = r;
  const { codeBlock } = r;
  const { inlineCode } = r;

  return {
    // rules we don't care about:
    //  mention
    //  channel
    //  highlight

    // what is highlight?

    ...r,
    s: {
      order: r.u.order,
      match: SimpleMarkdown.inlineRegex(/^~~([\s\S]+?)~~(?!_)/),
      parse: r.u.parse,
      react(node, recurseOutput, state) {
        return <s key={state.key}>{recurseOutput(node.content, state)}</s>;
      },
    },
    paragraph: {
      ...paragraph,
      react(node, recurseOutput, state) {
        return (
          <p key={state.key} style={{ margin: 0 }}>
            {recurseOutput(node.content, state)}
          </p>
        );
      },
    },
    url: {
      ...url,
      match: SimpleMarkdown.inlineRegex(/^((https?|steam):\/\/[^\s<]+[^<.,:;"')\]\s])/),
    },
    link: {
      ...link,
      react(node, recurseOutput, state) {
        // this contains some special casing for invites (?)
        // or something like that.
        // we don't really bother here
        const children = recurseOutput(node.content, state);
        const title = node.title || astToString(node.content);

        return (
          <a
            title={title}
            href={SimpleMarkdown.sanitizeUrl(node.target)}
            target="_blank"
            rel="noreferrer"
            key={state.key}
          >
            {children}
          </a>
        );
      },
    },
    inlineCode: {
      ...inlineCode,
      react(node, recurseOutput, state) {
        return (
          <code className="inline" key={state.key}>
            {node.content}
          </code>
        );
      },
    },
    codeBlock: {
      ...codeBlock,
      react(node, recurseOutput, state) {
        if (node.lang && hljs.getLanguage(node.lang) != null) {
          const highlightedBlock = hljs.highlight(node.lang, node.content, true);

          return (
            <pre key={state.key}>
              <code
                className={`hljs ${highlightedBlock.language}`}
                dangerouslySetInnerHTML={{ __html: highlightedBlock.value }}
              />
            </pre>
          );
        }

        return (
          <pre key={state.key}>
            <code className="hljs">{node.content}</code>
          </pre>
        );
      },
    },
  };
}

const rulesWithoutMaskedLinks = createRules({
  ...baseRules,
  link: {
    ...baseRules.link,
    match() {
      return null;
    },
  },
});

// used in:
//  message content (non-webhook mode)
const parse = parserFor(rulesWithoutMaskedLinks);

// used in:
//  message content (webhook mode)
//  embed description
//  embed field values
const parseAllowLinks = parserFor(createRules(baseRules));

// used in:
//  embed title (obviously)
//  embed field names
const parseEmbedTitle = parserFor(
  omit(rulesWithoutMaskedLinks, [
    "codeBlock",
    "br",
    "mention",
    "channel",
    "roleMention",
    "heading",
    "subtext",
    "blockQuote",
    "list",
  ])
);

// used in:
//  message content
function jumboify(ast) {
  const nonEmojiNodes = ast.some(
    (node) =>
      node.type !== "emoji" &&
      node.type !== "customEmoji" &&
      (typeof node.content !== "string" || node.content.trim() !== "")
  );

  if (nonEmojiNodes) {
    return ast;
  }

  const maximum = 27;
  let count = 0;

  ast.forEach((node) => {
    if (node.type === "emoji" || node.type === "customEmoji") {
      count += 1;
    }

    if (count > maximum) {
      return false;
    }
  });

  if (count < maximum) {
    ast.forEach((node) => (node.jumboable = true));
  }

  return ast;
}

export { parse, parseAllowLinks, parseEmbedTitle, jumboify };
