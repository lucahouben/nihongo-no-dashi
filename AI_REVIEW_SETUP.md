# Nihongo no Dashi - AI Auto-Review Setup

This guide will help you set up automatic AI review of vocabulary items when they're added to your Supabase database.

## Overview

When you add a new word to your vocabulary (via the app, URL params, or directly), an AI will review it for accuracy and automatically fix issues like:
- Incorrect kanji/reading pairs
- Awkward or unclear meanings
- Wrong part of speech
- Poor example sentences
- Missing or incorrect conjugation info

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- A Supabase project (you already have one - `qrwigrbmjobfypvymrev`)
- An LLM API key (Gemini via Google AI Studio recommended - free!)
- Node.js installed (for local testing)

## Step 1: Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Linux
curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh

# Windows (Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

## Step 2: Login and Link Your Project

```bash
cd /home/luca/dev/nihongo-no-dashi

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref qrwigrbmjobfypvymrev
```

You'll need your database password from Supabase (Project Settings > Database).

## Step 3: Set Up Secrets

You need to store your API keys securely in Supabase. Use Gemini (recommended and free via Google AI Studio).

### Get your Gemini API key
1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click "Create API key"
4. Copy the key

### Set secrets in Supabase

```bash
# For Gemini (recommended)
supabase secrets set GEMINI_API_KEY=your-gemini-api-key-here
supabase secrets set LLM_MODEL=gemini-2.5-flash

# OR alternatively use GOOGLE_API_KEY
# supabase secrets set GOOGLE_API_KEY=your-gemini-api-key-here

# Optional: OpenAI
# supabase secrets set OPENAI_API_KEY=sk-...your-key...
# supabase secrets set LLM_MODEL=gpt-4o-mini

# Optional: Anthropic
# supabase secrets set ANTHROPIC_API_KEY=sk-ant-...your-key...
# supabase secrets set LLM_MODEL=claude-3-5-haiku-20241022
```

Supabase automatically provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to edge functions, so you don't need to set those manually.

## Step 4: Deploy the Edge Function

```bash
# Deploy the function
supabase functions deploy review-vocab-on-insert --no-verify-jwt
```

The `--no-verify-jwt` flag allows the database webhook to call it without authentication headers. If you prefer to verify, you'll need to configure the webhook differently.

## Step 5: Set Up the Database Webhook

You have two options:

### Option A: Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/qrwigrbmjobfypvymrev)
2. Navigate to Database > Webhooks
3. Click "Create a new hook"
4. Fill in:
   - Name: `review-vocab-on-insert`
   - Table: `vocabulary`
   - Events: `INSERT`
   - Type: `Supabase Edge Functions`
   - Edge Function: `review-vocab-on-insert`
   - Method: `POST`
5. Click "Create webhook"

### Option B: SQL Editor

1. Go to SQL Editor in Supabase Dashboard
2. Copy the contents of `supabase/sql/webhook_setup.sql`
3. Replace `YOUR_PROJECT_REF` with `qrwigrbmjobfypvymrev`
4. Replace `YOUR_ANON_KEY` with your anon key from `index.html` (or Project Settings > API)
5. Run the SQL

## Step 6: Test It

1. Open your Nihongo no Dashi app
2. Add a new word (use manual entry or auto-fill)
3. Wait 2-5 seconds
4. Check the word in your database or refresh the app - it may have been updated by the AI

You can also check function logs:
```bash
supabase functions logs review-vocab-on-insert
```

Or in the dashboard: Edge Functions > review-vocab-on-insert > Logs

## Configuration Options

### Adjust confidence threshold
In the Edge Function, change `reviewResult.confidence >= 0.7` to be more or less strict:
- `0.9` = Only very confident corrections
- `0.7` = Default, balanced
- `0.5` = More aggressive corrections

### Change which model to use
Set `LLM_MODEL` secret:
- OpenAI: `gpt-4o-mini` (cheaper), `gpt-4o` (better), `gpt-4.1-mini`
- Anthropic: `claude-3-5-haiku-20241022` (cheaper), `claude-3-5-sonnet-20241022` (better)

### Disable for certain items
You can modify the function to skip items added via certain methods, or skip items that already have complete data.

## Costs

- **Supabase Edge Functions**: Free tier includes 500K invocations/month
- **Google Gemini (Google AI Studio)**: Free tier is very generous for individual use. Gemini 2.5 Flash is free for most usage - perfect for reviewing words as you add them. Check current limits at [Google AI Studio pricing](https://ai.google.dev/pricing).
- **OpenAI**: Paid, gpt-4o-mini is ~$0.15/1M input tokens
- **Anthropic**: Paid

With Gemini free tier, you should be able to review hundreds/thousands of words for free.

## Troubleshooting

### Function not triggering
- Check webhook is enabled
- Check function is deployed: `supabase functions list`
- Look at webhook logs in Dashboard

### No updates happening
- Check function logs for errors
- Verify API keys are set: `supabase secrets list`
- Lower confidence threshold for testing
- Check if LLM is returning valid JSON

### Updates are wrong
- Use a better model (gpt-4o or claude-3-5-sonnet)
- Tighten the prompt in the function
- Increase confidence threshold
- Add validation in the function

## Local Testing (Optional)

If you want to test before deploying:

```bash
# Install dependencies
npm install @supabase/supabase-js dotenv openai

# Create .env file
cp scripts/.env.example scripts/.env
# Edit .env with your keys

# Run dry-run test
node scripts/test-review.js
```

See `scripts/test-review.js` for local testing.
