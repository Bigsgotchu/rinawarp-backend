// backend/services/email/LicenseEmailService.js
import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const FROM = process.env.SENDGRID_FROM_EMAIL || 'support@rinawarptech.com';

export async function sendLicenseEmail(params) {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY not set; skipping email send.');
    return { success: false, error: 'SENDGRID_API_KEY not configured' };
  }

  const { to, licenseKey, planName, downloadUrl } = params;

  const msg = {
    to,
    from: FROM,
    subject: `Your RinaWarp Terminal Pro License (${planName})`,
    html: `
      <p>Hey there 💜</p>
      <p>Thanks for grabbing <strong>${planName}</strong> of RinaWarp Terminal Pro.</p>
      <p>Here is your license key:</p>
      <pre style="font-size: 16px; padding: 8px 12px; background: #111827; color: #e5e7eb; border-radius: 6px; font-family: monospace;">
${licenseKey}
      </pre>
      <p>You can download the latest installer here:</p>
      <p><a href="${downloadUrl}" style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Download Now</a></p>
      <p>If you ever lose this email, reply to this address and we'll resend your license.</p>
      <p>– RinaWarp Team</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <p style="font-size: 12px; color: #6b7280;">Need help? Contact us at support@rinawarptech.com</p>
    `,
  };

  try {
    const response = await sgMail.send(msg);
    console.log('License email sent successfully to:', to);
    return { success: true, messageId: response[0].headers['x-message-id'] };
  } catch (error) {
    console.error('Failed to send license email:', error);
    return { success: false, error: error.message };
  }
}

export async function sendWelcomeEmail(params) {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY not set; skipping email send.');
    return { success: false, error: 'SENDGRID_API_KEY not configured' };
  }

  const { to, planName } = params;

  const msg = {
    to,
    from: FROM,
    subject: `Welcome to RinaWarp Terminal Pro - ${planName}!`,
    html: `
      <p>Welcome to the RinaWarp Terminal Pro community! 🎉</p>
      <p>We're excited to have you onboard with our <strong>${planName}</strong> plan.</p>
      <h3>Getting Started:</h3>
      <ol>
        <li>Download and install the app using your license key</li>
        <li>Start your terminal and type your first AI command</li>
        <li>Explore our AI-powered features and workflows</li>
      </ol>
      <p>If you have any questions or need help, don't hesitate to reach out to our support team.</p>
      <p>Happy terminal-ing!</p>
      <p>– The RinaWarp Team</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <p style="font-size: 12px; color: #6b7280;">Need help? Contact us at support@rinawarptech.com</p>
    `,
  };

  try {
    const response = await sgMail.send(msg);
    console.log('Welcome email sent successfully to:', to);
    return { success: true, messageId: response[0].headers['x-message-id'] };
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return { success: false, error: error.message };
  }
}