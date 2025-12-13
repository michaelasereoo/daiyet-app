/**
 * Professional HTML Email Templates for Brevo
 * Mobile-responsive, brand-consistent email templates with inline CSS
 */

interface EmailTemplateData {
  userName?: string;
  eventTitle?: string;
  date?: string;
  time?: string;
  meetingLink?: string;
  message?: string;
  requestType?: string;
  actionRequired?: boolean;
  actionLink?: string;
  feedbackLink?: string;
  mealPlanType?: string;
  rescheduleReason?: string;
  cancellationReason?: string;
  amount?: string;
  currency?: string;
  [key: string]: any;
}

/**
 * Base email template wrapper with responsive design
 */
function getBaseEmailTemplate(content: string, title?: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title || "Daiyet"}</title>
  <style>
    /* Email client reset */
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    
    /* Mobile styles */
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        padding: 20px !important;
      }
      .email-body {
        padding: 20px !important;
      }
      .button {
        width: 100% !important;
        padding: 14px !important;
      }
      .two-column {
        width: 100% !important;
        display: block !important;
      }
      .column-left, .column-right {
        width: 100% !important;
        padding: 10px 0 !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color: #0a0a0a; padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Daiyet</h1>
              <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 14px;">Scheduling reinvented</p>
            </td>
          </tr>
          
          <!-- Body Content -->
          <tr>
            <td class="email-body" style="padding: 40px; font-size: 16px; line-height: 24px; color: #111827;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">
                © ${new Date().getFullYear()} Daiyet. All rights reserved.
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                This email was sent to you because you have an account with Daiyet.
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
}

/**
 * Generate a styled button for emails
 */
function getButton(link: string, text: string, primary: boolean = true): string {
  const backgroundColor = primary ? "#404040" : "#ffffff";
  const textColor = primary ? "#ffffff" : "#404040";
  const border = primary ? "none" : "1px solid #404040";
  
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td class="button" style="border-radius: 6px; background-color: ${backgroundColor}; border: ${border}; padding: 0;">
                <a href="${link}" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 500; text-decoration: none; color: ${textColor}; border-radius: 6px;">
                  ${text}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Booking Confirmation Email Template
 */
export function getBookingConfirmationTemplate(data: EmailTemplateData, isDietitian: boolean = false): string {
  const greeting = isDietitian 
    ? `Hello ${data.userName || "Dietitian"},<br><br>You have a new booking confirmed:`
    : `Hello ${data.userName || "User"},<br><br>Your booking has been confirmed!`;
  
  const content = `
    ${greeting}
    
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <tr>
        <td style="padding: 20px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">
          <strong style="font-size: 18px; color: #111827;">${data.eventTitle || "Consultation"}</strong>
        </td>
      </tr>
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Date:</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${data.date || "Not specified"}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Time:</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${data.time || "Not specified"}</td>
            </tr>
            ${data.meetingLink ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Meeting:</td>
              <td style="padding: 8px 0;">
                <a href="${data.meetingLink}" style="color: #404040; text-decoration: underline; font-size: 14px;">Join Meeting</a>
              </td>
            </tr>
            ` : ''}
          </table>
        </td>
      </tr>
    </table>
    
    ${data.meetingLink ? getButton(data.meetingLink, "Join Meeting", true) : ''}
    
    <p style="margin: 24px 0 0 0; font-size: 14px; color: #6b7280;">
      ${isDietitian ? "You can view all your bookings in your dashboard." : "We look forward to seeing you!"}
    </p>
  `;
  
  return getBaseEmailTemplate(content, "Booking Confirmed - Daiyet");
}

/**
 * Meeting Reminder Email Template
 */
export function getMeetingReminderTemplate(data: EmailTemplateData): string {
  const reminderTime = data.reminderTime || "24 hours";
  
  const content = `
    <p style="margin: 0 0 24px 0; font-size: 16px; color: #111827;">
      Hello ${data.userName || "User"},
    </p>
    
    <p style="margin: 0 0 24px 0; font-size: 16px; color: #111827;">
      This is a reminder that you have a meeting scheduled in ${reminderTime}:
    </p>
    
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <tr>
        <td style="padding: 20px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">
          <strong style="font-size: 18px; color: #111827;">${data.eventTitle || "Consultation"}</strong>
        </td>
      </tr>
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Date:</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${data.date || "Not specified"}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Time:</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${data.time || "Not specified"}</td>
            </tr>
            ${data.meetingLink ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Meeting:</td>
              <td style="padding: 8px 0;">
                <a href="${data.meetingLink}" style="color: #404040; text-decoration: underline; font-size: 14px;">Join Meeting</a>
              </td>
            </tr>
            ` : ''}
          </table>
        </td>
      </tr>
    </table>
    
    ${data.meetingLink ? getButton(data.meetingLink, "Join Meeting", true) : ''}
    
    <p style="margin: 24px 0 0 0; font-size: 14px; color: #6b7280;">
      See you soon!
    </p>
  `;
  
  return getBaseEmailTemplate(content, "Meeting Reminder - Daiyet");
}

/**
 * Session Request Email Template
 */
export function getSessionRequestTemplate(data: EmailTemplateData): string {
  const content = `
    <p style="margin: 0 0 24px 0; font-size: 16px; color: #111827;">
      Hello ${data.userName || "User"},
    </p>
    
    <p style="margin: 0 0 24px 0; font-size: 16px; color: #111827;">
      You have a new ${data.requestType || "session"} request from your dietitian.
    </p>
    
    ${data.message ? `
    <div style="margin: 24px 0; padding: 20px; background-color: #f9fafb; border-left: 4px solid #404040; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; color: #111827; line-height: 20px;">
        ${data.message}
      </p>
    </div>
    ` : ''}
    
    ${data.actionRequired && data.actionLink ? getButton(data.actionLink, "View Request", true) : ''}
    
    <p style="margin: 24px 0 0 0; font-size: 14px; color: #6b7280;">
      Please review and respond to this request at your earliest convenience.
    </p>
  `;
  
  return getBaseEmailTemplate(content, "New Session Request - Daiyet");
}

/**
 * Meal Plan Sent Email Template
 */
export function getMealPlanSentTemplate(data: EmailTemplateData): string {
  const content = `
    <p style="margin: 0 0 24px 0; font-size: 16px; color: #111827;">
      Hello ${data.userName || "User"},
    </p>
    
    <p style="margin: 0 0 24px 0; font-size: 16px; color: #111827;">
      Your personalized meal plan has been prepared and is ready for you!
    </p>
    
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <tr>
        <td style="padding: 20px;">
          <strong style="font-size: 16px; color: #111827;">${data.mealPlanType || "Custom Meal Plan"}</strong>
          ${data.message ? `
          <p style="margin: 12px 0 0 0; font-size: 14px; color: #6b7280; line-height: 20px;">
            ${data.message}
          </p>
          ` : ''}
        </td>
      </tr>
    </table>
    
    ${data.actionLink ? getButton(data.actionLink, "View Meal Plan", true) : ''}
    
    <p style="margin: 24px 0 0 0; font-size: 14px; color: #6b7280;">
      Your meal plan is available in your dashboard for download and reference.
    </p>
  `;
  
  return getBaseEmailTemplate(content, "Meal Plan Ready - Daiyet");
}

/**
 * Booking Rescheduled Email Template
 */
export function getBookingRescheduledTemplate(data: EmailTemplateData): string {
  const content = `
    <p style="margin: 0 0 24px 0; font-size: 16px; color: #111827;">
      Hello ${data.userName || "User"},
    </p>
    
    <p style="margin: 0 0 24px 0; font-size: 16px; color: #111827;">
      Your booking has been rescheduled. Here are the new details:
    </p>
    
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <tr>
        <td style="padding: 20px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">
          <strong style="font-size: 18px; color: #111827;">${data.eventTitle || "Consultation"}</strong>
        </td>
      </tr>
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">New Date:</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${data.date || "Not specified"}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">New Time:</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${data.time || "Not specified"}</td>
            </tr>
            ${data.meetingLink ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Meeting:</td>
              <td style="padding: 8px 0;">
                <a href="${data.meetingLink}" style="color: #404040; text-decoration: underline; font-size: 14px;">Join Meeting</a>
              </td>
            </tr>
            ` : ''}
          </table>
        </td>
      </tr>
    </table>
    
    ${data.rescheduleReason ? `
    <div style="margin: 24px 0; padding: 16px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; color: #92400e;">
        <strong>Note:</strong> ${data.rescheduleReason}
      </p>
    </div>
    ` : ''}
    
    ${data.meetingLink ? getButton(data.meetingLink, "Join Meeting", true) : ''}
    
    <p style="margin: 24px 0 0 0; font-size: 14px; color: #6b7280;">
      We apologize for any inconvenience. We look forward to seeing you at the new time!
    </p>
  `;
  
  return getBaseEmailTemplate(content, "Booking Rescheduled - Daiyet");
}

/**
 * Booking Cancelled Email Template
 */
export function getBookingCancelledTemplate(data: EmailTemplateData): string {
  const content = `
    <p style="margin: 0 0 24px 0; font-size: 16px; color: #111827;">
      Hello ${data.userName || "User"},
    </p>
    
    <p style="margin: 0 0 24px 0; font-size: 16px; color: #111827;">
      Your booking has been cancelled.
    </p>
    
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <tr>
        <td style="padding: 20px;">
          <strong style="font-size: 16px; color: #111827;">${data.eventTitle || "Consultation"}</strong>
          <p style="margin: 8px 0 0 0; font-size: 14px; color: #6b7280;">
            ${data.date || ""} at ${data.time || ""}
          </p>
        </td>
      </tr>
    </table>
    
    ${data.cancellationReason ? `
    <div style="margin: 24px 0; padding: 16px; background-color: #fee2e2; border-left: 4px solid #ef4444; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; color: #991b1b;">
        <strong>Reason:</strong> ${data.cancellationReason}
      </p>
    </div>
    ` : ''}
    
    <p style="margin: 24px 0 0 0; font-size: 14px; color: #6b7280;">
      If you have any questions or would like to reschedule, please contact us or book a new appointment.
    </p>
  `;
  
  return getBaseEmailTemplate(content, "Booking Cancelled - Daiyet");
}

/**
 * Payment Confirmation Email Template
 */
export function getPaymentConfirmationTemplate(data: EmailTemplateData): string {
  const content = `
    <p style="margin: 0 0 24px 0; font-size: 16px; color: #111827;">
      Hello ${data.userName || "User"},
    </p>
    
    <p style="margin: 0 0 24px 0; font-size: 16px; color: #111827;">
      Your payment has been successfully processed!
    </p>
    
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <tr>
        <td style="padding: 20px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">
          <strong style="font-size: 18px; color: #111827;">Payment Details</strong>
        </td>
      </tr>
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount:</td>
              <td style="padding: 8px 0; color: #111827; font-size: 16px; font-weight: 600;">
                ${data.currency || "NGN"} ${data.amount || "0.00"}
              </td>
            </tr>
            ${data.eventTitle ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">For:</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${data.eventTitle}</td>
            </tr>
            ` : ''}
            ${data.transactionId ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Transaction ID:</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${data.transactionId}</td>
            </tr>
            ` : ''}
          </table>
        </td>
      </tr>
    </table>
    
    <p style="margin: 24px 0 0 0; font-size: 14px; color: #6b7280;">
      Thank you for your payment. A receipt has been sent to your email.
    </p>
  `;
  
  return getBaseEmailTemplate(content, "Payment Confirmed - Daiyet");
}

/**
 * Generate plain text version of email (fallback)
 */
export function getPlainTextTemplate(template: string, data: EmailTemplateData): string {
  switch (template) {
    case "booking_confirmation":
      return `
Booking Confirmed!

Hello ${data.userName || "User"},

Your booking has been confirmed:
- Event: ${data.eventTitle || "Consultation"}
- Date: ${data.date || ""}
- Time: ${data.time || ""}
${data.meetingLink ? `- Meeting Link: ${data.meetingLink}` : ""}

See you soon!
Daiyet Team
      `.trim();
    
    case "meeting_reminder":
      return `
Meeting Reminder

Hello ${data.userName || "User"},

This is a reminder that you have a meeting scheduled:
- Event: ${data.eventTitle || "Consultation"}
- Date: ${data.date || ""}
- Time: ${data.time || ""}
${data.meetingLink ? `- Meeting Link: ${data.meetingLink}` : ""}

See you soon!
Daiyet Team
      `.trim();
    
    case "session_request":
      return `
New Session Request

Hello ${data.userName || "User"},

You have a new ${data.requestType || "session"} request from your dietitian.

${data.message || ""}

${data.actionLink ? `Action required: ${data.actionLink}` : ""}

Daiyet Team
      `.trim();
    
    case "meal_plan_sent":
      return `
Meal Plan Ready

Hello ${data.userName || "User"},

Your personalized meal plan (${data.mealPlanType || "Custom Meal Plan"}) has been prepared and is ready for you!

${data.message || ""}

${data.actionLink ? `View Meal Plan: ${data.actionLink}` : ""}

Your meal plan is available in your dashboard.

Daiyet Team
      `.trim();
    
    case "booking_rescheduled":
      return `
Booking Rescheduled

Hello ${data.userName || "User"},

Your booking has been rescheduled. New details:
- Event: ${data.eventTitle || "Consultation"}
- New Date: ${data.date || ""}
- New Time: ${data.time || ""}
${data.meetingLink ? `- Meeting Link: ${data.meetingLink}` : ""}
${data.rescheduleReason ? `\nReason: ${data.rescheduleReason}` : ""}

We apologize for any inconvenience.

Daiyet Team
      `.trim();
    
    case "booking_cancelled":
      return `
Booking Cancelled

Hello ${data.userName || "User"},

Your booking has been cancelled:
- Event: ${data.eventTitle || "Consultation"}
- Date: ${data.date || ""}
- Time: ${data.time || ""}
${data.cancellationReason ? `\nReason: ${data.cancellationReason}` : ""}

If you have any questions, please contact us.

Daiyet Team
      `.trim();
    
    case "payment_confirmation":
      return `
Payment Confirmed

Hello ${data.userName || "User"},

Your payment has been successfully processed!

Amount: ${data.currency || "NGN"} ${data.amount || "0.00"}
${data.eventTitle ? `For: ${data.eventTitle}` : ""}
${data.transactionId ? `Transaction ID: ${data.transactionId}` : ""}

Thank you for your payment. A receipt has been sent to your email.

Daiyet Team
      `.trim();
    
    default:
      return data.message || "You have a new message from Daiyet.";
  }
}

/**
 * Main template function that returns both HTML and text
 */
export function getEmailTemplate(
  template: string,
  data: EmailTemplateData,
  options: { htmlOnly?: boolean; textOnly?: boolean; isDietitian?: boolean } = {}
): { html?: string; text?: string } {
  const result: { html?: string; text?: string } = {};
  
  if (!options.textOnly) {
    switch (template) {
      case "booking_confirmation":
        result.html = getBookingConfirmationTemplate(data, options.isDietitian);
        break;
      case "meeting_reminder":
        result.html = getMeetingReminderTemplate(data);
        break;
      case "session_request":
        result.html = getSessionRequestTemplate(data);
        break;
      case "meal_plan_sent":
        result.html = getMealPlanSentTemplate(data);
        break;
      case "booking_rescheduled":
        result.html = getBookingRescheduledTemplate(data);
        break;
      case "booking_cancelled":
        result.html = getBookingCancelledTemplate(data);
        break;
      case "payment_confirmation":
        result.html = getPaymentConfirmationTemplate(data);
        break;
      default:
        result.html = getBaseEmailTemplate(
          `<p style="margin: 0; font-size: 16px; color: #111827;">${data.message || "You have a new message from Daiyet."}</p>`,
          "Message from Daiyet"
        );
    }
  }
  
  if (!options.htmlOnly) {
    result.text = getPlainTextTemplate(template, data);
  }
  
  return result;
}

