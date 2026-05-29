import nodemailer from "nodemailer";

interface BookingEmailData {
  id: string;
  sessionId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  packageName: string;
  bookingDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  durationMinutes: number;
  amount: number;
}

const STUDIO_ADDRESS = "Umudike Junction, opp superlative filling station, Umuahia, Abia State, Nigeria";
const CONTACT_EMAIL = "info@adminvisionhouse.com";
const CONTACT_PHONE = "+234 806 439 2746";

// Get SMTP configuration from environment variables
const getTransporter = () => {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass || user.includes("placeholder") || pass.includes("placeholder")) {
    console.log("⚠️ SMTP_USER or SMTP_PASS environment variables are not set or contain placeholders. Email service will run in SANDBOX/CONSOLE-LOG mode.");
    return null;
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // STARTTLS
    auth: {
      user,
      pass
    }
  });
};

/**
 * Shared HTML Base Layout Wrapper for premium dark mode aesthetics.
 */
const getHtmlLayout = (contentHtml: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Vision House</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background-color: #060707;
      color: #e5e7eb;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #060707;
      padding: 40px 20px;
      box-sizing: border-box;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #0d0e10;
      border: 1px solid #1f2937;
      padding: 40px;
      text-align: left;
    }
    .logo-container {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 1px solid #1f2937;
      padding-bottom: 20px;
    }
    .brand-logo {
      display: inline-block;
      font-weight: 900;
      letter-spacing: 2px;
      font-size: 24px;
    }
    .brand-admin {
      background-color: #2f9f57;
      color: #ffffff;
      padding: 2px 8px;
    }
    .brand-vision {
      color: #ffffff;
      margin-left: 5px;
    }
    .heading {
      font-size: 28px;
      font-weight: 800;
      color: #ffffff;
      margin-top: 0;
      margin-bottom: 15px;
      letter-spacing: -0.5px;
    }
    .subheading {
      font-size: 15px;
      color: #10b981;
      font-family: monospace;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 25px;
    }
    .description {
      font-size: 15px;
      line-height: 1.6;
      color: #9ca3af;
      margin-bottom: 30px;
    }
    .card {
      background-color: rgba(16, 185, 129, 0.02);
      border: 1px solid rgba(16, 185, 129, 0.15);
      padding: 25px;
      margin-bottom: 30px;
    }
    .card-title {
      font-size: 12px;
      color: #4b5563;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      font-family: monospace;
      margin-bottom: 15px;
      border-bottom: 1px solid #1f2937;
      padding-bottom: 10px;
    }
    .card-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
      font-size: 14px;
    }
    .card-row:last-child {
      margin-bottom: 0;
    }
    .card-label {
      color: #9ca3af;
    }
    .card-value {
      font-weight: bold;
      color: #ffffff;
    }
    .card-value.accent {
      color: #10b981;
      font-weight: 800;
    }
    .card-value.mono {
      font-family: monospace;
    }
    .direction-box {
      background-color: #111827;
      border: 1px solid #1f2937;
      padding: 20px;
      margin-bottom: 30px;
      font-size: 14px;
      line-height: 1.6;
    }
    .direction-title {
      font-weight: bold;
      color: #ffffff;
      margin-bottom: 8px;
    }
    .address-text {
      color: #9ca3af;
      font-style: italic;
    }
    .btn-container {
      text-align: center;
      margin-top: 30px;
      margin-bottom: 30px;
    }
    .btn {
      display: inline-block;
      background-color: #10b981;
      color: #060707 !important;
      font-weight: 800;
      text-decoration: none;
      padding: 15px 30px;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      transition: all 0.3s ease;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      border-top: 1px solid #1f2937;
      padding-top: 25px;
      font-size: 12px;
      color: #4b5563;
      line-height: 1.6;
    }
    .footer a {
      color: #10b981;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="logo-container">
        <div class="brand-logo">
          <span class="brand-admin">ADMIN</span><span class="brand-vision">VISION</span>
        </div>
      </div>
      
      ${contentHtml}
      
      <div class="footer">
        <p>© ${new Date().getFullYear()} Admin Vision House. All rights reserved.</p>
        <p>
          Umudike Junction, opp superlative filling station, Umuahia, Abia State, Nigeria<br>
          Phone: ${CONTACT_PHONE} | Email: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`;

/**
 * Sends or logs an email based on environmental setups.
 */
const sendMailOrLog = async (options: { to: string; subject: string; html: string }) => {
  const transporter = getTransporter();
  const from = process.env.SMTP_USER || "info@adminvisionhouse.com";

  if (!transporter) {
    console.log(`\n==================================================`);
    console.log(`📧 [SANDBOX EMAIL LOG]`);
    console.log(`TO:      ${options.to}`);
    console.log(`FROM:    ${from}`);
    console.log(`SUBJECT: ${options.subject}`);
    console.log(`==================================================\n`);
    // Return mock success in sandbox mode
    return { messageId: "sandbox-mock-id" };
  }

  try {
    const info = await transporter.sendMail({
      from: `"Admin Vision House" <${from}>`,
      to: options.to,
      subject: options.subject,
      html: options.html
    });
    console.log(`📧 Email successfully dispatched to ${options.to}. MessageId: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`❌ Error sending email to ${options.to}:`, error);
    throw error;
  }
};

/**
 * Format date string YYYY-MM-DD to a more human-readable date.
 */
const formatFriendlyDate = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC"
    });
  } catch {
    return dateStr;
  }
};

/**
 * 1. Immediate Booking Confirmation Email
 */
export const sendConfirmationEmail = async (booking: BookingEmailData) => {
  const friendlyDate = formatFriendlyDate(booking.bookingDate);
  const content = `
    <h1 class="heading">Booking Confirmed!</h1>
    <div class="subheading">${booking.packageName} Reserved</div>
    
    <p class="description">
      Hello ${booking.customerName},<br><br>
      Your payment has been successfully verified, and your creative session space is fully confirmed. Below are your reservation details along with your unique Session ID.
    </p>
    
    <div class="card">
      <div class="card-title">Session Details</div>
      <div class="card-row">
        <span class="card-label">Session ID:</span>
        <span class="card-value mono accent">${booking.sessionId || "N/A"}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Reserved Space:</span>
        <span class="card-value">${booking.packageName}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Date:</span>
        <span class="card-value">${friendlyDate}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Start Time:</span>
        <span class="card-value mono">${booking.startTime} (${booking.durationMinutes} minutes)</span>
      </div>
      <div class="card-row">
        <span class="card-label">Cleared Amount:</span>
        <span class="card-value accent">₦${booking.amount.toLocaleString()}</span>
      </div>
    </div>
    
    <div class="direction-box">
      <div class="direction-title">📍 Address & Arrival Instructions:</div>
      <p class="address-text" style="margin: 0 0 10px 0;">
        ${STUDIO_ADDRESS}
      </p>
      <span style="color: #9ca3af; font-size: 13px;">
        Please make sure to arrive <strong>10 minutes prior</strong> to your scheduled session starting time so we can set up your creative tools.
      </span>
    </div>
    
    <p class="description" style="margin-bottom: 0;">
      We look forward to hosting you! If you need to make any changes or have questions, feel free to reply to this email or call us at ${CONTACT_PHONE}.
    </p>
  `;

  return sendMailOrLog({
    to: booking.customerEmail,
    subject: `Booking Confirmed: ${booking.packageName} [ID: ${booking.sessionId}]`,
    html: getHtmlLayout(content)
  });
};

/**
 * 2. Day-Before Evening Reminder Email (sent at 18:00 WAT the day before)
 */
export const sendDayBeforeReminder = async (booking: BookingEmailData) => {
  const friendlyDate = formatFriendlyDate(booking.bookingDate);
  const content = `
    <h1 class="heading">Tomorrow is your session!</h1>
    <div class="subheading">Friendly Evening Reminder</div>
    
    <p class="description">
      Hello ${booking.customerName},<br><br>
      This is a friendly reminder that your creative session in the **${booking.packageName}** is scheduled for tomorrow. Our team is busy preparing the studio to ensure you have a premium session experience.
    </p>
    
    <div class="card">
      <div class="card-title">Reservation Review</div>
      <div class="card-row">
        <span class="card-label">Session ID:</span>
        <span class="card-value mono accent">${booking.sessionId || "N/A"}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Scheduled Date:</span>
        <span class="card-value">${friendlyDate}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Start Time:</span>
        <span class="card-value mono">${booking.startTime} (${booking.durationMinutes} minutes)</span>
      </div>
    </div>
    
    <div class="direction-box">
      <div class="direction-title">📍 Location Details:</div>
      <p class="address-text" style="margin: 0 0 10px 0;">
        ${STUDIO_ADDRESS}
      </p>
      <span style="color: #9ca3af; font-size: 13px;">
        To make the most of your booked time, please plan to arrive <strong>10 minutes early</strong>.
      </span>
    </div>
    
    <p class="description" style="margin-bottom: 0;">
      If you have any questions or need last-minute assistance, reach out at ${CONTACT_PHONE}. See you tomorrow!
    </p>
  `;

  return sendMailOrLog({
    to: booking.customerEmail,
    subject: `Reminder: Your studio session is tomorrow! [ID: ${booking.sessionId}]`,
    html: getHtmlLayout(content)
  });
};

/**
 * 3. 1-Hour-Before Session Reminder Email
 */
export const sendHourBeforeReminder = async (booking: BookingEmailData) => {
  const content = `
    <h1 class="heading">See you in an hour!</h1>
    <div class="subheading">Final Countdown Reminder</div>
    
    <p class="description">
      Hello ${booking.customerName},<br><br>
      Your creative session in the **${booking.packageName}** begins in exactly **one hour**! The studio has been fully prepped, sanitized, and set up for your arrival.
    </p>
    
    <div class="card">
      <div class="card-title">Session Time</div>
      <div class="card-row">
        <span class="card-label">Session ID:</span>
        <span class="card-value mono accent">${booking.sessionId || "N/A"}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Starts At:</span>
        <span class="card-value mono accent">${booking.startTime}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Duration:</span>
        <span class="card-value mono">${booking.durationMinutes} minutes</span>
      </div>
    </div>
    
    <div class="direction-box">
      <div class="direction-title">📍 Getting Here:</div>
      <p class="address-text" style="margin: 0 0 10px 0;">
        ${STUDIO_ADDRESS}
      </p>
      <span style="color: #9ca3af; font-size: 13px;">
        Please head over now to make sure you arrive <strong>10 minutes prior</strong> to start.
      </span>
    </div>
    
    <p class="description" style="margin-bottom: 0;">
      Need quick directions? Give us a call immediately at ${CONTACT_PHONE}. See you very soon!
    </p>
  `;

  return sendMailOrLog({
    to: booking.customerEmail,
    subject: `Final Call: Your studio session starts in 1 hour! [ID: ${booking.sessionId}]`,
    html: getHtmlLayout(content)
  });
};
