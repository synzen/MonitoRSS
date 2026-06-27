import { EMAIL_LIGHT as C } from "../../infra/email-render";

const WORKSPACE_FEEDS_DISABLED_DIGEST_TEMPLATE = `{{#> emailShell railWarn=true}}
{{emailWarnChip}}
<h1 class="email-fg" style="margin:0 0 16px;font-size:21px;line-height:1.3;font-weight:700;color:${C.fg};">{{feedCount}} {{#if multipleFeeds}}feeds{{else}}feed{{/if}} in your workspace "{{workspaceName}}" {{#if multipleFeeds}}have{{else}}has{{/if}} been disabled</h1>
<p class="email-muted" style="margin:0 0 8px;font-size:15px;line-height:1.6;color:${C.fgMuted};">The workspace exceeded its feed limit, so the oldest feeds over the limit were disabled. Articles will no longer be delivered for these feeds until the workspace is back under its limit.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 8px;">
  {{#emailDetailRow "Disabled feeds"}}{{#each feeds}}{{this.name}} (<a class="email-link" target="_blank" rel="noopener noreferrer" href="{{this.urlLink}}" style="color:${C.link};text-decoration:underline;">{{this.urlDisplay}}</a>){{#unless @last}}<br />{{/unless}}{{/each}}{{/emailDetailRow}}
  {{#emailDetailRow "What to do"}}Remove or disable other feeds to bring the workspace under its limit, after which disabled feeds will be re-enabled automatically.{{/emailDetailRow}}
</table>
<div style="height:20px;"></div>
{{emailButton controlPanelUrl "Manage workspace feeds"}}
<p class="email-subtle" style="margin:24px 0 0;font-size:13px;line-height:1.5;color:${C.fgSubtle};">You're receiving this because you opted in to feed-failure notifications. <a class="email-link" target="_blank" href="{{manageNotificationsUrl}}" style="color:${C.link};text-decoration:underline;">Manage notifications</a>.</p>
{{/emailShell}}`;

export default WORKSPACE_FEEDS_DISABLED_DIGEST_TEMPLATE;
