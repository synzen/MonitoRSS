import { EMAIL_LIGHT as C } from "../../infra/email-render";

export default `{{#> emailShell}}
<h1 class="email-fg" style="margin:0 0 16px;font-size:21px;line-height:1.3;font-weight:700;color:${C.fg};">You are now the owner of {{workspaceName}}</h1>
<p class="email-muted" style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${C.fgMuted};">Ownership of the <strong class="email-fg" style="color:${C.fg};">{{workspaceName}}</strong> workspace on MonitoRSS has been transferred to you. You now have full control of the workspace, including its members and billing.</p>
{{#if hasSubscription}}
<p class="email-muted" style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${C.fgMuted};">This workspace has an active subscription. Billing stays with the workspace — receipts go to its billing email, which you can change from the workspace billing settings, along with the payment method.</p>
{{else}}
<div style="height:8px;"></div>
{{/if}}
{{emailButton settingsUrl "Open workspace settings"}}
{{/emailShell}}`;
