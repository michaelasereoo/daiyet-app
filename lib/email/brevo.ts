/**
 * Brevo (formerly Sendinblue) Email Client
 * Professional email sending using Brevo API with HTML templates, attachments, and reply-to support
 */

export interface BrevoEmailOptions {
  to: string | string[];
  subject: string;
  htmlContent?: string;
  textContent?: string;
  from?: string;
  fromName?: string;
  replyTo?: {
    email: string;
    name?: string;
  };
  attachments?: Array<{
    name: string;
    content: string; // Base64 encoded
  }>;
  tags?: string[];
  params?: Record<string, any>;
}

export interface BrevoEmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendBrevoEmail(options: BrevoEmailOptions): Promise<BrevoEmailResponse> {
  const apiKey = process.env.BREVO_API_KEY;
  const defaultFrom = process.env.BREVO_SENDER_EMAIL || "noreply@daiyet.co";
  const defaultFromName = process.env.BREVO_SENDER_NAME || "Daiyet";

  if (!apiKey) {
    console.error("BREVO_API_KEY is not configured");
    return { success: false, error: "Email service not configured" };
  }

  // Validate required fields
  if (!options.to || !options.subject) {
    return { success: false, error: "Missing required fields: to and subject are required" };
  }

  // Ensure we have at least HTML or text content
  if (!options.htmlContent && !options.textContent) {
    return { success: false, error: "Either htmlContent or textContent must be provided" };
  }

  try {
    // Normalize recipients to array format
    const recipients = Array.isArray(options.to)
      ? options.to.map(email => ({ email }))
      : [{ email: options.to }];

    const emailPayload: any = {
      sender: {
        name: options.fromName || defaultFromName,
        email: options.from || defaultFrom,
      },
      to: recipients,
      subject: options.subject,
      htmlContent: options.htmlContent || undefined,
      textContent: options.textContent || undefined,
    };

    // Add reply-to if provided
    if (options.replyTo) {
      emailPayload.replyTo = {
        email: options.replyTo.email,
        name: options.replyTo.name,
      };
    }

    // Add attachments if provided
    if (options.attachments && options.attachments.length > 0) {
      emailPayload.attachment = options.attachments;
    }

    // Add tags for analytics/tracking
    if (options.tags && options.tags.length > 0) {
      emailPayload.tags = options.tags;
    }

    // Add params for template variables (if using Brevo templates)
    if (options.params) {
      emailPayload.params = options.params;
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Brevo API error: ${response.status}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      console.error("Brevo API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }

    const result = await response.json();
    
    // Log success (without sensitive data)
    console.log("Email sent successfully via Brevo:", {
      messageId: result.messageId,
      to: Array.isArray(options.to) ? `${options.to.length} recipients` : options.to,
      subject: options.subject,
    });

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending email via Brevo:", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

