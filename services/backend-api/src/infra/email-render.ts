import Handlebars from "handlebars";
import type { Config } from "../config";

// ─────────────────────────────────────────────────────────────────────────────
// Unified email design system. All seven outgoing emails share one shell
// (masthead + accent rail + card + footer), one palette, and one set of
// cross-client hardening rules. The look is derived from the dashboard `cobalt`
// scheme but RE-TUNED for email surfaces (different backgrounds → different AA
// math), so the hexes here are intentionally not 1:1 with the app theme tokens.
//
// Colors live ONCE as the named constants below and are interpolated into the
// shared partials at registration time, so individual templates never hardcode a
// hex (no drift). Templates wrap their body in the `emailShell` partial block and
// use the `emailButton` / `emailWarnChip` helpers.
//
// Dark mode is light-first: the inline styles are the light theme (the baseline
// every client renders), and a `@media (prefers-color-scheme: dark)` block in the
// head flips class-tagged elements to the dark palette in clients that honor it.
// Clients that FORCE-invert instead (Gmail app, Outlook.com) are kept from
// turning the colored button/chip into invisible surfaces via `[data-ogsc]`
// (override-grayscale-color) / `[data-ogsb]` (…-background) locks.
// ─────────────────────────────────────────────────────────────────────────────

// LIGHT palette (the inline-style baseline).
const L = {
  page: "#e9eaee",
  card: "#ffffff",
  cardBorder: "#d8dae0",
  rule: "#c9ccd4",
  fg: "#18181b",
  fgMuted: "#52525b",
  fgSubtle: "#62626a",
  accent: "#2563eb",
  accentText: "#ffffff",
  link: "#2563eb",
  wordmark: "#18181b",
  band: "#f7f8fa",
  bandRule: "#e0e2e8",
  rowLabel: "#71717a",
  codeBg: "#f4f4f5",
  warnRail: "#d97706",
  warnChipBg: "#fdf0d5",
  warnChipBorder: "#f0c674",
  warnText: "#8a5a00",
};

// DARK palette (applied via @media for class-tagged elements).
const D = {
  page: "#141417",
  card: "#212124",
  cardBorder: "#34343a",
  rule: "#34343a",
  fg: "#fafafa",
  fgMuted: "#a1a1aa",
  fgSubtle: "#8e8e97",
  accent: "#2563eb",
  accentText: "#ffffff",
  link: "#a3cfff",
  wordmark: "#fafafa",
  band: "#2a2a2e",
  bandRule: "#3a3a40",
  rowLabel: "#a1a1aa",
  codeBg: "#18181b",
  warnRail: "#d97706",
  warnChipBg: "#3a2a12",
  warnChipBorder: "#5c431a",
  warnText: "#fdba74",
};

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO_STACK =
  "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";

// Head CSS: the dark-mode flip + forced-inverter locks. Inline styles carry the
// light defaults; these rules only re-color in clients that support them.
const EMAIL_STYLES = `
<style>
  @media (prefers-color-scheme: dark) {
    .email-body   { background: ${D.page} !important; }
    .email-page   { background: ${D.page} !important; }
    .email-card   { background: ${D.card} !important; border-color: ${D.cardBorder} !important; }
    .email-band   { background: ${D.band} !important; border-bottom-color: ${D.bandRule} !important; }
    .email-wordmark { color: ${D.wordmark} !important; }
    .email-fg     { color: ${D.fg} !important; }
    .email-muted  { color: ${D.fgMuted} !important; }
    .email-subtle { color: ${D.fgSubtle} !important; }
    .email-link   { color: ${D.link} !important; }
    .email-rule   { border-top-color: ${D.rule} !important; }
    .email-rowlabel { color: ${D.rowLabel} !important; }
    .email-code   { background: ${D.codeBg} !important; border-color: ${D.cardBorder} !important; color: ${D.fg} !important; }
    .email-chip   { background: ${D.warnChipBg} !important; border-color: ${D.warnChipBorder} !important; color: ${D.warnText} !important; }
    /* Button fill + label stay constant across modes (high contrast either way). */
  }
  /* Forced-inverter locks: keep the colored button + amber chip from being
     remapped into invisibility by clients that ignore prefers-color-scheme. */
  [data-ogsc] .email-btn-cell, u + .body .email-btn-cell { background: ${L.accent} !important; }
  [data-ogsb] .email-btn-cell { background: ${L.accent} !important; }
  [data-ogsc] .email-btn-link { color: ${L.accentText} !important; }
  [data-ogsc] .email-chip { background: ${D.warnChipBg} !important; color: ${D.warnText} !important; }
  [data-ogsb] .email-chip { background: ${D.warnChipBg} !important; }
</style>`;

// The shared shell as a Handlebars partial BLOCK: a template renders
// `{{#> emailShell}} …body… {{/emailShell}}` and its inner HTML is injected at
// `{{> @partial-block}}`. `railWarn` (block hash) swaps the cobalt rail for amber.
const EMAIL_SHELL_PARTIAL = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>table,td,a,p,h1{font-family:Arial,Helvetica,sans-serif !important;}</style>
<![endif]-->
${EMAIL_STYLES}
</head>
<body class="body email-body" style="margin:0;padding:0;background:${L.page};font-family:${FONT_STACK};-webkit-font-smoothing:antialiased;mso-line-height-rule:exactly;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-page" style="background:${L.page};">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;">
  <tr><td class="email-card" style="background:${L.card};border:1px solid ${L.cardBorder};border-radius:12px;overflow:hidden;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="email-band" style="padding:18px 36px;background:${L.band};border-bottom:1px solid ${L.bandRule};">
        <span class="email-wordmark" style="font-size:18px;font-weight:700;letter-spacing:-0.2px;color:${L.wordmark};">MonitoRSS</span>
      </td></tr>
      <tr><td style="height:3px;background:{{#if railWarn}}${L.warnRail}{{else}}${L.accent}{{/if}};font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:34px 36px 32px;">{{> @partial-block}}</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:24px 4px 0;">
    {{> emailFooter}}
  </td></tr>
</table></td></tr></table></body></html>`;

// Shared footer. Each disclosure line is gated on its value being present so an
// instance that has not configured a privacy URL or postal address renders
// neither, rather than empty boilerplate. The whole block (incl. the divider)
// only appears when at least one value is set. Values arrive via the render
// context createEmailRenderer injects, so callers never thread them through
// individual sendMail calls.
const EMAIL_FOOTER_PARTIAL = `
{{#if hasFooterDisclosures}}
<hr class="email-rule" style="border:none;border-top:1px solid ${L.rule};margin:0 0 14px;" />
{{#if footerAddress}}<p class="email-subtle" style="color:${L.fgSubtle};font-size:12px;margin:4px 0;">{{emailLinkify footerAddress}}</p>{{/if}}
{{#if footerPrivacyPolicyUrl}}<p style="font-size:12px;margin:4px 0;"><a class="email-link" href="{{footerPrivacyPolicyUrl}}" style="color:${L.link};text-decoration:underline;">Privacy Policy</a></p>{{/if}}
{{/if}}
`;

// `{{emailButton url label}}` — bulletproof CTA. A bgcolor table-cell carries the
// fill + corners (rounded everywhere modern; classic Outlook ignores
// border-radius → clean square). `mso-padding-alt` makes the Word engine honor
// the padding (it drops <a> padding); display:block makes the whole cell
// clickable. Sizes to any label — no fixed width, no clip.
function emailButton(url: unknown, label: unknown): Handlebars.SafeString {
  const href = Handlebars.escapeExpression(String(url ?? ""));
  const text = Handlebars.escapeExpression(String(label ?? ""));
  return new Handlebars.SafeString(
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0;"><tr>` +
      `<td class="email-btn-cell" bgcolor="${L.accent}" style="border-radius:8px;background:${L.accent};mso-padding-alt:13px 26px;">` +
      `<a class="email-btn-link" href="${href}" style="display:block;padding:13px 26px;font-size:15px;font-weight:600;line-height:1.2;color:${L.accentText};text-decoration:none;white-space:nowrap;">${text}</a>` +
      `</td></tr></table>`,
  );
}

// `{{emailWarnChip}}` — text-only "ACTION REQUIRED" pill (NO emoji: U+26A0 FE0F
// is a B/W glyph or tofu box in Outlook's Word engine and unreliable in
// plain-text fallback). The amber fill + bold label carry the meaning portably,
// and pairing it with the amber rail means state is never color-alone (WCAG
// 1.4.1).
//
// Spacing is carried by a spacer ROW below the pill, not by `margin` on the
// wrapper table: Gmail strips `margin` from <table> elements, which collapsed
// the gap and jammed the chip against the title. The 18px spacer cell survives
// every client. (The old -6px top margin to tuck under the rail is dropped for
// the same reason — it never applied in Gmail anyway.)
function emailWarnChip(): Handlebars.SafeString {
  return new Handlebars.SafeString(
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
      `<td class="email-chip" style="background:${L.warnChipBg};border:1px solid ${L.warnChipBorder};border-radius:999px;padding:5px 14px;font-size:12px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;color:${L.warnText};">` +
      `Action required` +
      `</td></tr>` +
      `<tr><td style="height:18px;font-size:0;line-height:0;">&nbsp;</td></tr>` +
      `</table>`,
  );
}

// `{{#emailDetailRow "LABEL"}}value html{{/emailDetailRow}}` — an uppercase label
// over its value, the row format shared by the disabled-feed + digest emails.
function emailDetailRow(
  this: unknown,
  label: unknown,
  options: Handlebars.HelperOptions,
): Handlebars.SafeString {
  const labelText = Handlebars.escapeExpression(String(label ?? ""));
  const value = options.fn(this);
  return new Handlebars.SafeString(
    `<tr><td class="email-rowlabel" style="padding-top:16px;font-size:12px;font-weight:600;letter-spacing:0.4px;text-transform:uppercase;color:${L.rowLabel};">${labelText}</td></tr>` +
      `<tr><td class="email-fg" style="padding-top:4px;font-size:15px;line-height:1.5;color:${L.fg};">${value}</td></tr>`,
  );
}

// `{{emailLinkify text}}` — renders a free-form footer line, turning any email
// address it contains into a `mailto:` link so a data-subject request is one tap
// away. The whole string is HTML-escaped first (the address is operator-supplied
// config, but we never trust it into raw HTML), then the escaped email tokens are
// wrapped in an <a>. Non-email text passes through untouched.
const EMAIL_TOKEN = /[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+/g;
function emailLinkify(text: unknown): Handlebars.SafeString {
  const escaped = Handlebars.escapeExpression(String(text ?? ""));
  const linked = escaped.replace(
    EMAIL_TOKEN,
    (addr) =>
      `<a class="email-link" href="mailto:${addr}" style="color:${L.link};text-decoration:underline;">${addr}</a>`,
  );
  return new Handlebars.SafeString(linked);
}

let registered = false;
function registerEmailAssets(): void {
  if (registered) {
    return;
  }
  Handlebars.registerPartial("emailFooter", EMAIL_FOOTER_PARTIAL);
  Handlebars.registerPartial("emailShell", EMAIL_SHELL_PARTIAL);
  Handlebars.registerHelper("emailButton", emailButton);
  Handlebars.registerHelper("emailWarnChip", emailWarnChip);
  Handlebars.registerHelper("emailDetailRow", emailDetailRow);
  Handlebars.registerHelper("emailLinkify", emailLinkify);
  registered = true;
}

registerEmailAssets();

// Style class names + the mono font stack are exported so templates can apply the
// shared roles without re-declaring colors (the literals live only here).
export const EMAIL_MONO_STACK = MONO_STACK;
export const EMAIL_LIGHT = L;

export type RenderEmail = (
  template: HandlebarsTemplateDelegate,
  data?: Record<string, unknown>,
) => string;

export function createEmailRenderer(config: Config): RenderEmail {
  registerEmailAssets();

  const footerPrivacyPolicyUrl = config.BACKEND_API_EMAIL_PRIVACY_POLICY_URL;
  const footerAddress = config.BACKEND_API_EMAIL_FOOTER_ADDRESS;
  const footerContext = {
    footerPrivacyPolicyUrl,
    footerAddress,
    hasFooterDisclosures: !!(footerPrivacyPolicyUrl || footerAddress),
  };

  // Footer context is spread last so a template's own data can never shadow
  // (and spoof) the operator-configured disclosures.
  return (template, data = {}) => template({ ...data, ...footerContext });
}
