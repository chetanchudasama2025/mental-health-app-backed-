export const getEmailVerificationEmailTemplate = (
  firstName: string,
  otp: string
): string => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Email Verification</title>
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
                Verify Your Email Address
              </h2>
              
              <p style="margin: 0 0 20px; color: #666666; font-size: 16px; line-height: 1.6;">
                Hello ${firstName},
              </p>
              
              <p style="margin: 0 0 20px; color: #666666; font-size: 16px; line-height: 1.6;">
                Thank you for registering with Mental Health App! To complete your registration and secure your account, please verify your email address using the verification code below:
              </p>
              
              <!-- OTP Code Box -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <div style="display: inline-block; padding: 20px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                      <p style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                        ${otp}
                      </p>
                    </div>
                  </td>
                </tr>
              </table>
              
              <!-- Instructions -->
              <p style="margin: 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                Enter this code in the verification page to confirm your email address.
              </p>
              
              <!-- Security Notice -->
              <div style="margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-left: 4px solid #667eea; border-radius: 4px;">
                <p style="margin: 0 0 10px; color: #333333; font-size: 14px; font-weight: 600;">
                  🔒 Important Security Information
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #666666; font-size: 14px; line-height: 1.8;">
                  <li>This verification code will expire in <strong>10 minutes</strong></li>
                  <li>You have <strong>5 attempts</strong> to enter the correct code</li>
                  <li>If you didn't create an account, please ignore this email</li>
                  <li>Never share this code with anyone</li>
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

