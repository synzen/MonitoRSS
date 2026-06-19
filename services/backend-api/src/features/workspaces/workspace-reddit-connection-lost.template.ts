import { EMAIL_LIGHT as C } from "../../infra/email-render";

export default `{{#> emailShell}}
<h1 class="email-fg" style="margin:0 0 16px;font-size:21px;line-height:1.3;font-weight:700;color:${C.fg};">Reddit connection lost for {{workspaceName}}</h1>
<p class="email-muted" style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${C.fgMuted};">The Reddit account connected to the <strong class="email-fg" style="color:${C.fg};">{{workspaceName}}</strong> workspace on MonitoRSS is no longer active.</p>
<p class="email-muted" style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${C.fgMuted};">Reddit feeds in this workspace will stop updating until a member reconnects a Reddit account.</p>
{{emailButton settingsUrl "Reconnect Reddit"}}
<p class="email-subtle" style="margin:24px 0 0;font-size:13px;line-height:1.5;color:${C.fgSubtle};">Any member of the workspace can reconnect using their own Reddit account.</p>
{{/emailShell}}`;
