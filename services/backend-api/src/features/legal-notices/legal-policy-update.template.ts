import { EMAIL_LIGHT as C } from "../../infra/email-render";

// One-off notice for the 2026-10-19 legal document update. The hosted instance
// sends this manually rather than through a service flow, so the copy and links
// are pinned to this notice version instead of being data-driven. Send with
// subject "Updates to MonitoRSS's Terms and Privacy Policy".
const LEGAL_POLICY_UPDATE_TEMPLATE = `{{#> emailShell}}
<h1 class="email-fg" style="margin:0 0 16px;font-size:21px;line-height:1.3;font-weight:700;color:${C.fg};">We've updated our Terms and Privacy Policy</h1>
<p class="email-muted" style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${C.fgMuted};">Effective October 19, 2026, MonitoRSS is provided by Relayvale LLC under updated <a class="email-link" target="_blank" rel="noopener noreferrer" href="https://monitorss.xyz/legal/terms" style="color:${C.link};text-decoration:underline;">Terms and Conditions</a> and a new <a class="email-link" target="_blank" rel="noopener noreferrer" href="https://monitorss.xyz/legal/privacy" style="color:${C.link};text-decoration:underline;">Privacy Policy</a>. The service itself isn't changing.</p>
<p class="email-muted" style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${C.fgMuted};">The updated documents include clearer sections on subscriptions and billing, acceptable use, data retention, and your privacy rights, plus a refreshed <a class="email-link" target="_blank" rel="noopener noreferrer" href="https://monitorss.xyz/legal/cookie" style="color:${C.link};text-decoration:underline;">Cookie Policy</a>.</p>
<p class="email-muted" style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${C.fgMuted};">Under the updated Terms, disputes are resolved through binding arbitration rather than in court, on an individual basis rather than as part of a class action.</p>
<p class="email-muted" style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${C.fgMuted};">Continuing to use MonitoRSS on or after October 19, 2026 means you accept the updated documents. If you don't agree, you can cancel any paid subscription and delete your account from your settings at any time.</p>
<p class="email-muted" style="margin:0 0 8px;font-size:15px;line-height:1.6;color:${C.fgMuted};">Questions? Email <a class="email-link" href="mailto:support@relayvale.com" style="color:${C.link};text-decoration:underline;">support@relayvale.com</a> (the familiar <a class="email-link" href="mailto:support@monitorss.xyz" style="color:${C.link};text-decoration:underline;">support@monitorss.xyz</a> works too).</p>
{{/emailShell}}`;

export default LEGAL_POLICY_UPDATE_TEMPLATE;
