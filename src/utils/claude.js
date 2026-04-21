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
  "versions": [
    { "label": "Warm & Human", "subject": "", "message": "", "why_it_works": "" },
    { "label": "Sharp & Professional", "subject": "", "message": "", "why_it_works": "" },
    { "label": "Bold & Pattern-Interrupt", "subject": "", "message": "", "why_it_works": "" }
  ],
  "personalization_tips": ["", "", ""],
  "avoid": ["", ""]
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

    throw new Error('Claude returned invalid JSON.');
  }
};

export const generateMessages = async (payload) => {
  const { apiKey, ...publicPayload } = payload;

  if (!apiKey) {
    throw new Error('Missing Anthropic API key.');
  }

  const USER = JSON.stringify(publicPayload);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: 'user', content: USER }]
    })
  });

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(raw || `Anthropic API error (${response.status}).`);
  }

  let parsedResponse;
  try {
    parsedResponse = JSON.parse(raw);
  } catch {
    throw new Error(raw || 'Unexpected response from Anthropic API.');
  }

  const text = Array.isArray(parsedResponse.content)
    ? parsedResponse.content.map((part) => part.text || '').join('\n')
    : '';

  return parseJSON(text || raw);
};
