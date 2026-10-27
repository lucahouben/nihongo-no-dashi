# Local Testing Script for AI Review

This script lets you test the AI review logic locally before deploying to Supabase.
It runs in dry-run mode by default (won't make changes to your database).

## Setup

1. Install dependencies:
```bash
npm init -y
npm install @supabase/supabase-js openai @anthropic-ai/sdk dotenv
```

2. Create a `.env` file in this directory:
```bash
cp .env.example .env
```

3. Edit `.env` with your credentials:
```env
SUPABASE_URL=https://qrwigrbmjobfypvymrev.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
OPENAI_API_KEY=sk-...
# OR
ANTHROPIC_API_KEY=sk-ant-...
LLM_MODEL=gpt-4o-mini
DRY_RUN=true
```

**Get your service_role key**: Supabase Dashboard > Project Settings > API > Service role key (keep this secret!)

## Usage

```bash
# Test with the most recent item
node test-review.js

# Test with a specific item ID
node test-review.js --id=YOUR_ITEM_ID

# Test all items (be careful!)
node test-review.js --all

# Actually apply changes (set DRY_RUN=false in .env or pass flag)
node test-review.js --apply
```

## Notes

- DRY_RUN is true by default for safety
- Service role key bypasses RLS - use with caution
- Start with just one item to see results
- Check the output before applying changes
