/**
 * Builds a branded HTML email using Pryde's standard template.
 *
 * @param {object} options
 * @param {string} options.title        - Email heading shown below the logo
 * @param {string} options.body         - Main message body (HTML-safe string)
 * @param {string} [options.actionText] - CTA button label (optional)
 * @param {string} [options.actionUrl]  - CTA button URL (optional)
 * @param {string} [options.expiresAt]  - Formatted expiration time string (optional)
 * @returns {string} Complete HTML email string
 */
export function buildEmailTemplate({ title, body, actionText, actionUrl, expiresAt }) {
  return `
  <div style="font-family: Arial, sans-serif; background:#f7f7fb; padding:40px;">
    <div style="max-width:600px;margin:auto;background:white;border-radius:10px;padding:40px">

      <h1 style="color:#5B3DF6;margin-bottom:20px;">
        Pryde
      </h1>

      <h2 style="margin-bottom:20px;">
        ${title}
      </h2>

      <p style="font-size:16px;color:#333;">
        ${body}
      </p>

      ${/* Optional expiration notice for security-sensitive emails (password reset, account recovery) */ expiresAt ? `
      <p style="font-size:14px;color:#b45309;margin-top:10px">
        This link expires at: ${expiresAt}
      </p>` : ''}

      ${
        actionUrl
          ? `
      <div style="margin:30px 0">
        <a href="${actionUrl}"
           style="background:#5B3DF6;color:white;padding:14px 22px;border-radius:6px;text-decoration:none;font-weight:bold;">
           ${actionText}
        </a>
      </div>`
          : ''
      }

      ${
        actionUrl
          ? `
      <p style="font-size:13px;color:#666;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        ${actionUrl}
      </p>`
          : ''
      }

      <hr style="margin:30px 0;border:none;border-top:1px solid #eee">

      <p style="font-size:12px;color:#888;">
        This email was sent by Pryde.<br>
        Support: support@prydeapp.com<br>
        Security: security@prydeapp.com
      </p>

    </div>
  </div>
  `;
}
