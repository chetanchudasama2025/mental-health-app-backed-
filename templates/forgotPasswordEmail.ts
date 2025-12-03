export const getForgotPasswordEmailTemplate = (
  firstName: string,
  resetLink: string
): string => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Password Reset Request</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; border-spacing: 0; background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">
                Mental Health App
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #333333; font-size: 24px; font-weight: 600; line-height: 1.3;">
                Password Reset Request
              </h2>
              
              <p style="margin: 0 0 20px; color: #666666; font-size: 16px; line-height: 1.6;">
                Hello ${firstName},
              </p>
              
              <p style="margin: 0 0 20px; color: #666666; font-size: 16px; line-height: 1.6;">
                We received a request to reset your password. If you made this request, click the button below to create a new password:
              </p>
              
              <!-- Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${resetLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; text-align: center; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3); transition: all 0.3s ease;">
                      Reset Your Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Alternative Link -->
              <p style="margin: 20px 0 0; color: #999999; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 10px 0 20px; color: #667eea; font-size: 14px; line-height: 1.6; word-break: break-all;">
                <a href="${resetLink}" style="color: #667eea; text-decoration: none;">${resetLink}</a>
              </p>
              
              <!-- Security Notice -->
              <div style="margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-left: 4px solid #667eea; border-radius: 4px;">
                <p style="margin: 0 0 10px; color: #333333; font-size: 14px; font-weight: 600;">
                  ⏰ Important Security Information
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #666666; font-size: 14px; line-height: 1.8;">
                  <li>This link will expire in <strong>1 hour</strong> for your security</li>
                  <li>If you didn't request this password reset, please ignore this email</li>
                  <li>Your password will remain unchanged if you don't click the link</li>
                  <li>Never share this link with anyone</li>
                </ul>
              </div>
              
              <p style="margin: 30px 0 0; color: #666666; font-size: 16px; line-height: 1.6;">
                If you have any questions or concerns, please contact our support team.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; border-top: 1px solid #e9ecef;">
              <p style="margin: 0 0 10px; color: #999999; font-size: 12px; line-height: 1.6; text-align: center;">
                This is an automated email. Please do not reply to this message.
              </p>
              <p style="margin: 0; color: #999999; font-size: 12px; line-height: 1.6; text-align: center;">
                © ${new Date().getFullYear()} Mental Health App. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Support Link -->
        <table role="presentation" style="width: 100%; max-width: 600px; margin-top: 20px; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 0;">
              <p style="margin: 0; color: #999999; font-size: 12px; line-height: 1.6;">
                Need help? <a href="mailto:support@mentalhealthapp.com" style="color: #667eea; text-decoration: none;">Contact Support</a>
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

