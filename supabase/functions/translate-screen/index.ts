import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024
const MAX_VOCAB_ITEMS = 6
const MAX_SENTENCES = 4

type JsonObject = Record<string, unknown>

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function asText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' ? value as JsonObject : {}
}

function parseModelJson(text: string): JsonObject {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  return asObject(JSON.parse(cleaned))
}

function normalizeResult(raw: JsonObject) {
  const rawVocabulary = Array.isArray(raw.vocabulary) ? raw.vocabulary : []
  const seenVocabulary = new Set<string>()
  const vocabulary: JsonObject[] = []

  for (const candidate of rawVocabulary) {
    const item = asObject(candidate)
    const kanji = asText(item.kanji, 80) || asText(item.reading, 80)
    const reading = asText(item.reading, 80) || kanji
    const meaning = asText(item.meaning, 240)
    if (!kanji || !meaning) continue

    const key = `${kanji}\u0000${meaning}`.toLowerCase()
    if (seenVocabulary.has(key)) continue
    seenVocabulary.add(key)

    vocabulary.push({
      kanji,
      reading,
      meaning,
      type: asText(item.type, 40) || 'Unknown',
      conjugation: asText(item.conjugation, 200),
      example: asText(item.example, 400),
    })
    if (vocabulary.length >= MAX_VOCAB_ITEMS) break
  }

  const rawSentences = Array.isArray(raw.sentences) ? raw.sentences : []
  const seenSentences = new Set<string>()
  const sentences: JsonObject[] = []

  for (const candidate of rawSentences) {
    const item = asObject(candidate)
    const sentence = asText(item.sentence, 500)
    const translation = asText(item.translation, 800)
    if (!sentence || !translation) continue

    const key = `${sentence}\u0000${translation}`.toLowerCase()
    if (seenSentences.has(key)) continue
    seenSentences.add(key)

    sentences.push({ sentence, translation })
    if (sentences.length >= MAX_SENTENCES) break
  }

  return {
    detectedText: asText(raw.detectedText, 4000),
    translation: asText(raw.translation, 4000),
    reading: asText(raw.reading, 2000),
    notes: asText(raw.notes, 1000),
    vocabulary,
    sentences,
  }
}

const prompt = `You are reading a single frame from a Japanese Game Boy Advance game.

Extract the on-screen Japanese text. Focus on dialogue boxes, menus, item names, signs, and short labels. Ignore Latin letters, pure numbers, and HUD values unless they are part of a Japanese phrase. Do not invent text that is not visible.

Return ONLY valid JSON with this exact shape:
{
  "detectedText": "the main Japanese text exactly as shown, with newlines between separate boxes/lines",
  "translation": "a natural English translation of the main text",
  "reading": "kana reading of the main text when useful, otherwise empty",
  "notes": "brief context or uncertainty, otherwise empty",
  "vocabulary": [
    {
      "kanji": "the word in Japanese, including kana-only words",
      "reading": "hiragana or katakana reading",
      "meaning": "concise English meaning suitable for a flashcard",
      "type": "noun | verb | i-adjective | na-adjective | adverb | expression | particle | other",
      "conjugation": "brief conjugation note if relevant, otherwise empty",
      "example": "a short natural Japanese example sentence, otherwise empty"
    }
  ],
  "sentences": [
    {
      "sentence": "a complete Japanese sentence or dialogue line visible on screen",
      "translation": "natural English translation"
    }
  ]
}

Rules:
- Only include Japanese you can actually read.
- If there is no readable Japanese, return empty arrays and explain why in notes.
- Prefer 1-6 high-value vocabulary items rather than every particle.
- Keep meanings short and flashcard-friendly.
- Keep the response compact.
- The kanji and reading must match each other.
- Do not wrap the JSON in markdown fences.`

function thinkingConfigForModel(model: string) {
  if (model.startsWith('gemini-2.5-flash-lite')) return null
  if (model.startsWith('gemini-2.5')) return { thinkingBudget: 0 }
  if (model.startsWith('gemini-3')) {
    return { thinkingLevel: model.includes('flash-lite') ? 'minimal' : 'low' }
  }
  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Use POST for screen translation.' }, 405)
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY')
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured for this project.')
    }

    const body = asObject(await req.json())
    const image = typeof body.image === 'string' ? body.image.trim() : ''
    if (!image) {
      return json({ success: false, error: 'Missing screenshot image.' }, 400)
    }

    let mimeType = 'image/png'
    let base64 = image

    const dataUrlMatch = image.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s)
    if (dataUrlMatch) {
      mimeType = dataUrlMatch[1]
      base64 = dataUrlMatch[2]
    } else if (!/^[A-Za-z0-9+/=\s]+$/.test(image)) {
      return json({ success: false, error: 'Screenshot must be a base64 PNG, JPEG, or WebP image.' }, 400)
    }

    base64 = base64.replace(/\s+/g, '')
    const estimatedBytes = Math.floor(base64.length * 3 / 4)
    if (estimatedBytes > MAX_IMAGE_BYTES) {
      return json({ success: false, error: 'Screenshot is too large.' }, 413)
    }

    const configuredModel = Deno.env.get('VISION_MODEL') || ''
    const models = [
      configuredModel.includes('gemini') ? configuredModel : '',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest',
      'gemini-2.5-flash',
    ].filter((model, index, list) => model && list.indexOf(model) === index)

    let response: Response | null = null
    let lastError = ''
    let usedModel = models[0]
    const maxAttempts = 2

    for (let attempt = 0; attempt < maxAttempts && !response; attempt++) {
      for (const model of models) {
        usedModel = model
        const thinkingConfig = thinkingConfigForModel(model)
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: prompt },
                    { inlineData: { mimeType, data: base64 } },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 1600,
                responseMimeType: 'application/json',
                ...(thinkingConfig ? { thinkingConfig } : {}),
              },
            }),
          },
        )

        if (response.ok) break

        lastError = `Gemini API error: ${response.status} - ${(await response.text()).slice(0, 500)}`
        const retryable = response.status === 404
          || response.status === 429
          || response.status === 500
          || response.status === 503
          || lastError.includes('no longer available')
        if (!retryable) {
          throw new Error(lastError)
        }
        response = null
      }
      if (!response && attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 1200))
      }
    }

    if (!response || !response.ok) {
      throw new Error(lastError || 'No Gemini vision model was available.')
    }

    const data = await response.json()
    const content = (data.candidates?.[0]?.content?.parts || [])
      .map((part: { text?: string }) => part.text || '')
      .join('')
      .trim()

    if (!content) {
      throw new Error('Gemini returned an empty response.')
    }

    const result = normalizeResult(parseModelJson(content))
    return json({ success: true, result, model: usedModel })
  } catch (error) {
    console.error('translate-screen error:', error)
    return json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, 500)
  }
})
