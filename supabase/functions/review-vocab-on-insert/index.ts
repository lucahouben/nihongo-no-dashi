import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VocabItem {
  id: string
  kanji: string
  reading: string
  meaning: string
  type: string
  conjugation: string
  sent: string
  level: number
  next_review: string
  created_at: string
}

interface ReviewResult {
  shouldUpdate: boolean
  confidence: number
  reason: string
  changes: Partial<VocabItem>
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get Supabase client with service role key for updates
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get LLM API key (supports Gemini, OpenAI, Anthropic)
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY')
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const llmModel = Deno.env.get('LLM_MODEL') || 'gemini-2.5-flash'

    if (!geminiKey && !openaiKey && !anthropicKey) {
      throw new Error('No LLM API key configured. Set GEMINI_API_KEY (recommended), OPENAI_API_KEY, or ANTHROPIC_API_KEY')
    }

    // Parse webhook payload
    const payload = await req.json()
    const record = payload.record as VocabItem

    if (!record) {
      throw new Error('No record in payload')
    }

    // Build review prompt
    const prompt = `You are reviewing Japanese vocabulary for a spaced repetition flashcard app.

Review this vocabulary item for accuracy and quality:

- Kanji: ${record.kanji}
- Reading: ${record.reading}
- Meaning: ${record.meaning}
- Type: ${record.type}
- Conjugation: ${record.conjugation || '(none)'}
- Example sentence: ${record.sent || '(none)'}
- Current level: ${record.level}

Check for:
1. Kanji and reading consistency (reading should be valid kana/okurigana)
2. Meaning accuracy and naturalness for SRS (clear, concise)
3. Part of speech/type correctness
4. Example sentence quality (natural Japanese, appropriate for this word)
5. Conjugation notes if relevant

Rules:
- Only suggest changes if there's a clear improvement
- Preserve the item's ID, level, next_review, created_at
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

Only include fields in "changes" that need to be corrected.`

    let reviewResult: ReviewResult

    if (geminiKey) {
      // Use Google Gemini
      const model = llmModel.includes('gemini') ? llmModel : 'gemini-2.5-flash'
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
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (!content) {
        throw new Error('Empty response from Gemini')
      }
      reviewResult = JSON.parse(content)
    } else if (anthropicKey) {
      // Use Anthropic Claude
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: llmModel.includes('claude') ? llmModel : 'claude-3-5-haiku-20241022',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      })

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`)
      }

      const data = await response.json()
      const content = data.content[0].text
      reviewResult = JSON.parse(content)
    } else if (openaiKey) {
      // Use OpenAI
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: llmModel,
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
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`)
      }

      const data = await response.json()
      const content = data.choices[0].message.content
      reviewResult = JSON.parse(content)
    } else {
      throw new Error('No LLM provider configured')
    }

    // Apply updates if confident enough
    if (reviewResult.shouldUpdate && reviewResult.confidence >= 0.7 && Object.keys(reviewResult.changes).length > 0) {
      const { error: updateError } = await supabase
        .from('vocabulary')
        .update(reviewResult.changes)
        .eq('id', record.id)

      if (updateError) {
        throw updateError
      }

      return new Response(
        JSON.stringify({
          success: true,
          updated: true,
          changes: reviewResult.changes,
          reason: reviewResult.reason,
          confidence: reviewResult.confidence,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated: false,
        reason: reviewResult.reason || 'No changes needed',
        confidence: reviewResult.confidence || 1.0,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
