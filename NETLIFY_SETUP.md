# Netlify Environment Variables Setup

This guide explains how to add the required environment variables to your Netlify deployment.

## Required Environment Variables

Add the following environment variables to your Netlify project:

1. `GOOGLE_CLIENT_ID` - Your Google OAuth Client ID
2. `GOOGLE_CLIENT_SECRET` - Your Google OAuth Client Secret
3. `PAYSTACK_SECRET_KEY` - Your Paystack Live Secret Key
4. `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` - Your Paystack Live Public Key
5. `NEXT_PUBLIC_SITE_URL` - Your production site URL (e.g., `https://daiyet.store`)

## Method 1: Using Netlify CLI (Recommended)

Run these commands to add the environment variables via CLI:

```bash
# Set Google OAuth credentials
netlify env:set GOOGLE_CLIENT_ID "your-google-client-id-value"
netlify env:set GOOGLE_CLIENT_SECRET "your-google-client-secret-value"

# Set Paystack credentials (Live keys)
netlify env:set PAYSTACK_SECRET_KEY "your-paystack-secret-key-value"
netlify env:set NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY "your-paystack-public-key-value"

# Set site URL
netlify env:set NEXT_PUBLIC_SITE_URL "https://daiyet.store"
```

**Note:** Replace the placeholder values with your actual credentials.

## Method 2: Using Netlify Dashboard

1. Go to your Netlify project dashboard: https://app.netlify.com/projects/daiyet
2. Navigate to **Site configuration** → **Environment variables**
3. Click **Add variable** for each variable
4. Add the following variables:

   | Variable Name | Value |
   |--------------|-------|
   | `GOOGLE_CLIENT_ID` | Your Google OAuth Client ID |
   | `GOOGLE_CLIENT_SECRET` | Your Google OAuth Client Secret |
   | `PAYSTACK_SECRET_KEY` | Your Paystack Live Secret Key |
   | `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Your Paystack Live Public Key |
   | `NEXT_PUBLIC_SITE_URL` | `https://daiyet.store` |

5. Save each variable

## Verify Environment Variables

To verify that the variables are set correctly:

```bash
netlify env:list
```

This will show all environment variables configured for your project.

## Important Notes

- Environment variables prefixed with `NEXT_PUBLIC_` will be exposed to the browser/client-side code
- Make sure to use **Live keys** for Paystack (not test keys)
- After adding environment variables, you may need to trigger a new deployment for changes to take effect
- The `NEXT_PUBLIC_SITE_URL` should match your production domain

## Deployment

After adding the environment variables, trigger a new deployment:

```bash
netlify deploy --prod
```

Or push to your connected Git branch to trigger an automatic deployment.
