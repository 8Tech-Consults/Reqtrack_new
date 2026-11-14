// Branded NAD email layout.
//
// buildBrandedEmail({ ... }) returns { html, text, attachments } ready for nodemailer.
// The layout uses tables and inline styles because many email clients (Outlook, Gmail)
// ignore <style> blocks and modern CSS. The NAD logo is embedded as an inline (cid)
// attachment, so it shows even though the server has no public URL.
//
// All content strings are treated as plain text and HTML-escaped.

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, "assets", "nad-logo.png");
const LOGO_CID = "nad-logo@reqtrack";

const BRAND = {
  name: "NAD",
  product: "Requisition Management System",
  navy: "#172550",
  navyText: "#12204a",
  accent: "#2aaed3",
  accentDark: "#239abd",
  page: "#f3f6f9",
  border: "#e2e8f0",
  text: "#334155",
  muted: "#64748b",
  font: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const isSafeUrl = (value) => /^https?:\/\//i.test(String(value || ""));

const TONES = {
  info: { bg: "#e9f7fb", border: "#bfe8f4", text: "#155e75" },
  success: { bg: "#ecfdf5", border: "#bbf7d0", text: "#166534" },
  warning: { bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
  danger: { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" },
};

/**
 * @param {object} content
 * @param {string} content.heading       Main title in the card, e.g. "Requisition approved".
 * @param {string} [content.preheader]   Inbox preview text (hidden in the body).
 * @param {string} [content.greeting]    e.g. "Hello Jane,".
 * @param {string[]} [content.paragraphs] Body paragraphs (plain text; newlines kept).
 * @param {{label: string, value: string}[]} [content.details] Key/value summary table.
 * @param {{text: string, tone?: 'info'|'success'|'warning'|'danger'}} [content.callout] Highlighted box, e.g. a rejection reason.
 * @param {{label: string, url: string}} [content.action] Primary button.
 * @param {string} [content.note]        Small text under the button, e.g. "This link expires in 15 minutes."
 * @param {string} [content.signOff]     Defaults to "Kind regards,\nNAD Team".
 * @param {string} [content.logoSrc]     Override the logo src (used for browser previews).
 */
export function buildBrandedEmail(content = {}) {
  const {
    heading = "",
    preheader = "",
    greeting = "",
    paragraphs = [],
    details = [],
    callout = null,
    action = null,
    note = "",
    signOff = `Kind regards,\n${BRAND.name} Team`,
    logoSrc = null,
  } = content;

  const year = new Date().getFullYear();
  const text = (value) => escapeHtml(value).replace(/\r?\n/g, "<br>");
  const button = action && action.label && isSafeUrl(action.url) ? action : null;
  const tone = TONES[callout?.tone] || TONES.info;

  const paragraphHtml = paragraphs
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${BRAND.text};">${text(p)}</p>`
    )
    .join("");

  const detailsHtml = details.filter((d) => d && d.label).length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;border:1px solid ${BRAND.border};border-radius:10px;border-collapse:separate;">
        ${details
          .filter((d) => d && d.label)
          .map(
            (d, i) => `<tr>
              <td style="padding:12px 16px;font-size:13px;line-height:18px;color:${BRAND.muted};width:38%;vertical-align:top;${i ? `border-top:1px solid ${BRAND.border};` : ""}">${text(d.label)}</td>
              <td style="padding:12px 16px;font-size:14px;line-height:20px;color:${BRAND.navyText};font-weight:600;vertical-align:top;${i ? `border-top:1px solid ${BRAND.border};` : ""}">${text(d.value ?? "—")}</td>
            </tr>`
          )
          .join("")}
      </table>`
    : "";

  const calloutHtml = callout?.text
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
        <tr><td style="background:${tone.bg};border:1px solid ${tone.border};border-radius:10px;padding:14px 16px;font-size:14px;line-height:22px;color:${tone.text};">${text(callout.text)}</td></tr>
      </table>`
    : "";

  const buttonHtml = button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 8px;">
        <tr>
          <td align="center" bgcolor="${BRAND.accent}" style="border-radius:8px;">
            <a href="${escapeHtml(button.url)}" target="_blank" rel="noopener"
               style="display:inline-block;padding:13px 26px;font-family:${BRAND.font};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;border:1px solid ${BRAND.accentDark};">
              ${escapeHtml(button.label)}
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:12px 0 0;font-size:12px;line-height:18px;color:${BRAND.muted};">
        If the button doesn't work, copy this link into your browser:<br>
        <a href="${escapeHtml(button.url)}" style="color:${BRAND.accentDark};word-break:break-all;">${escapeHtml(button.url)}</a>
      </p>`
    : "";

  const noteHtml = note
    ? `<p style="margin:16px 0 0;font-size:13px;line-height:20px;color:${BRAND.muted};">${text(note)}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(heading || BRAND.product)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.page};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">
    ${escapeHtml(preheader || heading)}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.page}" style="background:${BRAND.page};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;font-family:${BRAND.font};">

          <!-- Header -->
          <tr>
            <td bgcolor="${BRAND.navy}" style="background:${BRAND.navy};border-radius:14px 14px 0 0;padding:22px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#ffffff;border-radius:10px;padding:6px;line-height:0;">
                    <img src="${logoSrc || `cid:${LOGO_CID}`}" width="32" height="37" alt="NAD" style="display:block;border:0;outline:none;">
                  </td>
                  <td style="padding-left:12px;">
                    <div style="font-size:18px;line-height:22px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">${BRAND.name}</div>
                    <div style="font-size:12px;line-height:16px;color:#9fdcef;">${BRAND.product}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td height="4" bgcolor="${BRAND.accent}" style="background:${BRAND.accent};font-size:0;line-height:0;">&nbsp;</td></tr>

          <!-- Card -->
          <tr>
            <td bgcolor="#ffffff" style="background:#ffffff;padding:32px 28px 28px;border-left:1px solid ${BRAND.border};border-right:1px solid ${BRAND.border};">
              ${heading ? `<h1 style="margin:0 0 20px;font-size:22px;line-height:30px;font-weight:700;color:${BRAND.navyText};">${text(heading)}</h1>` : ""}
              ${greeting ? `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${BRAND.text};">${text(greeting)}</p>` : ""}
              ${paragraphHtml}
              ${calloutHtml}
              ${detailsHtml}
              ${buttonHtml}
              ${noteHtml}
              <p style="margin:28px 0 0;font-size:15px;line-height:24px;color:${BRAND.text};">${text(signOff)}</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td bgcolor="#ffffff" style="background:#ffffff;border:1px solid ${BRAND.border};border-top:1px solid ${BRAND.border};border-radius:0 0 14px 14px;padding:18px 28px;">
              <p style="margin:0;font-size:12px;line-height:18px;color:${BRAND.muted};">
                This is an automated message from the ${BRAND.name} ${BRAND.product}. Please don't reply to this email.
              </p>
              <p style="margin:6px 0 0;font-size:12px;line-height:18px;color:${BRAND.muted};">&copy; ${year} ${BRAND.name}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Plain-text alternative for clients that don't render HTML (and better spam scores).
  const textParts = [
    heading,
    greeting,
    ...paragraphs.filter(Boolean),
    callout?.text || "",
    details.filter((d) => d && d.label).map((d) => `${d.label}: ${d.value ?? "-"}`).join("\n"),
    button ? `${button.label}: ${button.url}` : "",
    note,
    signOff,
    `--\nThis is an automated message from the ${BRAND.name} ${BRAND.product}.`,
  ].filter(Boolean);

  return {
    html,
    text: textParts.join("\n\n"),
    attachments: logoSrc
      ? []
      : [{ filename: "nad-logo.png", path: LOGO_PATH, cid: LOGO_CID, contentDisposition: "inline" }],
  };
}

export default buildBrandedEmail;
