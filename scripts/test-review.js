const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DRY_RUN = process.env.DRY_RUN !== 'false';
const LLM_MODEL = process.env.LLM_MODEL || 'gemini-2.5-flash';

async function reviewItem(item) {
  const prompt = `You are reviewing Japanese vocabulary for a spaced repetition flashcard app.

Review this vocabulary item for accuracy and quality:

- Kanji: ${item.kanji}
- Reading: ${item.reading}
- Meaning: ${item.meaning}
- Type: ${item.type}
- Conjugation: ${item.conjugation || '(none)'}
- Example sentence: ${item.sent || '(none)'}
- Current level: ${item.level}

Check for:
1. Kanji and reading consistency (reading should be valid kana/okurigana)
2. Meaning accuracy and naturalness for SRS (clear, concise)
3. Part of speech/type correctness
4. Example sentence quality (natural Japanese, appropriate for this word)
5. Conjugation notes if relevant

Rules:
- Only suggest changes if there's a clear improvement
- Don't change if the item seems already good
- Be conservative - prefer minimal corrections
- For SRS purposes, meanings should be clear and not overly verbose

Return ONLY valid JSON in this exact format:
{
  "shouldUpdate": boolean,
  "confidence": number (0-1),
  "reason": "brief explanation",
  "changes": {
    "reading"?: string,
    "meaning"?: string,
    "type"?: string,
    "conjugation"?: string,
    "sent"?: string
  }
}

Only include fields in "changes" that need to be corrected.`;

  try {
    // Try Gemini first if key exists
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (geminiKey) {
      const model = LLM_MODEL.includes('gemini') ? LLM_MODEL : 'gemini-2.5-flash';
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'You are a Japanese vocabulary reviewer. Always return valid JSON.\n\n' + prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json'
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) throw new Error('Empty response from Gemini');
      return JSON.parse(content);
    }

    // Try OpenAI if key exists
    if (process.env.OPENAI_API_KEY) {
      const response = await openai.chat.completions.create({
        model: LLM_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a Japanese vocabulary reviewer. Always return valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      });

      const content = response.choices[0].message.content;
      return JSON.parse(content);
    }

    throw new Error('No API key configured (need GEMINI_API_KEY or OPENAI_API_KEY)');
  } catch (error) {
    console.error('Error calling LLM:', error.message);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const applyFlag = args.includes('--apply');
  const allFlag = args.includes('--all');
  const idArg = args.find(a => a.startsWith('--id='));
  
  const shouldApply = applyFlag && !DRY_RUN;

  console.log(`Mode: ${shouldApply ? 'APPLY CHANGES' : 'DRY RUN'}`);
  console.log('');

  try {
    let items = [];

    if (idArg) {
      const id = idArg.split('=')[1];
      const { data, error } = await supabase
        .from('vocabulary')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      items = [data];
    } else if (allFlag) {
      const { data, error } = await supabase
        .from('vocabulary')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      items = data;
    } else {
      // Get most recent item
      const { data, error } = await supabase
        .from('vocabulary')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (error) throw error;
      items = [data];
    }

    console.log(`Reviewing ${items.length} item(s)...\n`);

    for (const item of items) {
      console.log('='.repeat(60));
      console.log(`ID: ${item.id}`);
      console.log(`Kanji: ${item.kanji} | Reading: ${item.reading}`);
      console.log(`Meaning: ${item.meaning}`);
      console.log(`Type: ${item.type} | Level: ${item.level}`);
      if (item.sent) console.log(`Example: ${item.sent}`);
      console.log('-'.repeat(60));

      const review = await reviewItem(item);
      if (!review) {
        console.log('Failed to review item\n');
        continue;
      }

      console.log(`Confidence: ${(review.confidence * 100).toFixed(0)}%`);
      console.log(`Should update: ${review.shouldUpdate}`);
      console.log(`Reason: ${review.reason}`);

      if (review.shouldUpdate && Object.keys(review.changes).length > 0) {
        console.log('\nProposed changes:');
        for (const [key, value] of Object.entries(review.changes)) {
          console.log(`  ${key}:`);
          console.log(`    OLD: ${item[key] || '(empty)'}`);
          console.log(`    NEW: ${value}`);
        }

        if (shouldApply && review.confidence >= 0.7) {
          const { error: updateError } = await supabase
            .from('vocabulary')
            .update(review.changes)
            .eq('id', item.id);
          
          if (updateError) {
            console.log(`\n❌ Update failed: ${updateError.message}`);
          } else {
            console.log('\n✅ Updated successfully');
          }
        } else if (shouldApply && review.confidence < 0.7) {
          console.log('\n⚠️  Skipped (confidence < 0.7)');
        } else {
          console.log('\n💡 To apply: run with --apply flag or set DRY_RUN=false');
        }
      } else {
        console.log('\n✓ No changes needed');
      }
      console.log('\n');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
