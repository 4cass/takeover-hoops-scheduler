import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SessionNotificationRequest {
  sessionId: string;
  date: string;
  startTime: string;
  endTime: string;
  branchName: string;
  packageType: string | null;
  coachEmails: string[];
  studentEmails: string[];
  coachNames: string[];
  studentNames: string[];
}

const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch {
    return dateString;
  }
};

const formatTime = (timeString: string) => {
  try {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  } catch {
    return timeString;
  }
};

// SMTP email sending function using Gmail SMTP
const sendEmailViaSMTP = async (
  to: string,
  subject: string,
  htmlBody: string,
  smtpHost: string,
  smtpPort: number,
  smtpUser: string,
  smtpPass: string,
  smtpFrom: string
) => {
  // Convert HTML to plain text for email
  const textBody = htmlBody.replace(/<[^>]*>/g, '').replace(/\n\s*\n/g, '\n').trim();
  
  try {
    // Create SMTP client
    const client = new SmtpClient();
    
    // Connect to SMTP server
    await client.connect({
      hostname: smtpHost,
      port: smtpPort,
      username: smtpUser,
      password: smtpPass,
    });
    
    // Send email
    await client.send({
      from: smtpFrom,
      to: [to],
      subject: subject,
      content: htmlBody,
      html: htmlBody,
      text: textBody,
    });
    
    // Close connection
    await client.close();
    
    console.log(`Email sent via SMTP to ${to}`);
    return { success: true, method: 'smtp' };
  } catch (error: any) {
    console.error('SMTP error:', error);
    throw error;
  }
};

const sendEmail = async (
  to: string,
  subject: string,
  htmlBody: string,
  supabaseAdmin: any
) => {
  // Option 1: Use EmailJS with Gmail (Recommended - easiest and most reliable)
  const EMAILJS_SERVICE_ID = Deno.env.get("EMAILJS_SERVICE_ID");
  const EMAILJS_TEMPLATE_ID = Deno.env.get("EMAILJS_TEMPLATE_ID");
  const EMAILJS_PUBLIC_KEY = Deno.env.get("EMAILJS_PUBLIC_KEY");
  
  if (EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY) {
    try {
      // Convert HTML to plain text for email
      const textBody = htmlBody.replace(/<[^>]*>/g, '').replace(/\n\s*\n/g, '\n').trim();
      
      const emailjsResponse = await fetch(`https://api.emailjs.com/api/v1.0/email/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          service_id: EMAILJS_SERVICE_ID,
          template_id: EMAILJS_TEMPLATE_ID,
          user_id: EMAILJS_PUBLIC_KEY,
          template_params: {
            to_email: to,
            subject: subject,
            message_html: htmlBody,
            message_text: textBody,
          },
        }),
      });

      if (!emailjsResponse.ok) {
        const errorText = await emailjsResponse.text();
        throw new Error(`EmailJS API error: ${errorText}`);
      }

      console.log(`Email sent via EmailJS (Gmail) to ${to}`);
      return { success: true, method: 'emailjs' };
    } catch (error: any) {
      console.error('Error sending email via EmailJS:', error);
      // Fallback to direct SMTP
    }
  }

  // Option 2: Fallback to direct Gmail SMTP (if EmailJS not configured)
  const SMTP_HOST = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
  const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "587");
  const SMTP_USER = Deno.env.get("SMTP_USER");
  const SMTP_PASS = Deno.env.get("SMTP_PASS");
  const SMTP_FROM = Deno.env.get("SMTP_FROM") || SMTP_USER;

  if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
    try {
      const result = await sendEmailViaSMTP(
        to,
        subject,
        htmlBody,
        SMTP_HOST,
        SMTP_PORT,
        SMTP_USER,
        SMTP_PASS,
        SMTP_FROM || SMTP_USER
      );
      return result;
    } catch (error: any) {
      console.error('Error sending email via SMTP:', error);
      // Fallback to logging
    }
  }
  
  // Fallback: Log for development/testing
  console.log('='.repeat(50));
  console.log('EMAIL NOTIFICATION (Development Mode)');
  console.log('='.repeat(50));
  console.log('To:', to);
  console.log('Subject:', subject);
  console.log('HTML Body:', htmlBody);
  console.log('='.repeat(50));
  
  return { success: true, method: 'logged' };
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        }
      }
    );

    const {
      sessionId,
      date,
      startTime,
      endTime,
      branchName,
      packageType,
      coachEmails,
      studentEmails,
      coachNames,
      studentNames,
    }: SessionNotificationRequest = await req.json();

    const formattedDate = formatDate(date);
    const formattedStartTime = formatTime(startTime);
    const formattedEndTime = formatTime(endTime);

    // Email template for coaches
    const coachEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #242833; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #79e58f; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Training Session Scheduled</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>You have been assigned to a new training session. Here are the details:</p>
            
            <div class="info-box">
              <strong>Date:</strong> ${formattedDate}<br>
              <strong>Time:</strong> ${formattedStartTime} - ${formattedEndTime}<br>
              <strong>Branch:</strong> ${branchName}<br>
              <strong>Package Type:</strong> ${packageType || 'Not specified'}<br>
              <strong>Participants:</strong> ${studentNames.length} student${studentNames.length !== 1 ? 's' : ''}
            </div>

            <p>Please make sure to arrive on time and be prepared for the session.</p>
            
            <div class="footer">
              <p>This is an automated notification from Takeover Hoops Scheduler.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Email template for students
    const studentEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #242833; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #79e58f; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Training Session Scheduled</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>You have been scheduled for a training session. Here are the details:</p>
            
            <div class="info-box">
              <strong>Date:</strong> ${formattedDate}<br>
              <strong>Time:</strong> ${formattedStartTime} - ${formattedEndTime}<br>
              <strong>Branch:</strong> ${branchName}<br>
              <strong>Package Type:</strong> ${packageType || 'Not specified'}<br>
              <strong>Coaches:</strong> ${coachNames.join(', ')}
            </div>

            <p>We look forward to seeing you at the session!</p>
            
            <div class="footer">
              <p>This is an automated notification from Takeover Hoops Scheduler.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const results = {
      coaches: [] as Array<{ email: string; success: boolean; error?: string }>,
      students: [] as Array<{ email: string; success: boolean; error?: string }>,
    };

    // Send emails to coaches
    for (const email of coachEmails) {
      try {
        await sendEmail(
          email,
          `New Training Session - ${formattedDate}`,
          coachEmailHtml,
          supabaseAdmin
        );
        results.coaches.push({ email, success: true });
      } catch (error: any) {
        console.error(`Error sending email to coach ${email}:`, error);
        results.coaches.push({ email, success: false, error: error.message });
      }
    }

    // Send emails to students
    for (const email of studentEmails) {
      try {
        await sendEmail(
          email,
          `Training Session Scheduled - ${formattedDate}`,
          studentEmailHtml,
          supabaseAdmin
        );
        results.students.push({ email, success: true });
      } catch (error: any) {
        console.error(`Error sending email to student ${email}:`, error);
        results.students.push({ email, success: false, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        message: `Emails sent to ${results.coaches.filter(r => r.success).length} coaches and ${results.students.filter(r => r.success).length} students`,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (error: any) {
    console.error("Error in send-session-notification function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to send session notifications",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
};

serve(handler);
