// One-off: render every email template through the real renderEmail helper
// (so the shared shell + footer partials are exercised) and write each to
// email-preview/. Run: npx tsx scripts/preview-emails.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Handlebars from "handlebars";
import { createEmailRenderer } from "../src/infra/email-render";
import type { Config } from "../src/config";

import EMAIL_VERIFICATION_TEMPLATE from "../src/features/users/email-verification.template";
import VERIFIED_EMAIL_CHANGED_TEMPLATE from "../src/features/users/verified-email-changed.template";
import VERIFIED_EMAIL_REVERTED_TEMPLATE from "../src/features/users/verified-email-reverted.template";
import WORKSPACE_INVITE_TEMPLATE from "../src/features/workspaces/workspace-invite.template";
import WORKSPACE_OWNERSHIP_TRANSFERRED_TEMPLATE from "../src/features/workspaces/workspace-ownership-transferred.template";
import WORKSPACE_REDDIT_CONNECTION_LOST_TEMPLATE from "../src/features/workspaces/workspace-reddit-connection-lost.template";
import DISABLED_FEED_TEMPLATE from "../src/services/notifications/disabled-feed.template";
import WORKSPACE_FEEDS_DISABLED_DIGEST_TEMPLATE from "../src/services/notifications/workspace-feeds-disabled-digest.template";

// Configure the footer so the preview shows the compliant (hosted) variant.
const config = {
  BACKEND_API_EMAIL_PRIVACY_POLICY_URL: "https://monitorss.xyz/privacy-policy",
  BACKEND_API_EMAIL_FOOTER_ADDRESS: "MonitoRSS · support@monitorss.xyz",
} as Config;

const renderEmail = createEmailRenderer(config);
const compile = (tpl: string) => Handlebars.compile(tpl);

const emails: Array<{ name: string; html: string }> = [
  {
    name: "01-email-verification",
    html: renderEmail(compile(EMAIL_VERIFICATION_TEMPLATE), { code: "428913" }),
  },
  {
    name: "02-verified-email-changed",
    html: renderEmail(compile(VERIFIED_EMAIL_CHANGED_TEMPLATE), {
      oldEmail: "old@example.com",
      newEmail: "new@example.com",
      revertUrl:
        "https://my.monitorss.xyz/email-verification/revert?token=eyJ1IjoiYWJjIn0.deadbeef",
    }),
  },
  {
    name: "02b-verified-email-reverted",
    html: renderEmail(compile(VERIFIED_EMAIL_REVERTED_TEMPLATE), {
      restoredEmail: "old@example.com",
    }),
  },
  {
    name: "03-workspace-invite",
    html: renderEmail(compile(WORKSPACE_INVITE_TEMPLATE), {
      workspaceName: "Acme News Team",
      inviteUrl: "https://my.monitorss.xyz/invites/abc123",
    }),
  },
  {
    name: "04-ownership-transferred",
    html: renderEmail(compile(WORKSPACE_OWNERSHIP_TRANSFERRED_TEMPLATE), {
      workspaceName: "Acme News Team",
      settingsUrl: "https://my.monitorss.xyz/workspaces/acme/settings",
      hasSubscription: true,
    }),
  },
  {
    name: "05-reddit-connection-lost",
    html: renderEmail(compile(WORKSPACE_REDDIT_CONNECTION_LOST_TEMPLATE), {
      workspaceName: "Acme News Team",
      settingsUrl: "https://my.monitorss.xyz/workspaces/acme/settings",
    }),
  },
  {
    name: "06-disabled-feed",
    html: renderEmail(compile(DISABLED_FEED_TEMPLATE), {
      feedName: "TechCrunch",
      feedUrlDisplay: "techcrunch.com/feed",
      feedUrlLink: "https://techcrunch.com/feed/",
      reason: "The feed returned too many errors when we tried to fetch it.",
      actionRequired: "Check that the feed URL is reachable, then re-enable the feed.",
      controlPanelUrl: "https://my.monitorss.xyz",
      manageNotificationsUrl: "https://my.monitorss.xyz/settings",
    }),
  },
  {
    // Connection variant: exercises the connectionName / articleId /
    // rejectedMessage conditional branches of the same template.
    name: "06b-disabled-feed-connection",
    html: renderEmail(compile(DISABLED_FEED_TEMPLATE), {
      feedName: "TechCrunch",
      connectionName: "#tech-news Discord channel",
      feedUrlDisplay: "techcrunch.com/feed",
      feedUrlLink: "https://techcrunch.com/feed/",
      articleId: "abc-123-def-456",
      reason: "Discord rejected the message.",
      rejectedMessage:
        "400 Bad Request: embeds.0.description must be 4096 or fewer characters",
      actionRequired: "Shorten the message content, then re-enable the connection.",
      controlPanelUrl: "https://my.monitorss.xyz",
      manageNotificationsUrl: "https://my.monitorss.xyz/settings",
    }),
  },
  {
    name: "07-workspace-feeds-disabled-digest",
    html: renderEmail(compile(WORKSPACE_FEEDS_DISABLED_DIGEST_TEMPLATE), {
      workspaceName: "Acme News Team",
      feedCount: 3,
      multipleFeeds: true,
      controlPanelUrl: "https://my.monitorss.xyz",
      manageNotificationsUrl: "https://my.monitorss.xyz/settings",
      feeds: [
        { name: "TechCrunch", urlDisplay: "techcrunch.com/feed", urlLink: "https://techcrunch.com/feed/" },
        { name: "The Verge", urlDisplay: "theverge.com/rss", urlLink: "https://www.theverge.com/rss/index.xml" },
        { name: "Ars Technica", urlDisplay: "arstechnica.com/feed", urlLink: "https://arstechnica.com/feed/" },
      ],
    }),
  },
];

const outDir = join(process.cwd(), "email-preview");
mkdirSync(outDir, { recursive: true });

const indexLinks: string[] = [];
for (const { name, html } of emails) {
  writeFileSync(join(outDir, `${name}.html`), html, "utf8");
  indexLinks.push(`<li><a href="./${name}.html">${name}</a></li>`);
}

writeFileSync(
  join(outDir, "index.html"),
  `<!DOCTYPE html><html><body style="font-family: sans-serif; padding: 24px;"><h1>MonitoRSS email previews</h1><p>Rendered through the real renderEmail helper (shared shell + footer). Toggle your OS light/dark mode to see the prefers-color-scheme adaptation.</p><ul>${indexLinks.join("")}</ul></body></html>`,
  "utf8",
);

// eslint-disable-next-line no-console
console.log(`Wrote ${emails.length} previews to ${outDir}`);
