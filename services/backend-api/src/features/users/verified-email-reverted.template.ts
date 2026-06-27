import { EMAIL_LIGHT as C } from "../../infra/email-render";

export default `{{#> emailShell}}
<h1 class="email-fg" style="margin:0 0 16px;font-size:21px;line-height:1.3;font-weight:700;color:${C.fg};">A verified email change was reverted</h1>
<p class="email-muted" style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${C.fgMuted};">A recent change to the verified email on a MonitoRSS account was reverted, and the verified email has been restored to this address (<strong class="email-fg" style="color:${C.fg};">{{restoredEmail}}</strong>).</p>
<p class="email-muted" style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${C.fgMuted};">For security, any existing sessions on the account were signed out.</p>
<p class="email-muted" style="margin:0;font-size:15px;line-height:1.6;color:${C.fgMuted};">If you reverted this change, no further action is needed. If you did not, please contact support.</p>
{{/emailShell}}`;
