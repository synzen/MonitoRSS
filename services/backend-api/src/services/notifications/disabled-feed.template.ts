import { EMAIL_LIGHT as C, EMAIL_MONO_STACK } from "../../infra/email-render";

const DISABLED_FEED_TEMPLATE = `{{#> emailShell railWarn=true}}
{{emailWarnChip}}
{{#if connectionName}}
<h1 class="email-fg" style="margin:0 0 16px;font-size:21px;line-height:1.3;font-weight:700;color:${C.fg};">Your connection "{{connectionName}}" assigned to your feed "{{feedName}}" has been disabled</h1>
<p class="email-muted" style="margin:0 0 8px;font-size:15px;line-height:1.6;color:${C.fgMuted};">There was an issue while processing your feed that forced the connection to be disabled. Articles will no longer be delivered for this connection until it is re-enabled. See below for details.</p>
{{else}}
<h1 class="email-fg" style="margin:0 0 16px;font-size:21px;line-height:1.3;font-weight:700;color:${C.fg};">Your feed, {{feedName}}, has been disabled</h1>
<p class="email-muted" style="margin:0 0 8px;font-size:15px;line-height:1.6;color:${C.fgMuted};">There was an issue while processing your feed that forced it to be disabled. Articles will no longer be delivered for this feed until it is re-enabled. See below for details.</p>
{{/if}}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 8px;">
  {{#emailDetailRow "Feed name"}}{{feedName}}{{/emailDetailRow}}
  {{#emailDetailRow "Feed URL"}}<a class="email-link" target="_blank" rel="noopener noreferrer" href="{{feedUrlLink}}" style="color:${C.link};text-decoration:underline;">{{feedUrlDisplay}}</a>{{/emailDetailRow}}
  {{#if articleId}}{{#emailDetailRow "Article ID"}}{{articleId}}{{/emailDetailRow}}{{/if}}
  {{#if connectionName}}{{#emailDetailRow "Connection name"}}{{connectionName}}{{/emailDetailRow}}{{/if}}
  {{#emailDetailRow "Reason"}}{{reason}}{{#if rejectedMessage}}<div style="font-family:${EMAIL_MONO_STACK};margin-top:8px;">{{rejectedMessage}}</div>{{/if}}{{/emailDetailRow}}
  {{#if actionRequired}}{{#emailDetailRow "What to do"}}{{actionRequired}}{{/emailDetailRow}}{{/if}}
</table>
<div style="height:20px;"></div>
{{#if connectionName}}{{emailButton controlPanelUrl "Manage feed connection"}}{{else}}{{emailButton controlPanelUrl "Manage feed"}}{{/if}}
<p class="email-subtle" style="margin:24px 0 0;font-size:13px;line-height:1.5;color:${C.fgSubtle};">You're receiving this because you opted in to feed-failure notifications. <a class="email-link" target="_blank" href="{{manageNotificationsUrl}}" style="color:${C.link};text-decoration:underline;">Manage notifications</a>.</p>
{{/emailShell}}`;

export default DISABLED_FEED_TEMPLATE;
