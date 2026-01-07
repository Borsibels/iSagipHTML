# EmailJS Setup Guide for Mass Registration

This guide will help you set up EmailJS to send automated account credentials to staff and responders during mass registration.

## Step 1: Create EmailJS Account

1. Go to [https://www.emailjs.com/](https://www.emailjs.com/)
2. Sign up for a free account (free tier allows 200 emails/month)
3. Verify your email address

## Step 2: Create Email Service

1. In the EmailJS dashboard, go to **Email Services**
2. Click **Add New Service**
3. Choose your email provider (Gmail, Outlook, etc.)
4. Follow the setup instructions to connect your email account
5. Note your **Service ID** (e.g., `service_xxxxx`)

## Step 3: Create Email Template

1. Go to **Email Templates** in the EmailJS dashboard
2. Click **Create New Template**
3. Use the following template:

**Template Name:** Staff Registration Credentials

**Subject:** Your iSagip Account Credentials

**Content:**
```
Hello {{to_name}},

Your account has been created for the iSagip Emergency Response System.

Your login credentials are:
Email: {{to_email}}
Password: {{password}}
Role: {{role}}

Please log in at: {{login_url}}

For security reasons, please change your password after your first login.

Best regards,
iSagip System Administrator
```

4. Note your **Template ID** (e.g., `template_xxxxx`)

## Step 4: Get Your Public Key

1. Go to **Account** → **General** in the EmailJS dashboard
2. Find your **Public Key** (e.g., `xxxxxxxxxxxxx`)

## Step 5: Update the Mass Registration Code

1. Open `assets/js/mass-registration.js`
2. Find these lines near the top:

```javascript
const EMAILJS_PUBLIC_KEY = 'YOUR_EMAILJS_PUBLIC_KEY';
const EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
```

3. Replace with your actual values:

```javascript
const EMAILJS_PUBLIC_KEY = 'your_public_key_here';
const EMAILJS_SERVICE_ID = 'service_xxxxx';
const EMAILJS_TEMPLATE_ID = 'template_xxxxx';
```

## Step 6: Test the Setup

1. Go to the Mass Registration page
2. Add a test entry with your own email
3. Submit the registration
4. Check your email inbox for the credentials

## Alternative: Using Firebase Cloud Functions

If you prefer to use Firebase Cloud Functions instead of EmailJS, you can:

1. Set up Firebase Cloud Functions
2. Use a service like SendGrid, Mailgun, or Nodemailer
3. Create a Cloud Function that sends emails
4. Call the function from the mass registration script

This approach is more secure but requires backend setup.

## Troubleshooting

- **Emails not sending**: Check that your EmailJS service is properly connected
- **Template variables not working**: Ensure variable names match exactly (case-sensitive)
- **Rate limiting**: Free tier has limits; upgrade if you need more emails
- **CORS errors**: Make sure EmailJS is properly initialized in the script

## Security Notes

- The generated passwords are secure random strings
- Passwords are only sent via email, not stored in plain text
- Users should change their password after first login
- Consider implementing password reset functionality

