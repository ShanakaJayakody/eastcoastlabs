/** Shared navy email identity. Inline styles and tables survive email clients
 * that remove stylesheets. The shared public logo is the only remote asset;
 * the wordmark remains readable text when images are blocked. */
export const EMAIL_SITE = 'https://www.eastcoastlabs.com.au';
export const EMAIL_COLORS = {
  ink: '#152e46', muted: '#536577', accent: '#275b88', brand: '#245cff',
  background: '#edf3f7', paper: '#ffffff', line: '#dbe3e9',
} as const;

const FONT = 'Arial, Helvetica, sans-serif';
export const EMAIL_STYLES = {
  heading: `margin:0 0 20px;color:${EMAIL_COLORS.ink};font-family:${FONT};font-size:28px;line-height:1.25;font-weight:600;letter-spacing:-0.5px;`,
  paragraph: `margin:0 0 18px;color:${EMAIL_COLORS.ink};font-size:16px;line-height:1.7;`,
  muted: `margin:16px 0 0;color:${EMAIL_COLORS.muted};font-size:14px;line-height:1.65;`,
  list: `margin:0 0 20px;padding-left:22px;color:${EMAIL_COLORS.ink};font-size:16px;line-height:1.8;`,
} as const;

export const escapeEmailHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** A table-backed action retains its colour and padding in desktop Outlook. */
export function emailButton(url: string, label: string): string {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;max-width:100%;"><tr>
<td align="center" bgcolor="${EMAIL_COLORS.ink}" style="border-radius:4px;mso-padding-alt:14px 24px;">
<a href="${escapeEmailHtml(url)}" style="display:inline-block;padding:14px 24px;border:1px solid ${EMAIL_COLORS.ink};border-radius:4px;font-family:${FONT};font-size:16px;line-height:22px;font-weight:600;text-align:center;text-decoration:none;background:${EMAIL_COLORS.ink};color:#ffffff;mso-padding-alt:0;"><!--[if mso]><i style="mso-font-width:150%;mso-text-raise:22pt;" hidden>&emsp;</i><![endif]--><span style="mso-text-raise:11pt;">${escapeEmailHtml(label)}</span><!--[if mso]><i style="mso-font-width:150%;" hidden>&emsp;&#8203;</i><![endif]--></a>
</td></tr></table>`;
}

interface EmailShellOptions {
  preheader: string;
  /** Trusted HTML produced by our renderers; escape all interpolated payloads. */
  body: string;
  supportEmail?: string;
  supportHours?: string;
  unsubscribeUrl?: string;
  audience?: 'customer' | 'admin';
}

export function emailShell({ preheader, body, supportEmail, supportHours, unsubscribeUrl, audience = 'customer' }: EmailShellOptions): string {
  const c = EMAIL_COLORS;
  const linkStyle = `color:${c.accent};text-decoration:underline;`;
  const contact = audience === 'customer' && supportEmail
    ? `<tr><td class="email-padding" bgcolor="#f7fafc" style="padding:24px 36px;border-top:1px solid ${c.line};">
<p style="margin:0 0 6px;color:${c.ink};font-size:15px;line-height:1.6;font-weight:600;">Here to help</p>
<p style="margin:0;color:${c.muted};font-size:14px;line-height:1.7;">For questions about your order or our range, contact<br>
<a href="mailto:${escapeEmailHtml(supportEmail)}" style="${linkStyle}overflow-wrap:anywhere;word-break:break-word;">${escapeEmailHtml(supportEmail)}</a>.</p>
${supportHours ? `<p style="margin:6px 0 0;color:${c.muted};font-size:13px;line-height:1.6;">${escapeEmailHtml(supportHours)}</p>` : ''}
</td></tr>` : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>East Coast Labs</title>
<style>body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}a:focus-visible{outline:3px solid #275b88;outline-offset:4px}@media screen and (max-width:480px){.email-outer{padding:16px 8px!important}.email-padding{padding-left:24px!important;padding-right:24px!important}}</style>
</head><body bgcolor="${c.background}" style="margin:0;padding:0;width:100%;background:${c.background};font-family:${FONT};color:${c.ink};">
<div style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;" aria-hidden="true">${escapeEmailHtml(preheader)}${'&#847; &zwnj; &nbsp; '.repeat(16)}</div>
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="${c.background}" style="width:100%;background:${c.background};"><tr>
<td class="email-outer" align="center" style="padding:40px 12px;">
<!--[if mso]><table role="presentation" width="600" border="0" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="${c.paper}" style="width:100%;max-width:600px;background:${c.paper};border:1px solid ${c.line};border-top:4px solid ${c.accent};">
<tr><td class="email-padding" style="padding:30px 36px 26px;border-bottom:1px solid ${c.line};">
<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr>
<td width="48" valign="middle" style="width:48px;"><a href="${EMAIL_SITE}" style="text-decoration:none;"><img src="${EMAIL_SITE}/brand/ecl-cobalt-symbol.png" alt="East Coast Labs" width="48" height="48" style="display:block;width:48px;height:48px;border:0;color:${c.brand};font-size:10px;"></a></td>
<td valign="middle" style="padding-left:12px;"><a href="${EMAIL_SITE}" style="display:inline-block;color:#000000;text-decoration:none;">
<span style="font-family:${FONT};font-size:16px;line-height:24px;font-weight:700;letter-spacing:0.6px;color:#000000;">EAST COAST LABS</span><br>
<span style="font-size:9px;line-height:18px;font-weight:600;letter-spacing:1.5px;color:#000000;">RESEARCH PEPTIDES</span></a></td>
</tr></table>
</td></tr>
<tr><td class="email-padding" style="padding:32px 36px 36px;font-family:${FONT};font-size:16px;line-height:1.7;color:${c.ink};overflow-wrap:break-word;word-wrap:break-word;">
<p style="margin:0 0 16px;color:${c.accent};font-size:11px;line-height:1.5;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">${audience === 'admin' ? 'Operations update' : 'From East Coast Labs'}</p>
${body}
</td></tr>
${contact}
</table>
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;"><tr><td align="center" style="padding:22px 24px 0;color:${c.muted};font-family:${FONT};font-size:12px;line-height:1.7;">
<p style="margin:0 0 8px;">East Coast Labs &middot; Australia<br>Research use only — not for human or animal consumption.</p>
<p style="margin:0;"><a href="${EMAIL_SITE}" style="${linkStyle}">Visit our website</a>${unsubscribeUrl ? ` &nbsp;&middot;&nbsp; <a href="${escapeEmailHtml(unsubscribeUrl)}" style="${linkStyle}">Unsubscribe from marketing emails</a>` : ''}</p>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>`;
}
