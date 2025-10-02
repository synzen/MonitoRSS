/**
 * Code is used and modified from https://github.com/leovoel/embed-visualizer
 */

/* eslint-disable react/no-array-index-key */
import React from "react";
import dayjs from "dayjs";
// @ts-ignore
import { parseAllowLinks, parseEmbedTitle } from "./utils/markdown";
import extractRGBFromInt from "../../utils/extractRgbFromInt";
import { DiscordViewEmbed } from "../../types/DiscordViewEmbed";

const Link = ({ children, ...props }: React.HTMLProps<HTMLAnchorElement>) => {
  return (
    <a target="_blank" rel="noreferrer" {...props}>
      {children}
    </a>
  );
};

const EmbedColorPill = ({ color }: { color?: number | null }) => {
  let computed;

  if (color) {
    const c = extractRGBFromInt(color);
    computed = `rgba(${c.r},${c.g},${c.b},1)`;
  }

  const style = { backgroundColor: computed !== undefined ? computed : "" };

  return <div className="embed-color-pill" style={style} />;
};

const EmbedTitle = ({ title, url }: { title?: string | null; url?: string | null }) => {
  if (!title) {
    return null;
  }

  let computed = <div className="embed-title">{parseEmbedTitle(title)}</div>;

  if (url) {
    computed = (
      <Link href={url} className="embed-title">
        {parseEmbedTitle(title)}
      </Link>
    );
  }

  return computed;
};

const EmbedDescription = ({ content }: { content?: string | null }) => {
  if (!content) {
    return null;
  }

  return <div className="embed-description markup">{parseAllowLinks(content)}</div>;
};

const EmbedAuthor = ({
  name,
  url,
  icon_url,
}: {
  name?: string | null;
  url?: string | null;
  icon_url?: string | null;
}) => {
  if (!name) {
    return null;
  }

  let authorName;

  if (name) {
    authorName = <span className="embed-author-name">{name}</span>;

    if (url) {
      authorName = (
        <Link href={url} className="embed-author-name">
          {name}
        </Link>
      );
    }
  }

  const authorIcon = icon_url ? (
    <img src={icon_url} role="presentation" className="embed-author-icon" alt="" />
  ) : null;

  return (
    <div className="embed-author">
      {authorIcon}
      {authorName}
    </div>
  );
};

const EmbedField = ({
  name,
  value,
  inline,
}: {
  name?: string | null;
  value?: string | null;
  inline?: boolean | null;
}) => {
  if (!name && !value) {
    return null;
  }

  const cls = `embed-field${inline ? " embed-field-inline" : ""}`;

  const fieldName = name ? <div className="embed-field-name">{parseEmbedTitle(name)}</div> : null;
  const fieldValue = value ? (
    <div className="embed-field-value markup">{parseAllowLinks(value)}</div>
  ) : null;

  return (
    <div className={cls}>
      {fieldName}
      {fieldValue}
    </div>
  );
};

const EmbedThumbnail = ({ url }: { url?: string | null }) => {
  if (!url) {
    return null;
  }

  return (
    <img
      src={url}
      role="presentation"
      className="embed-rich-thumb"
      style={{ maxWidth: 80, maxHeight: 80 }}
      alt=""
    />
  );
};

const EmbedImage = ({ url }: { url?: string | null }) => {
  if (!url) {
    return null;
  }

  // NOTE: for some reason it's a link in the original DOM
  // not sure if this breaks the styling, probably does
  return (
    // eslint-disable-next-line jsx-a11y/anchor-is-valid
    <a className="embed-thumbnail embed-thumbnail-rich">
      <img className="image" role="presentation" src={url} alt="" />
    </a>
  );
};

const EmbedFooter = ({
  timestamp,
  text,
  icon_url,
}: Exclude<DiscordViewEmbed["footer"], undefined | null>) => {
  if (!text && !timestamp) {
    return null;
  }

  const dayjsTime = timestamp ? dayjs(timestamp) : null;
  const time =
    dayjsTime && dayjsTime.isValid() ? dayjsTime.format("ddd MMM DD, YYYY [at] h:mm A") : null;

  const footerText = [text, time].filter(Boolean).join(" | ");
  const footerIcon =
    text && icon_url ? (
      <img
        src={icon_url}
        className="embed-footer-icon"
        role="presentation"
        width="20"
        height="20"
        alt=""
      />
    ) : null;

  return (
    <div>
      {footerIcon}
      <span className="embed-footer">{footerText}</span>
    </div>
  );
};

const EmbedFields = ({
  fields,
}: {
  fields: Array<{ name?: string | null; value?: string | null; inline?: boolean | null }>;
}) => {
  if (!fields) {
    return null;
  }

  return (
    <div className="embed-fields">
      {fields.map((f, i) => (
        <EmbedField key={i} {...f} />
      ))}
    </div>
  );
};

const Embed = ({
  color,
  author,
  title,
  url,
  description,
  fields,
  thumbnail,
  image,
  timestamp,
  footer,
}: DiscordViewEmbed) => {
  return (
    <div className="theme-dark">
      <div className="accessory">
        <div className="embed-wrapper">
          <EmbedColorPill color={color} />
          <div className="embed embed-rich">
            <div className="embed-content">
              <div className="embed-content-inner">
                <EmbedAuthor {...author} />
                <EmbedTitle title={title} url={url} />
                <EmbedDescription content={description} />
                <EmbedFields fields={fields || []} />
              </div>
              <EmbedThumbnail {...thumbnail} />
            </div>
            <EmbedImage {...image} />
            <EmbedFooter timestamp={timestamp} {...footer} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Embed;
