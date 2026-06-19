import { describe, it } from "node:test";
import assert from "node:assert";
import Handlebars from "handlebars";
import { createEmailRenderer } from "../../src/infra/email-render";
import type { Config } from "../../src/config";
import WORKSPACE_INVITE_TEMPLATE from "../../src/features/workspaces/workspace-invite.template";
import DISABLED_FEED_TEMPLATE from "../../src/services/notifications/disabled-feed.template";

// Importing email-render registers the emailFooter partial as a side effect,
// so a template compiled here can exercise the real footer.
const template = Handlebars.compile(
  "<body><p>Hello {{name}}</p>{{> emailFooter}}</body>",
);

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    BACKEND_API_EMAIL_PRIVACY_POLICY_URL: undefined,
    BACKEND_API_EMAIL_FOOTER_ADDRESS: undefined,
    ...overrides,
  } as Config;
}

describe("createEmailRenderer", () => {
  it("renders both disclosures when both config values are set", () => {
    const renderEmail = createEmailRenderer(
      makeConfig({
        BACKEND_API_EMAIL_PRIVACY_POLICY_URL: "https://example.com/privacy",
        BACKEND_API_EMAIL_FOOTER_ADDRESS: "Acme Inc, 1 Main St",
      }),
    );

    const html = renderEmail(template, { name: "Ada" });

    assert.match(html, /Hello Ada/);
    assert.match(html, /Acme Inc, 1 Main St/);
    assert.match(html, /href="https:\/\/example\.com\/privacy"/);
    assert.match(html, /Privacy Policy/);
  });

  it("renders only the address when the privacy url is unset", () => {
    const renderEmail = createEmailRenderer(
      makeConfig({ BACKEND_API_EMAIL_FOOTER_ADDRESS: "Acme Inc, 1 Main St" }),
    );

    const html = renderEmail(template, { name: "Ada" });

    assert.match(html, /Acme Inc, 1 Main St/);
    assert.doesNotMatch(html, /Privacy Policy/);
  });

  it("renders no footer block at all when neither value is set", () => {
    const renderEmail = createEmailRenderer(makeConfig());

    const html = renderEmail(template, { name: "Ada" });

    assert.match(html, /Hello Ada/);
    assert.doesNotMatch(html, /Privacy Policy/);
    // No divider when there are no disclosures to separate.
    assert.doesNotMatch(html, /<hr/);
  });

  it("does not let template data override the footer disclosures", () => {
    const renderEmail = createEmailRenderer(
      makeConfig({ BACKEND_API_EMAIL_FOOTER_ADDRESS: "Real Address" }),
    );

    const html = renderEmail(template, {
      name: "Ada",
      footerAddress: "Spoofed Address",
    });

    assert.match(html, /Real Address/);
    assert.doesNotMatch(html, /Spoofed Address/);
  });
});

describe("shared email shell", () => {
  const renderEmail = createEmailRenderer(makeConfig());

  it("wraps a normal email in the masthead shell with a cobalt button and no leftover Handlebars", () => {
    const html = renderEmail(Handlebars.compile(WORKSPACE_INVITE_TEMPLATE), {
      workspaceName: "Acme News Team",
      inviteUrl: "https://example.com/invites/abc",
    });

    // Shell: masthead wordmark, card, cobalt accent rail (not amber).
    assert.match(html, /class="email-card"/);
    assert.match(html, />MonitoRSS</);
    assert.match(html, /height:3px;background:#2563eb/);
    assert.doesNotMatch(html, /#d97706/); // no warning rail on a normal email
    // Button helper renders a bulletproof bgcolor cell with the real href + label.
    assert.match(html, /class="email-btn-cell"/);
    assert.match(html, /href="https:\/\/example\.com\/invites\/abc"/);
    assert.match(html, /View invitation/);
    // Content + cross-client hardening.
    assert.match(html, /Acme News Team/);
    assert.match(html, /prefers-color-scheme: dark/);
    assert.match(html, /PixelsPerInch>96/);
    // No unrendered template syntax escaped through.
    assert.doesNotMatch(html, /\{\{/);
  });

  it("renders the failure email with an amber rail + Action required chip + What to do row", () => {
    const html = renderEmail(Handlebars.compile(DISABLED_FEED_TEMPLATE), {
      feedName: "TechCrunch",
      feedUrlDisplay: "techcrunch.com/feed",
      feedUrlLink: "https://techcrunch.com/feed/",
      reason: "Too many fetch errors.",
      actionRequired: "Check the URL and re-enable.",
      controlPanelUrl: "https://example.com/feeds/1",
      manageNotificationsUrl: "https://example.com/alerting",
    });

    assert.match(html, /height:3px;background:#d97706/); // amber rail
    assert.match(html, /Action required/); // status chip
    assert.match(html, /What to do/); // renamed guidance row
    assert.match(html, /Check the URL and re-enable\./);
    assert.match(html, /Manage feed/);
    assert.doesNotMatch(html, /background: ?red/); // the old placeholder bug is gone
    assert.doesNotMatch(html, /\{\{/);
  });

  it("renders the connection variant of the failure email with its conditional rows", () => {
    const html = renderEmail(Handlebars.compile(DISABLED_FEED_TEMPLATE), {
      feedName: "TechCrunch",
      connectionName: "#tech-news",
      feedUrlDisplay: "techcrunch.com/feed",
      feedUrlLink: "https://techcrunch.com/feed/",
      articleId: "art-123",
      reason: "Discord rejected the message.",
      rejectedMessage: "400 Bad Request",
      actionRequired: "Shorten the message.",
      controlPanelUrl: "https://example.com/feeds/1",
      manageNotificationsUrl: "https://example.com/settings",
    });

    assert.match(html, /assigned to your feed/); // connection headline branch
    assert.match(html, /art-123/); // articleId row
    assert.match(html, /400 Bad Request/); // rejectedMessage block
    assert.match(html, /#tech-news/); // connection name row
    assert.match(html, /Manage feed connection/); // connection button label
    assert.doesNotMatch(html, /\{\{/);
  });
});
