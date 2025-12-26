export const getEmailVerificationEmailTemplate = (
    firstName: string,
    otp: string
): string => {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Email Verification</title>
</head>

<body style="margin:0; padding:0; background-color:#eef6fb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#eef6fb; padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
          style="max-width:620px; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#cfe9f5,#e8f4ff); padding:40px; text-align:center;">
              <h1 style="margin:0; font-size:28px; color:#1f3a5f; font-weight:700;">
                Find Clarity & Healing
              </h1>
              <p style="margin:10px 0 0; font-size:15px; color:#4a6fa5;">
                Professional therapy, designed around you
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 15px; font-size:22px; color:#1f3a5f;">
                Verify your email
              </h2>
              <p style="margin:0 0 20px; font-size:16px; color:#555;">
                Hi <strong>${firstName}</strong>,
              </p>
              <p style="margin:0 0 25px; font-size:16px; color:#555; line-height:1.6;">
                Welcome to our mental health platform 🌿  
                Please confirm your email address using the verification code below.
              </p>
              <table width="100%" role="presentation" cellpadding="0" cellspacing="0" style="margin:30px 0;">
                <tr>
                  <td align="center">
                    <div style="
                      display:inline-block;
                      padding:18px 36px;
                      background:#4da3ff;
                      border-radius:10px;
                      font-size:32px;
                      font-weight:700;
                      letter-spacing:6px;
                      color:#ffffff;
                      box-shadow:0 6px 15px rgba(77,163,255,0.35);
                      font-family:'Courier New', monospace;
                    ">
                      ${otp}
                    </div>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 20px; font-size:15px; color:#666;">
                Enter this code on the verification screen to activate your account.
              </p>
              <div style="background:#f5faff; border-left:4px solid #4da3ff; padding:16px; border-radius:6px; margin-top:30px;">
                <p style="margin:0 0 8px; font-size:14px; color:#1f3a5f; font-weight:600;">
                  🔐 Security Notice
                </p>
                <ul style="margin:0; padding-left:18px; font-size:14px; color:#555; line-height:1.7;">
                  <li>Code expires in <strong>10 minutes</strong></li>
                  <li>Maximum <strong>5 attempts</strong></li>
                  <li>Do not share this code with anyone</li>
                </ul>
              </div>
              <p style="margin:30px 0 0; font-size:15px; color:#666;">
                If you didn’t request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f7f9fc; padding:25px; text-align:center;">
              <p style="margin:0; font-size:12px; color:#999;">
                © ${new Date().getFullYear()} Mental Health App. All rights reserved.
              </p>
              <p style="margin:6px 0 0; font-size:12px; color:#999;">
                Need help? <a href="mailto:support@mentalhealthapp.com" style="color:#4da3ff; text-decoration:none;">Contact Support</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};
