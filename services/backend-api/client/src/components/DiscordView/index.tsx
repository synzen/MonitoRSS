/**
 * Code is used and modified from https://github.com/leovoel/embed-visualizer
 */

/* eslint-disable react/no-array-index-key */
import React from "react";
import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
import relativeTime from "dayjs/plugin/relativeTime";
import { uniqueId } from "lodash";
import { Box } from "@chakra-ui/react";
// @ts-ignore
import { parse, parseAllowLinks, jumboify } from "./utils/markdown";
import { DiscordViewEmbed } from "../../types/DiscordViewEmbed";
import Embed from "./Embed";
import { ComponentRowView } from "./ComponentRowView";
import { MentionResolvers } from "../../contexts/MentionDataContext";

dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);

const MessageTimestamp = (
  {
    compactMode,
  }: {
    compactMode?: boolean;
  } = {
    compactMode: false,
  }
) => {
  const m = dayjs();

  const computed = compactMode ? m.format("LT") : m.fromNow();

  return <span className="timestamp">{computed}</span>;
};

const MessageBody = ({
  compactMode,
  username,
  content,
  webhookMode,
  mentionResolvers,
}: {
  compactMode?: boolean;
  username?: string;
  content?: string | null;
  webhookMode?: boolean;
  mentionResolvers?: MentionResolvers;
}) => {
  const parserState = mentionResolvers ? { mentionResolvers } : {};

  if (compactMode) {
    return (
      <div className="markup">
        <MessageTimestamp compactMode={compactMode} />
        <span className="username-wrapper v-btm">
          <strong className="user-name">{username}</strong>
          <span className="bot-tag">BOT</span>
        </span>
        <span className="highlight-separator"> - </span>
        <span className="message-content">
          {content && parse(content, true, parserState, jumboify)}
        </span>
      </div>
    );
  }

  if (content) {
    if (webhookMode) {
      return <div className="markup">{parseAllowLinks(content, true, parserState, jumboify)}</div>;
    }

    return <div className="markup">{parse(content, true, parserState, jumboify)}</div>;
  }

  return null;
};

const CozyMessageHeader = ({
  compactMode,
  username,
}: {
  compactMode?: boolean;
  username?: string;
}) => {
  if (compactMode) {
    return null;
  }

  return (
    <discord-header style={{ lineHeight: "16px" }}>
      <span className="username-wrapper v-btm">
        <strong className="user-name">{username}</strong>
        <span className="bot-tag">BOT</span>
      </span>
      <span className="highlight-separator"> - </span>
      <MessageTimestamp compactMode={compactMode} />
    </discord-header>
  );
};

const Avatar = ({ compactMode, url }: { compactMode?: boolean; url?: string }) => {
  if (compactMode) {
    return null;
  }

  return <div className="avatar-large animate" style={{ backgroundImage: `url('${url}')` }} />;
};

const ErrorHeader = ({ error }: { error?: string }) => {
  if (!error) {
    return null;
  }

  return <header className="f6 bg-red br2 pa2 br--top w-100 code pre-wrap">{error}</header>;
};

const DiscordViewWrapper = ({
  darkTheme,
  children,
}: {
  darkTheme?: boolean;
  children: React.ReactNode;
}) => {
  // yikes
  // we could actually just flatten the styling out on the respective elements,
  // but copying directly from discord is a lot easier than that
  return (
    <div className="w-100 h-100 overflow-auto pa2 discord-view">
      <div className={`flex-vertical whitney ${darkTheme && "theme-dark"}`}>
        <div className="chat flex-vertical flex-spacer">
          <div className="content flex-spacer flex-horizontal">
            <div className="flex-spacer flex-vertical messages-wrapper">
              <div className="scroller-wrap">
                <div className="scroller messages">{children}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DiscordView = ({
  compactMode,
  darkTheme,
  username,
  avatar_url,
  error,
  messages,
  excludeHeader,
  mentionResolvers,
}: {
  excludeHeader?: boolean;
  compactMode?: boolean;
  darkTheme?: boolean;
  webhookMode?: boolean;
  username?: string;
  avatar_url?: string;
  error?: string;
  mentionResolvers?: MentionResolvers;
  messages: Array<{
    content?: string | null;
    embeds?: DiscordViewEmbed[];
    components?: Array<{
      type: number;
      components: Array<{
        type: number;
        style: number;
        label: string;
        url?: string;
      }>;
    }> | null;
  }>;
}) => {
  const bgColor = darkTheme ? "bg-discord-dark" : "bg-discord-light";
  const cls = `w-100 h-100 br2 flex flex-column white overflow-hidden ${bgColor}`;

  return (
    <div className={cls}>
      <ErrorHeader error={error} />
      <DiscordViewWrapper darkTheme={darkTheme}>
        <div
          className={`message-group hide-overflow ${compactMode ? "compact" : ""}`}
          style={excludeHeader ? { padding: 0, margin: 0 } : {}}
        >
          {!excludeHeader && <Avatar url={avatar_url} compactMode={compactMode} />}
          <div className="comment">
            <div className="message first">
              {excludeHeader ? null : (
                <CozyMessageHeader username={username} compactMode={compactMode} />
              )}
              {messages.map(({ content: thisContent, embeds: thisEmbeds, components }, index) => (
                <div className="message-text" key={index}>
                  <MessageBody
                    content={thisContent}
                    username={username}
                    compactMode={compactMode}
                    webhookMode
                    mentionResolvers={mentionResolvers}
                  />
                  {thisEmbeds?.map((e, i) => (
                    <Embed key={i} {...e} />
                  ))}
                  <Box mt={components?.length ? 2 : 0}>
                    {components?.map((row) => {
                      return (
                        <ComponentRowView key={uniqueId()} components={row.components || []} />
                      );
                    })}
                  </Box>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DiscordViewWrapper>
    </div>
  );
};

export default DiscordView;
