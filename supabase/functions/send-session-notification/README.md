# Session Notification Email Function

This Edge Function sends email notifications to coaches and students when a training session is booked.

## How to Set Supabase Secrets

You can set secrets using either method:

### Method 1: Using Supabase CLI (Recommended)

1. Make sure you have the Supabase CLI installed and are logged in:
   ```bash
   supabase login
   ```

2. Link your project (if not already linked):
   ```bash
   supabase link --project-ref your-project-ref
   ```

3. Set secrets using the CLI:
   ```bash
   supabase secrets set SECRET_NAME=secret_value
   ```

### Method 2: Using Supabase Dashboard

1. Go to your Supabase project dashboard: https://app.supabase.com
2. Navigate to: **Project Settings** → **Edge Functions** → **Secrets**
3. Click **Add Secret** and enter the secret name and value
4. Click **Save**

**Note:** Secrets are encrypted and only accessible to your Edge Functions.

---

## Setup (Choose One Free Option)

### Option 1: Using EmailJS (Easiest - 200 emails/month free)

1. Sign up for a free EmailJS account at https://www.emailjs.com
2. Create an email service (Gmail, Outlook, etc.)
3. Create an email template with these variables:
   - `{{to_email}}` - Recipient email
   - `{{subject}}` - Email subject
   - `{{message_html}}` - HTML email body
4. Get your Service ID, Template ID, and Public Key from EmailJS dashboard
5. Set them as Supabase secrets (using CLI or Dashboard - see "How to Set Supabase Secrets" above):
   ```bash
   supabase secrets set EMAILJS_SERVICE_ID=your_service_id
   supabase secrets set EMAILJS_TEMPLATE_ID=your_template_id
   supabase secrets set EMAILJS_PUBLIC_KEY=your_public_key
   ```

### Option 2: Using Resend (3,000 emails/month free)

1. Sign up for a free Resend account at https://resend.com
2. Get your API key from the Resend dashboard
3. Set it as a Supabase secret (using CLI or Dashboard - see "How to Set Supabase Secrets" above):
   ```bash
   supabase secrets set RESEND_API_KEY=your_api_key_here
   ```
   Note: Free tier uses `onboarding@resend.dev` as sender (already configured)

### Option 3: Using Gmail SMTP (Free, unlimited) - RECOMMENDED

**Method A: Using EmailJS with Gmail (Easiest)**

1. Sign up for free EmailJS account: https://www.emailjs.com
2. Add Gmail as your email service in EmailJS dashboard
3. Create an email template with variables:
   - `{{to_email}}` - Recipient email
   - `{{from_email}}` - Sender email (your Gmail)
   - `{{subject}}` - Email subject
   - `{{message_html}}` - HTML email body
4. Get your Service ID, Template ID, and Public Key
5. Set them as Supabase secrets (using CLI or Dashboard):
   
   **Using CLI:**
   ```bash
   supabase secrets set EMAILJS_SERVICE_ID=your_service_id
   supabase secrets set EMAILJS_TEMPLATE_ID=your_template_id
   supabase secrets set EMAILJS_PUBLIC_KEY=your_public_key
   ```
   
   **Or using Dashboard:**
   - Go to Project Settings → Edge Functions → Secrets
   - Add each secret: `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`

6. Also set your Gmail credentials (for fallback):
   
   **Using CLI:**
   ```bash
   supabase secrets set SMTP_HOST=smtp.gmail.com
   supabase secrets set SMTP_PORT=587
   supabase secrets set SMTP_USER=your_email@gmail.com
   supabase secrets set SMTP_PASS=your_app_password
   supabase secrets set SMTP_FROM=your_email@gmail.com
   ```
   
   **Or using Dashboard:**
   - Add secrets: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

**Method B: Direct Gmail SMTP (Advanced)**

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Set SMTP credentials as Supabase secrets:
   
   **Using CLI:**
   ```bash
   supabase secrets set SMTP_HOST=smtp.gmail.com
   supabase secrets set SMTP_PORT=587
   supabase secrets set SMTP_USER=your_email@gmail.com
   supabase secrets set SMTP_PASS=your_app_password
   supabase secrets set SMTP_FROM=your_email@gmail.com
   ```
   
   **Or using Dashboard:**
   - Go to Project Settings → Edge Functions → Secrets
   - Click "Add Secret" and add each secret with these exact names:
     - **Name:** `SMTP_HOST` → **Value:** `smtp.gmail.com`
     - **Name:** `SMTP_PORT` → **Value:** `587`
     - **Name:** `SMTP_USER` → **Value:** `your_email@gmail.com`
     - **Name:** `SMTP_PASS` → **Value:** `your_app_password` (the 16-character app password from Google)
     - **Name:** `SMTP_FROM` → **Value:** `your_email@gmail.com`
   
   **Important:** In the Dashboard, the **Name** field should be just the secret name (e.g., `SMTP_HOST`), NOT the full command (`supabase secrets set SMTP_HOST`).
   **Note:** Direct SMTP may require TLS support. For best results, use Method A (EmailJS with Gmail).

### Option 4: Development/Testing (No setup required)

For development, emails will be logged to the console. Check your Supabase function logs to see the email content.

## Deployment

Deploy the function using:
```bash
supabase functions deploy send-session-notification
```

## Usage

The function is automatically called when a session is created in the SessionsManager component.

## Email Templates

- **Coaches**: Receive session details including date, time, branch, package type, and number of participants
- **Students**: Receive session details including date, time, branch, package type, and assigned coaches

## Recommended: EmailJS

EmailJS is the easiest free option - just connect your Gmail/Outlook and you're ready to go!
