import { EMAIL_LIGHT as C, EMAIL_MONO_STACK } from "../../infra/email-render";

export default `{{#> emailShell}}
<h1 class="email-fg" style="margin:0 0 16px;font-size:21px;line-height:1.3;font-weight:700;color:${C.fg};">Verify your email</h1>
<p class="email-muted" style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${C.fgMuted};">Enter this code to verify your email address for MonitoRSS:</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;"><tr>
  <td class="email-code" style="background:${C.codeBg};border:1px solid ${C.cardBorder};border-radius:10px;padding:18px 28px;font-family:${EMAIL_MONO_STACK};font-size:30px;font-weight:700;letter-spacing:8px;color:${C.fg};">{{code}}</td>
</tr></table>
<p class="email-muted" style="margin:0;font-size:15px;line-height:1.6;color:${C.fgMuted};">This code expires in 10 minutes.</p>
<p class="email-subtle" style="margin:24px 0 0;font-size:13px;line-height:1.5;color:${C.fgSubtle};">If you didn't request this, you can safely ignore this email.</p>
{{/emailShell}}`;
