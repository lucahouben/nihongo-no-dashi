# Database Webhook Setup for AI Review on Insert

This SQL sets up the necessary configuration. You'll need to run this in your Supabase SQL Editor after deploying the Edge Function.

## Prerequisites
1. Deploy the Edge Function first (see deployment guide)
2. Get your Edge Function URL from Supabase
3. Get your service role key and anon key (for the webhook auth if needed)

## Setup

### Option 1: Using Database Webhooks (Supabase Dashboard - Easiest)

1. Go to your Supabase project > Database > Webhooks
2. Click "Create a new hook"
3. Configure:
   - **Name**: `review-vocab-on-insert`
   - **Table**: `public.vocabulary`
   - **Events**: Check `Insert` only
   - **Type**: HTTP Request
   - **Method**: POST
   - **URL**: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/review-vocab-on-insert`
   - **HTTP Headers**: Add `Authorization: Bearer YOUR_ANON_KEY` (or use the function's verify_jwt setting)
   - **HTTP Parameters**: Leave empty
4. Click "Create webhook"

### Option 2: Using pg_net (SQL - More Control)

If you prefer to do it via SQL, you can use `pg_net` extension:

```sql
-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to call the edge function
CREATE OR REPLACE FUNCTION public.trigger_review_vocab()
RETURNS TRIGGER AS $$
DECLARE
  function_url text := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/review-vocab-on-insert';
  service_key text := 'YOUR_ANON_KEY'; -- or your function secret
BEGIN
  PERFORM net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object('record', row_to_json(NEW))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER on_vocab_insert_review
  AFTER INSERT ON public.vocabulary
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_review_vocab();
```

**Note**: Replace `YOUR_PROJECT_REF` and `YOUR_ANON_KEY` with your actual values.

## Testing

After setup, add a test word through your app. Check:
1. The Edge Function logs in Supabase Dashboard > Edge Functions > review-vocab-on-insert > Logs
2. The vocabulary table - the row should be updated within a few seconds if changes were made

## Disabling/Removing

To disable: Drop the trigger or webhook.
To remove trigger: `DROP TRIGGER IF EXISTS on_vocab_insert_review ON public.vocabulary;`
To remove function: `DROP FUNCTION IF EXISTS public.trigger_review_vocab();`
