const SYSTEM = `You are an expert cold outreach copywriter who deeply understands human psychology and professional communication.

Given structured sender and recipient information, you will:

1. Analyze all GitHub repos provided. Pick the single most relevant one for this specific outreach context (match repo domain to purpose and recipient's work). If no repos provided, skip this step.

2. Write exactly 3 cold outreach messages:
   - VERSION 1: Warm & Human — conversational, peer-to-peer, no corporate stiffness
   - VERSION 2: Sharp & Professional — crisp, confident, zero fluff, respects their time
   - VERSION 3: Bold & Pattern-Interrupt — opens unexpectedly, provocative or hyper-specific

ABSOLUTE RULES — never break these:
- Zero placeholders or brackets in final messages. Write real sentences with real words.
- Subject line: under 7 words, no salesy words
- First line: must NOT start with "I", "My name is", or "I hope this"
- Max length: 120 words for email, 80 words for LinkedIn DM
- Exactly ONE call to action per message
- CTA must be lightweight: 15-min call, voice note, or quick reply
- No buzzwords: synergy, circle back, touch base, leverage, game-changer, reach out
- Compliments must be specific — no hollow praise
- No emoji unless platform is LinkedIn DM and tone is casual

STRATEGY BY PURPOSE:
- Job/Internship → lead with a specific project + skill, frame ask as learning not just getting hired
- YouTube Collaboration → reference a specific video + the gap your angle fills for their audience
- Mentorship & Advice → open with a precise thing learned from them, ask for direction not shortcuts
- Freelance Project → spot a real problem in their product/channel, offer a specific fix
- Podcast/Interview → pitch a specific angle that fits their show's existing theme
- Research Opportunity → reference their actual paper/work, show you've done the reading
- Networking → find common ground first, make ask about exchange not extraction
- Custom → adapt psychology to whatever the stated purpose describes

Respond ONLY with this JSON, no other text:
{
  "chosen_repo": { "name": "", "reason": "" },
  "repo_candidates": [
    { "name": "", "reason": "", "fit_score": 0 }
  ],
  "versions": [
    { "label": "Warm & Human", "subject": "", "message": "", "why_it_works": "" },
    { "label": "Sharp & Professional", "subject": "", "message": "", "why_it_works": "" },
    { "label": "Bold & Pattern-Interrupt", "subject": "", "message": "", "why_it_works": "" }
  ],
  "follow_ups": [
    { "label": "Follow-up 1 (3 days)", "message": "" },
    { "label": "Follow-up 2 (7 days)", "message": "" }
  ],
  "personalization_tips": ["", "", ""],
  "avoid": ["", ""]
}`;

const ANALYZE_SYSTEM = `You are an opportunity parser and outreach strategist.

Given a pasted job post, collaboration brief, or opportunity text, extract practical data for auto-filling an outreach form.

Rules:
- Respond with JSON only.
- No placeholders or brackets.
- Infer likely purpose and platform from context.
- Keep extracted text concise and usable.

Return exactly:
{
  "suggested_purpose": "",
  "suggested_platform": "LinkedIn DM or Email",
  "suggested_skill": "",
  "recipient_title": "",
  "recipient_company": "",
  "context_clue": "",
  "extra_notes": "",
  "keywords": ["", "", ""],
  "repo_focus_keywords": ["", "", ""],
  "followup_strategy": ""
}`;

const stripFences = (text) => {
  const value = (text || '').trim();
  if (!value.startsWith('```')) {
    return value;
  }

  return value
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/, '')
    .trim();
};

const parseJSON = (text) => {
  const cleaned = stripFences(text);

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');

    if (start >= 0 && end > start) {
      const candidate = cleaned.slice(start, end + 1);
      return JSON.parse(candidate);
    }

    throw new Error('Gemini returned invalid JSON.');
  }
};

const GEMINI_PREFERRED_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro'
];

let resolvedModelCache = null;

const getGeminiText = (payload) => {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  const parts = Array.isArray(candidates[0]?.content?.parts) ? candidates[0].content.parts : [];
  return parts.map((part) => part?.text || '').join('\n').trim();
};

const extractGeminiError = (raw, status) => {
  try {
    const parsed = JSON.parse(raw);
    return parsed?.error?.message || raw || `Gemini API error (${status}).`;
  } catch {
    return raw || `Gemini API error (${status}).`;
  }
};

const normalizeModelName = (modelName) => (modelName || '').replace(/^models\//, '').trim();

const listGeminiModels = async (apiKey) => {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
  const raw = await response.text();

  if (!response.ok) {
    throw new Error(extractGeminiError(raw, response.status));
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.models) ? parsed.models : [];
  } catch {
    throw new Error('Failed to read available Gemini models.');
  }
};

const resolveGeminiModel = async (apiKey) => {
  if (resolvedModelCache) {
    return resolvedModelCache;
  }

  const models = await listGeminiModels(apiKey);
  const supportsGenerate = models.filter((model) => Array.isArray(model?.supportedGenerationMethods) && model.supportedGenerationMethods.includes('generateContent'));
  const availableNames = supportsGenerate.map((model) => normalizeModelName(model?.name));

  for (const preferred of GEMINI_PREFERRED_MODELS) {
    if (availableNames.includes(preferred)) {
      resolvedModelCache = preferred;
      return preferred;
    }
  }

  if (availableNames.length > 0) {
    resolvedModelCache = availableNames[0];
    return availableNames[0];
  }

  throw new Error('No Gemini model with generateContent support is available for this API key.');
};

const callGemini = async ({ apiKey, systemText, userText, maxOutputTokens, temperature }) => {
  const model = await resolveGeminiModel(apiKey);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemText }]
      },
      contents: [{
        role: 'user',
        parts: [{ text: userText }]
      }],
      generationConfig: {
        maxOutputTokens,
        temperature
      }
    })
  });

  const raw = await response.text();

  if (!response.ok) {
    const message = extractGeminiError(raw, response.status);
    if (/not found for api version|is not found/i.test(message)) {
      resolvedModelCache = null;
    }
    throw new Error(message);
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(raw || 'Unexpected response from Gemini API.');
  }
};

export const generateMessages = async (payload) => {
  const { apiKey, ...publicPayload } = payload;

  if (!apiKey) {
    throw new Error('Missing Gemini API key.');
  }

  const USER = JSON.stringify(publicPayload);

  const parsedResponse = await callGemini({
    apiKey,
    systemText: SYSTEM,
    userText: USER,
    maxOutputTokens: 2000,
    temperature: 0.5
  });

  const text = getGeminiText(parsedResponse);

  return parseJSON(text);
};

export const analyzeOpportunity = async ({ apiKey, opportunityText, purpose, platform }) => {
  if (!apiKey) {
    throw new Error('Missing Gemini API key.');
  }

  if (!(opportunityText || '').trim()) {
    throw new Error('Paste an opportunity brief first.');
  }

  const USER = JSON.stringify({
    opportunity_text: opportunityText,
    current_purpose: purpose || '',
    current_platform: platform || ''
  });

  const parsedResponse = await callGemini({
    apiKey,
    systemText: ANALYZE_SYSTEM,
    userText: USER,
    maxOutputTokens: 1000,
    temperature: 0.3
  });

  const text = getGeminiText(parsedResponse);

  return parseJSON(text);
};
