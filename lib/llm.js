// Lightweight Emergent LLM proxy client (OpenAI-compatible)
// Uses fetch — no external SDK needed.
//
// Env vars:
//   EMERGENT_LLM_KEY       (required)
//   EMERGENT_LLM_BASE_URL  (default: https://integrations.emergentagent.com/llm)
//
// The proxy is OpenAI-compatible — POST /chat/completions with bearer auth.

const DEFAULT_BASE_URL = 'https://integrations.emergentagent.com/llm';

/**
 * Call the Emergent LLM proxy with an OpenAI-compatible chat completion.
 * @param {Object} opts
 * @param {string} opts.model       - e.g. "claude-sonnet-4-5-20250929"
 * @param {string} opts.system      - system prompt
 * @param {string} opts.user        - user prompt
 * @param {number} [opts.max_tokens=2000]
 * @param {number} [opts.temperature=0.7]
 * @returns {Promise<{ok:boolean, text?:string, usage?:object, error?:string, status?:number}>}
 */
export async function emergentChat({ model, system, user, max_tokens = 2000, temperature = 0.7 }) {
  const apiKey = process.env.EMERGENT_LLM_KEY;
  if (!apiKey) return { ok: false, error: 'EMERGENT_LLM_KEY non configurée' };
  const baseUrl = process.env.EMERGENT_LLM_BASE_URL || DEFAULT_BASE_URL;

  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user });

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, max_tokens, temperature }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, status: res.status, error: errText.slice(0, 600) };
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    return { ok: true, text, usage: data?.usage || null, raw: data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export const DEFAULT_MODEL_CLAUDE = 'claude-sonnet-4-5-20250929';
