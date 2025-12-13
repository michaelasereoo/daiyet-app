import { createAdminClientServer } from "@/lib/supabase/server";
import { sendBrevoEmail, BrevoEmailOptions } from "./brevo";
import { getEmailTemplate } from "./templates";

interface EmailPayload {
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
  from?: string;
  fromName?: string;
  replyTo?: {
    email: string;
    name?: string;
  };
  tags?: string[];
  isDietitian?: boolean;
}

export class EmailQueue {
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  async enqueue(email: EmailPayload, options: { delay?: number } = {}) {
    const scheduledFor = options.delay 
      ? new Date(Date.now() + options.delay).toISOString()
      : new Date().toISOString();

    try {
      const supabaseAdmin = createAdminClientServer();

      const { data, error } = await supabaseAdmin
        .from("email_queue")
        .insert({
          type: "email",
          payload: email,
          scheduled_for: scheduledFor,
          status: "pending",
          attempts: 0,
          max_attempts: 3,
        })
        .select()
        .single();

      if (error) {
        console.error("Error enqueueing email:", error);
        throw new Error(`Failed to enqueue email: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error("Error in enqueue:", error);
      throw error;
    }
  }

  async sendEmailWithRetry(email: EmailPayload): Promise<{ success: boolean; error?: string }> {
    const MAX_RETRIES = 3;
    const BASE_DELAY = 1000; // 1 second
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`Attempt ${attempt} to send email to ${email.to} (template: ${email.template})`);
        
        // Generate HTML and text templates
        const templateResult = getEmailTemplate(email.template, email.data, {
          isDietitian: email.isDietitian || false,
        });

        // Prepare Brevo email options
        const brevoOptions: BrevoEmailOptions = {
          to: email.to,
          subject: email.subject,
          htmlContent: templateResult.html,
          textContent: templateResult.text,
          from: email.from,
          fromName: email.fromName,
          replyTo: email.replyTo,
          tags: email.tags || [email.template],
        };

        const result = await sendBrevoEmail(brevoOptions);

        if (result.success) {
          console.log(`Email sent successfully to ${email.to} (messageId: ${result.messageId || "N/A"})`);
          return { success: true };
        }

        // Don't retry on permanent errors (4xx except 429)
        if (result.error) {
          const isPermanentError = result.error.includes("4") && !result.error.includes("429");
          if (isPermanentError) {
            console.error(`Permanent error, not retrying: ${result.error}`);
            return result;
          }
        }

        // Exponential backoff with jitter
        if (attempt < MAX_RETRIES) {
          const delay = BASE_DELAY * Math.pow(2, attempt - 1);
          const jitter = delay * 0.2 * Math.random();
          console.log(`Retrying in ${Math.round(delay + jitter)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay + jitter));
        }
      } catch (error) {
        console.error(`Email attempt ${attempt} exception:`, error);
        
        if (attempt === MAX_RETRIES) {
          return { 
            success: false, 
            error: error instanceof Error ? error.message : "Unknown error" 
          };
        }
      }
    }

    return { success: false, error: "Max retries exceeded" };
  }


  startProcessing(intervalMs = 30000) {
    if (this.processingInterval) return;

    this.processingInterval = setInterval(async () => {
      if (this.isProcessing) return;
      
      this.isProcessing = true;
      try {
        await this.processQueue();
      } catch (error) {
        console.error("Queue processing error:", error);
      } finally {
        this.isProcessing = false;
      }
    }, intervalMs);
  }

  private async processQueue() {
    const supabaseAdmin = createAdminClientServer();

    // Get pending emails (batch of 20)
    const { data: emails, error } = await supabaseAdmin
      .from("email_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(20);

    if (error) throw error;
    if (!emails || emails.length === 0) return;

    // Process in parallel with concurrency limit
    const CONCURRENCY = 5;
    for (let i = 0; i < emails.length; i += CONCURRENCY) {
      const batch = emails.slice(i, i + CONCURRENCY);
      
      await Promise.allSettled(
        batch.map(async (email) => {
          // Mark as processing
          await supabaseAdmin
            .from("email_queue")
            .update({
              status: "processing",
              attempts: email.attempts + 1,
              last_attempt_at: new Date().toISOString(),
            })
            .eq("id", email.id);

          // Send email
          const result = await this.sendEmailWithRetry(email.payload);

          if (result.success) {
            // Mark as completed
            await supabaseAdmin
              .from("email_queue")
              .update({
                status: "completed",
                completed_at: new Date().toISOString(),
              })
              .eq("id", email.id);
          } else if (email.attempts + 1 >= email.max_attempts) {
            // Move to dead letter queue
            await supabaseAdmin
              .from("email_dead_letter_queue")
              .insert({
                original_id: email.id,
                payload: email.payload,
                error: result.error,
                attempts: email.attempts + 1,
              });
            
            await supabaseAdmin
              .from("email_queue")
              .update({ status: "failed" })
              .eq("id", email.id);
          } else {
            // Schedule retry with exponential backoff
            const retryDelay = Math.min(3600000, 60000 * Math.pow(2, email.attempts)); // Max 1 hour
            await supabaseAdmin
              .from("email_queue")
              .update({
                status: "pending",
                scheduled_for: new Date(Date.now() + retryDelay).toISOString(),
              })
              .eq("id", email.id);
          }
        })
      );
    }
  }

  stopProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  // Expose processQueue for API routes (public method)
  async processQueuePublic() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    try {
      // Call the private processQueue method
      const supabaseAdmin = createAdminClientServer();

      // Get pending emails (batch of 20)
      const { data: emails, error } = await supabaseAdmin
        .from("email_queue")
        .select("*")
        .eq("status", "pending")
        .lte("scheduled_for", new Date().toISOString())
        .order("created_at", { ascending: true })
        .limit(20);

      if (error) throw error;
      if (!emails || emails.length === 0) return;

      // Process in parallel with concurrency limit
      const CONCURRENCY = 5;
      for (let i = 0; i < emails.length; i += CONCURRENCY) {
        const batch = emails.slice(i, i + CONCURRENCY);
        
        await Promise.allSettled(
          batch.map(async (email) => {
            // Mark as processing
            await supabaseAdmin
              .from("email_queue")
              .update({
                status: "processing",
                attempts: email.attempts + 1,
                last_attempt_at: new Date().toISOString(),
              })
              .eq("id", email.id);

            // Send email
            const result = await this.sendEmailWithRetry(email.payload);

            if (result.success) {
              // Mark as completed
              await supabaseAdmin
                .from("email_queue")
                .update({
                  status: "completed",
                  completed_at: new Date().toISOString(),
                })
                .eq("id", email.id);
            } else if (email.attempts + 1 >= email.max_attempts) {
              // Move to dead letter queue
              await supabaseAdmin
                .from("email_dead_letter_queue")
                .insert({
                  original_id: email.id,
                  payload: email.payload,
                  error: result.error,
                  attempts: email.attempts + 1,
                });
              
              await supabaseAdmin
                .from("email_queue")
                .update({ status: "failed" })
                .eq("id", email.id);
            } else {
              // Schedule retry with exponential backoff
              const retryDelay = Math.min(3600000, 60000 * Math.pow(2, email.attempts)); // Max 1 hour
              await supabaseAdmin
                .from("email_queue")
                .update({
                  status: "pending",
                  scheduled_for: new Date(Date.now() + retryDelay).toISOString(),
                })
                .eq("id", email.id);
            }
          })
        );
      }
    } catch (error) {
      console.error("Queue processing error:", error);
    } finally {
      this.isProcessing = false;
    }
  }
}

// Singleton instance
export const emailQueue = new EmailQueue();

// Start processing in production
if (process.env.NODE_ENV === "production") {
  emailQueue.startProcessing();
}

