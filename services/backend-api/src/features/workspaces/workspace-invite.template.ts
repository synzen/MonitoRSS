import { EMAIL_LIGHT as C } from "../../infra/email-render";

export default `{{#> emailShell}}
<h1 class="email-fg" style="margin:0 0 16px;font-size:21px;line-height:1.3;font-weight:700;color:${C.fg};">You've been invited to a workspace</h1>
<p class="email-muted" style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${C.fgMuted};">You've been invited to join the <strong class="email-fg" style="color:${C.fg};">{{workspaceName}}</strong> workspace on MonitoRSS.</p>
<p class="email-muted" style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${C.fgMuted};">Sign in and verify this email address to accept the invitation.</p>
{{emailButton inviteUrl "View invitation"}}
<p class="email-subtle" style="margin:24px 0 0;font-size:13px;line-height:1.5;color:${C.fgSubtle};">If you weren't expecting this, you can safely ignore this email.</p>
{{/emailShell}}`;
