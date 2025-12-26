export const getSessionReminderEmailTemplate = (
    patientName: string,
    therapistName: string,
    sessionDate: Date,
    sessionTime: string,
    duration: number
): string => {
    const formattedDate = sessionDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Session Reminder</title>
</head>
<body style="margin:0; padding:0; background-color:#eef6fb; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#eef6fb; padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
          style="max-width:640px; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 12px 35px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#d6effb,#eaf6ff); padding:42px; text-align:center;">
              <h1 style="margin:0; font-size:30px; color:#1f3a5f; font-weight:700;">
                ⏰ Session Reminder
              </h1>
              <p style="margin:10px 0 0; font-size:16px; color:#4a6fa5;">
                Your therapy session begins in <strong>1 hour</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:42px;">
              <p style="margin:0 0 18px; font-size:17px; color:#555;">
                Hi <strong>${patientName}</strong>,
              </p>
              <p style="margin:0 0 26px; font-size:16px; color:#555; line-height:1.7;">
                This is a gentle reminder for your upcoming therapy session.
                We’re here to support you and make sure everything goes smoothly 🌿
              </p>
              <div style="background:#f5faff; border-left:5px solid #4da3ff; padding:22px; border-radius:8px; margin:28px 0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:8px 0;">
                      <strong style="color:#1f3a5f;">Therapist</strong>
                      <span style="color:#555; margin-left:12px;">${therapistName}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;">
                      <strong style="color:#1f3a5f;">Date</strong>
                      <span style="color:#555; margin-left:12px;">${formattedDate}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;">
                      <strong style="color:#1f3a5f;">Time</strong>
                      <span style="color:#555; margin-left:12px;">${sessionTime}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;">
                      <strong style="color:#1f3a5f;">Duration</strong>
                      <span style="color:#555; margin-left:12px;">${duration} minutes</span>
                    </td>
                  </tr>
                </table>
              </div>
              <p style="margin:26px 0; font-size:16px; color:#555; line-height:1.6;">
                Please make sure you’re in a comfortable and private place before your session begins.
              </p>
              <div style="background:#fff7eb; border-left:5px solid #ffb347; padding:20px; border-radius:8px;">
                <p style="margin:0 0 10px; font-size:15px; color:#1f3a5f; font-weight:600;">
                  💡 Tips for a great session
                </p>
                <ul style="margin:0; padding-left:20px; font-size:14px; color:#555; line-height:1.7;">
                  <li>Choose a quiet, private space</li>
                  <li>Check your internet connection</li>
                  <li>Keep water nearby</li>
                  <li>Think about what you’d like to discuss</li>
                </ul>
              </div>
              <p style="margin:30px 0 0; font-size:16px; color:#555;">
                We’re looking forward to supporting you 💙
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f7f9fc; padding:26px; text-align:center;">
              <p style="margin:0; font-size:12px; color:#999;">
                © ${new Date().getFullYear()} Mental Health App. All rights reserved.
              </p>
              <p style="margin:6px 0 0; font-size:12px; color:#999;">
                Need help? 
                <a href="mailto:support@mentalhealthapp.com" style="color:#4da3ff; text-decoration:none;">
                  Contact Support
                </a>
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
