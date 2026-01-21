# EmailJS with Gmail Setup Guide

Follow these steps to set up EmailJS with your Gmail account for sending session notification emails.

## Step 1: Sign Up for EmailJS

1. Go to https://www.emailjs.com
2. Click **Sign Up** (free account)
3. Create your account (200 emails/month free)

## Step 2: Add Gmail as Email Service

1. After logging in, go to **Email Services** in the left sidebar
2. Click **Add New Service**
3. Select **Gmail** from the list
4. Click **Connect Account**
5. Sign in with your Gmail account (`grayzxc23@gmail.com`)
6. Grant permissions to EmailJS
7. Once connected, you'll see your Gmail service listed
8. **Copy the Service ID** (you'll need this later)

## Step 3: Create Email Template

1. Go to **Email Templates** in the left sidebar
2. Click **Create New Template**
3. Give it a name (e.g., "Session Notification")
4. Set the **Subject** to: `{{subject}}`
5. In the **Content** area, use this template:

```
Hello,

{{message_html}}

Best regards,
Takeover Hoops
```

6. **Important:** Make sure to enable **HTML** mode (there's usually a toggle or button)
7. Click **Save**

## Step 4: Get Your Credentials

After creating the template, you'll need:

1. **Service ID**: From Step 2 (e.g., `service_xxxxx`)
2. **Template ID**: From the template you just created (e.g., `template_xxxxx`)
3. **Public Key (User ID)**: 
   - Go to **Account** → **General**
   - Find **Public Key** (also called User ID)
   - Copy it (e.g., `xxxxxxxxxxxxx`)

## Step 5: Set Supabase Secrets

Go to your Supabase Dashboard:
1. Navigate to **Project Settings** → **Edge Functions** → **Secrets**
2. Add these three secrets:

| Name | Value |
|------|-------|
| `EMAILJS_SERVICE_ID` | Your Service ID from Step 4 |
| `EMAILJS_TEMPLATE_ID` | Your Template ID from Step 4 |
| `EMAILJS_PUBLIC_KEY` | Your Public Key from Step 4 |

**Important:** 
- The **Name** should be exactly as shown (no spaces, no `supabase secrets set` prefix)
- The **Value** should be your actual IDs from EmailJS

## Step 6: Update Email Template Variables (Optional)

If you want more control over the email content, you can update your EmailJS template to use these variables:

- `{{to_email}}` - Recipient email address
- `{{subject}}` - Email subject line
- `{{message_html}}` - HTML email body (already being sent)
- `{{message_text}}` - Plain text version (already being sent)

The function automatically sends all these variables, so your template can use any of them.

## Step 7: Deploy the Function

Once secrets are set, deploy the function:

```bash
supabase functions deploy send-session-notification
```

## Step 8: Test It!

1. Create a new session in your app
2. Check the Supabase function logs to see if emails were sent
3. Check the inbox of the coach and student emails

## Troubleshooting

- **Emails not sending?** Check the function logs: `supabase functions logs send-session-notification`
- **Template not found?** Make sure your Template ID matches exactly
- **Service error?** Verify your Gmail service is still connected in EmailJS dashboard
- **Free tier limit?** EmailJS free tier is 200 emails/month. Upgrade if needed.

## That's It!

Your emails will now be sent via EmailJS using your Gmail account. This is much more reliable than direct SMTP and handles all the authentication automatically!
