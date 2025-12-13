// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Define types for your jobs
interface JobPayload {
  booking_id?: string;
  session_id?: string;
  user_id?: string;
  dietitian_id?: string;
  reminder_minutes?: number;
  [key: string]: any;
}

interface ScheduledJob {
  id: string;
  type: 'meeting_reminder' | 'post_session_feedback' | 'availability_check' | string;
  payload: JobPayload;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  scheduled_for: string;
  attempts: number;
  max_attempts: number;
  last_attempt_at?: string;
  error?: string;
  created_at: string;
  updated_at: string;
}

interface EmailPayload {
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
}

console.info('🚀 Background Worker Started');

// ============ BREVO EMAIL FUNCTIONS ============

async function sendBrevoEmail(email: EmailPayload): Promise<{ success: boolean; error?: string }> {
  const apiKey = Deno.env.get('BREVO_API_KEY');
  const defaultFrom = Deno.env.get('BREVO_SENDER_EMAIL') || 'noreply@daiyet.co';
  const defaultFromName = Deno.env.get('BREVO_SENDER_NAME') || 'Daiyet';

  if (!apiKey) {
    return { success: false, error: 'BREVO_API_KEY not configured' };
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: defaultFromName,
          email: defaultFrom,
        },
        to: [{ email: email.to }],
        subject: email.subject,
        textContent: getEmailTemplate(email.template, email.data),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Brevo API error: ${response.status} ${errorText}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

function getEmailTemplate(template: string, data: Record<string, any>): string {
  switch (template) {
    case 'meeting_reminder':
      return `
Meeting Reminder

Hello ${data.userName || 'User'},

This is a reminder that you have a meeting scheduled:
- Event: ${data.eventTitle || 'Consultation'}
- Date: ${data.date || ''}
- Time: ${data.time || ''}
- Meeting Link: ${data.meetingLink || ''}

See you soon!
Daiyet Team
      `.trim();
    
    case 'session_feedback':
      return `
How was your session?

Hello ${data.userName || 'User'},

Thank you for your recent session. We'd love to hear your feedback:

${data.feedbackLink || ''}

Thank you!
Daiyet Team
      `.trim();
    
    case 'booking_confirmation':
      return `
Booking Confirmed!

Hello ${data.userName || 'User'},

Your booking has been confirmed:
- Event: ${data.eventTitle || 'Consultation'}
- Date: ${data.date || ''}
- Time: ${data.time || ''}
- Meeting Link: ${data.meetingLink || ''}

See you soon!
Daiyet Team
      `.trim();
    
    default:
      return data.message || 'You have a new message from Daiyet.';
  }
}

// ============ JOB HANDLERS ============

async function handleMeetingReminder(job: ScheduledJob, supabase: any) {
  console.info(`📅 Processing meeting reminder for job ${job.id}`);
  
  const { booking_id, user_id, dietitian_id, reminder_minutes } = job.payload;
  
  if (!booking_id) {
    throw new Error('Missing required field: booking_id');
  }

  // Fetch booking details
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select(`
      *,
      user:users!bookings_user_id_fkey(id, name, email),
      dietitian:users!bookings_dietitian_id_fkey(id, name, email),
      event_types(title)
    `)
    .eq('id', booking_id)
    .single();

  if (bookingError || !booking) {
    throw new Error(`Booking not found: ${bookingError?.message || ''}`);
  }

  const startDate = new Date(booking.start_time);
  const dateStr = startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const reminderText = reminder_minutes === 1440 ? '24 hours' : reminder_minutes === 60 ? '1 hour' : `${reminder_minutes} minutes`;

  // Send reminder to user
  if (booking.user?.email) {
    const result = await sendBrevoEmail({
      to: booking.user.email,
      subject: `Meeting Reminder: Your session starts in ${reminderText}`,
      template: 'meeting_reminder',
      data: {
        userName: booking.user.name || 'User',
        eventTitle: booking.event_types?.title || booking.title || 'Consultation',
        date: dateStr,
        time: timeStr,
        meetingLink: booking.meeting_link || '',
      },
    });

    if (result.success) {
      console.info(`✅ Reminder email sent to user: ${booking.user.email}`);
    } else {
      console.warn(`⚠️ Failed to send reminder to user: ${result.error}`);
    }
  }

  // Send reminder to dietitian
  if (booking.dietitian?.email) {
    const result = await sendBrevoEmail({
      to: booking.dietitian.email,
      subject: `Meeting Reminder: Session with ${booking.user?.name || 'Client'} in ${reminderText}`,
      template: 'meeting_reminder',
      data: {
        userName: booking.dietitian.name || 'Dietitian',
        eventTitle: booking.event_types?.title || booking.title || 'Consultation',
        date: dateStr,
        time: timeStr,
        meetingLink: booking.meeting_link || '',
      },
    });

    if (result.success) {
      console.info(`✅ Reminder email sent to dietitian: ${booking.dietitian.email}`);
    } else {
      console.warn(`⚠️ Failed to send reminder to dietitian: ${result.error}`);
    }
  }

  return {
    booking_id,
    user_id,
    dietitian_id,
    reminder_minutes,
    sent_at: new Date().toISOString(),
  };
}

async function handlePostSessionFeedback(job: ScheduledJob, supabase: any) {
  console.info(`📝 Processing post-session feedback for job ${job.id}`);
  
  const { booking_id, user_id } = job.payload;
  
  if (!booking_id) {
    throw new Error('Missing required field: booking_id');
  }

  // Fetch booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select(`
      *,
      user:users!bookings_user_id_fkey(id, name, email)
    `)
    .eq('id', booking_id)
    .single();

  if (bookingError || !booking) {
    throw new Error(`Booking not found: ${bookingError?.message || ''}`);
  }

  const siteUrl = Deno.env.get('NEXT_PUBLIC_SITE_URL') || 'http://localhost:3000';
  const feedbackLink = `${siteUrl}/feedback/${booking_id}`;

  // Send feedback request
  if (booking.user?.email) {
    const result = await sendBrevoEmail({
      to: booking.user.email,
      subject: 'How was your session?',
      template: 'session_feedback',
      data: {
        userName: booking.user.name || 'User',
        feedbackLink,
      },
    });

    if (result.success) {
      console.info(`✅ Feedback email sent to: ${booking.user.email}`);
    } else {
      console.warn(`⚠️ Failed to send feedback email: ${result.error}`);
    }
  }

  return {
    booking_id,
    user_id,
    feedback_requested: true,
    sent_at: new Date().toISOString(),
  };
}

async function handleTestJob(job: ScheduledJob) {
  console.info(`🧪 Processing test job ${job.id}`);
  
  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.info(`✅ Test job ${job.id} completed with payload:`, job.payload);
  
  return {
    test: 'success',
    payload: job.payload,
    processed_at: new Date().toISOString(),
  };
}

// ============ MAIN HANDLER ============

Deno.serve(async (req: Request) => {
  console.info('📞 Request received:', new Date().toISOString());
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  // Optional: Add authentication for manual triggers
  if (req.method === 'POST') {
    try {
      const authHeader = req.headers.get('authorization');
      const cronSecret = Deno.env.get('CRON_SECRET') || 'daiyet-background-worker-2025-secret-abc123xyz789';
      
      if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        console.warn('⚠️ Unauthorized access attempt');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (error) {
      console.info('No auth configured, proceeding...');
    }
  }

  try {
    // 1. Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 2. Process email queue first (batch of 20)
    console.info('📧 Processing email queue...');
    const { data: emails, error: emailError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(20);

    let emailsProcessed = 0;
    if (!emailError && emails && emails.length > 0) {
      console.info(`📧 Found ${emails.length} emails to process`);
      
      await Promise.allSettled(
        emails.map(async (email: any) => {
          try {
            // Mark as processing
            await supabase
              .from('email_queue')
              .update({
                status: 'processing',
                attempts: email.attempts + 1,
                last_attempt_at: new Date().toISOString(),
              })
              .eq('id', email.id);

            // Send email via Brevo
            const result = await sendBrevoEmail(email.payload);

            if (result.success) {
              await supabase
                .from('email_queue')
                .update({
                  status: 'completed',
                  completed_at: new Date().toISOString(),
                })
                .eq('id', email.id);
              emailsProcessed++;
            } else if (email.attempts + 1 >= email.max_attempts) {
              // Move to dead letter queue
              await supabase
                .from('email_dead_letter_queue')
                .insert({
                  original_id: email.id,
                  payload: email.payload,
                  error: result.error,
                  attempts: email.attempts + 1,
                });
              
              await supabase
                .from('email_queue')
                .update({ status: 'failed' })
                .eq('id', email.id);
            } else {
              // Schedule retry
              const retryDelay = Math.min(3600000, 60000 * Math.pow(2, email.attempts));
              await supabase
                .from('email_queue')
                .update({
                  status: 'pending',
                  scheduled_for: new Date(Date.now() + retryDelay).toISOString(),
                })
                .eq('id', email.id);
            }
          } catch (err) {
            console.error('Error processing email:', err);
          }
        })
      );
    }

    // 3. Get pending scheduled jobs
    const now = new Date().toISOString();
    console.info(`⏰ Checking for scheduled jobs due before: ${now}`);
    
    const { data: jobs, error: fetchError } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error('❌ Error fetching jobs:', fetchError);
      throw fetchError;
    }

    console.info(`📋 Found ${jobs?.length || 0} scheduled jobs to process`);

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending jobs to process',
          processed: 0,
          emailsProcessed,
          timestamp: now,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. Process each job
    const results = await Promise.allSettled(
      jobs.map(async (job: ScheduledJob) => {
        const jobId = job.id;
        const jobType = job.type;
        
        console.info(`🔄 Processing job ${jobId} (${jobType})`);
        
        try {
          // Mark as processing
          const { error: updateError } = await supabase
            .from('scheduled_jobs')
            .update({
              status: 'processing',
              attempts: job.attempts + 1,
              last_attempt_at: now,
              updated_at: now,
            })
            .eq('id', jobId);

          if (updateError) {
            throw new Error(`Failed to update job status: ${updateError.message}`);
          }

          // Process based on job type
          let result;
          switch (jobType) {
            case 'meeting_reminder':
              result = await handleMeetingReminder(job, supabase);
              break;
            case 'post_session_feedback':
              result = await handlePostSessionFeedback(job, supabase);
              break;
            case 'test':
              result = await handleTestJob(job);
              break;
            default:
              throw new Error(`Unknown job type: ${jobType}`);
          }

          // Mark as completed
          await supabase
            .from('scheduled_jobs')
            .update({
              status: 'completed',
              updated_at: now,
            })
            .eq('id', jobId);

          console.info(`✅ Job ${jobId} completed successfully`);
          return {
            jobId,
            type: jobType,
            success: true,
            result,
          };

        } catch (error) {
          console.error(`❌ Job ${jobId} failed:`, error);
          
          const attempts = job.attempts + 1;
          const maxAttempts = job.max_attempts || 3;
          const newStatus = attempts >= maxAttempts ? 'failed' : 'pending';
          
          // Calculate retry delay (exponential backoff: 5min, 10min, 20min...)
          const retryDelayMs = 5 * 60 * 1000 * Math.pow(2, attempts - 1);
          const nextAttempt = new Date(Date.now() + retryDelayMs).toISOString();
          
          await supabase
            .from('scheduled_jobs')
            .update({
              status: newStatus,
              error: error instanceof Error ? error.message : String(error),
              attempts: attempts,
              updated_at: now,
              ...(newStatus === 'pending' ? { scheduled_for: nextAttempt } : {}),
            })
            .eq('id', jobId);

          return {
            jobId,
            type: jobType,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            nextAttempt: newStatus === 'pending' ? nextAttempt : null,
          };
        }
      })
    );

    // 5. Compile results
    const successful = results.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled');
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    
    const successfulJobs = successful.map(r => r.value);
    const failedJobs = failed.map(r => r.reason);

    console.info(`📊 Processed ${jobs.length} jobs: ${successfulJobs.length} successful, ${failedJobs.length} failed`);

    // 6. Return summary
    return new Response(
      JSON.stringify({
        success: true,
        processed: jobs.length,
        successful: successfulJobs.length,
        failed: failedJobs.length,
        emailsProcessed,
        details: {
          successful: successfulJobs,
          failed: failedJobs.map(f => ({
            error: f instanceof Error ? f.message : String(f),
          })),
        },
        timestamp: now,
      }),
      {
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );

  } catch (error) {
    console.error('💥 Background worker fatal error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
