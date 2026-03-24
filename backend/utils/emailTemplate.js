const { escapeHtml } = require("./escapeHtml");

function buildGoogleEmail(title, headerText, contentHtml, options = {}) {
  const { code = null, button = null, footerNote = null } = options;
  const logoUrl = "cid:isu-logo";

  let codeBlock = "";
  if (code) {
    codeBlock = `
      <div style="margin: 32px 0;">
        <div style="display: block; background: #F8F9FA; border-radius: 8px; padding: 20px 0; text-align: center; letter-spacing: 8px; font-size: 36px; font-weight: 500; color: #1F1F1F; border: 1px solid #E0E0E0;">
          ${code}
        </div>
      </div>
    `;
  }

  let buttonBlock = "";
  if (button) {
    const safeUrl = escapeHtml(button.url || "");
    const safeText = escapeHtml(button.text || "");
    buttonBlock = `
      <div style="text-align: center; margin: 32px 0;">
        <a href="${safeUrl}" style="background-color: #388E3C; color: #FFFFFF; padding: 14px 32px; text-decoration: none; border-radius: 100px; font-weight: 500; font-size: 16px; display: inline-block; font-family: 'Google Sans', Roboto, sans-serif;">
          ${safeText}
        </a>
      </div>
    `;
  }

  return `
    <div style="background-color: #F8F9FA; padding: 40px 20px; font-family: 'Google Sans', Roboto, Helvetica, Arial, sans-serif;">
      <div style="max-width: 500px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E0E0E0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.04);">
        <div style="padding: 32px 40px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="48" style="vertical-align: middle;">
                 <img src="${logoUrl}" alt="ISU Logo" style="width: 48px; height: 48px; display: block; border: none;">
              </td>
              <td style="vertical-align: middle; padding-left: 12px;">
                 <span style="color: #388E3C; margin: 0; font-size: 24px; font-weight: 500; letter-spacing: -0.5px; display: block;">Smart<span style="color: #1F1F1F;">Clearance</span></span>
              </td>
            </tr>
          </table>
        </div>
        <div style="padding: 32px 40px 32px;">
          ${headerText ? `<h2 style="color: #1F1F1F; font-size: 20px; font-weight: 400; margin: 0 0 16px;">${headerText}</h2>` : ""}
          <div style="color: #444746; font-size: 14px; line-height: 22px; margin: 0;">
            ${contentHtml}
          </div>
          ${codeBlock}
          ${buttonBlock}
        </div>
        <div style="background: #F8F9FA; padding: 24px 40px; border-top: 1px solid #E0E0E0;">
          <p style="color: #747775; font-size: 12px; line-height: 18px; margin: 0;">
            ${footerNote ? footerNote + "<br>" : ""}
            This email was sent by the SmartClearance System. <br>
            Isabela State University &mdash; Echague Campus
          </p>
        </div>
      </div>
    </div>
  `;
}

const path = require("path");
const fs = require("fs");

function getLogoAttachment() {
  const logoPath = path.join(__dirname, "../../frontend/public/logo.png");
  if (!fs.existsSync(logoPath)) {
    console.warn("[email] Logo not found at", logoPath, "— sending email without logo.");
    return [];
  }
  return [
    {
      filename: "logo.png",
      path: logoPath,
      cid: "isu-logo",
    },
  ];
}

module.exports = { buildGoogleEmail, getLogoAttachment };
