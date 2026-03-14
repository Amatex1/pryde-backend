/**
 * Email Template Builder
 *
 * Builds consistent branded HTML email templates.
 *
 * @param {object} opts
 * @param {string} opts.title       - Email heading
 * @param {string} opts.body        - Main body HTML content
 * @param {string} [opts.actionText]  - CTA button label
 * @param {string} [opts.actionUrl]   - CTA button URL
 * @param {string} [opts.expiresAt]   - Optional expiry notice appended to body
 * @returns {string} Full HTML string
 */
export function buildEmailTemplate({ title, body, actionText, actionUrl, expiresAt } = {}) {
  const ctaBlock = actionText && actionUrl
    ? `<p style="text-align:center;margin:28px 0">
         <a href="${actionUrl}"
            style="background:#7c3aed;color:#ffffff;text-decoration:none;
                   padding:12px 28px;border-radius:6px;font-weight:600;
                   display:inline-block;font-size:15px">
           ${actionText}
         </a>
       </p>`
    : '';

  const expiryBlock = expiresAt
    ? `<p style="color:#6b7280;font-size:13px;margin-top:16px">
         This link expires at ${expiresAt}.
       </p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title || 'Pryde Social'}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;padding:40px;max-width:560px">
          <tr>
            <td>
              <!-- Header -->
              <p style="margin:0 0 24px;font-size:22px;font-weight:700;color:#111827">
                ${title || ''}
              </p>
              <!-- Body -->
              <div style="color:#374151;font-size:15px;line-height:1.6">
                ${body || ''}
              </div>
              <!-- CTA -->
              ${ctaBlock}
              <!-- Expiry -->
              ${expiryBlock}
              <!-- Footer -->
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px" />
              <p style="color:#9ca3af;font-size:12px;margin:0">
                You are receiving this email because you have an account on
                <a href="https://prydeapp.com" style="color:#7c3aed">Pryde Social</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export default { buildEmailTemplate };
