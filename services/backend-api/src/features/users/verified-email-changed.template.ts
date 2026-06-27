import { EMAIL_LIGHT as C } from "../../infra/email-render";

export default `{{#> emailShell}}
<h1 class="email-fg" style="margin:0 0 16px;font-size:21px;line-height:1.3;font-weight:700;color:${C.fg};">Your verified email was changed</h1>
<p class="email-muted" style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${C.fgMuted};">The verified email on a MonitoRSS account that used this address (<strong class="email-fg" style="color:${C.fg};">{{oldEmail}}</strong>) was changed to <strong class="email-fg" style="color:${C.fg};">{{newEmail}}</strong>.</p>
<p class="email-muted" style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${C.fgMuted};">Workspace invitations and member notifications for that account will now go to the new address instead of this one.</p>
<p class="email-muted" style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${C.fgMuted};">If you made this change, no action is needed. If you did not, use the button below to undo it and sign out all sessions on the account. This link expires in 72 hours.</p>
{{emailButton revertUrl "This wasn't me, revert"}}
<p class="email-muted" style="margin:16px 0 0;font-size:15px;line-height:1.6;color:${C.fgMuted};">If the button does not work, contact support.</p>
{{/emailShell}}`;
