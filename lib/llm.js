// LLM client — Anthropic direct (priority) + Emergent fallback
// Uses fetch only. No SDK.
//
// Env vars (priority order):
//   ANTHROPIC_API_KEY   — direct Anthropic API (cheaper, recommended)
//   EMERGENT_LLM_KEY    — Emergent proxy (fallback)

const DEFAULT_EMERGENT_BASE_URL = 'https://integrations.emergentagent.com/llm';
const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';

export const DEFAULT_MODEL_CLAUDE = 'claude-sonnet-4-5-20250929';

/**
 * Direct Anthropic API call (Messages API).
 */
async function anthropicChat({ model, system, user, max_tokens = 2000, temperature = 0.7 }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: 'ANTHROPIC_API_KEY non configurée', skip: true };
  try {
    const body = {
      model,
      max_tokens,
      temperature,
      messages: [{ role: 'user', content: user }],
    };
    if (system) body.system = system;
    const res = await fetch(`${ANTHROPIC_BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, status: res.status, error: errText.slice(0, 600), source: 'anthropic_direct' };
    }
    const data = await res.json();
    const text = (data?.content || []).map(b => b.text || '').join('');
    return {
      ok: true,
      text,
      usage: data?.usage ? {
        prompt_tokens: data.usage.input_tokens,
        completion_tokens: data.usage.output_tokens,
        total_tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
      } : null,
      raw: data,
      source: 'anthropic_direct',
    };
  } catch (e) {
    return { ok: false, error: e.message, source: 'anthropic_direct' };
  }
}

/**
 * Emergent proxy fallback (OpenAI-compatible)
 */
async function emergentChatRaw({ model, system, user, max_tokens = 2000, temperature = 0.7 }) {
  const apiKey = process.env.EMERGENT_LLM_KEY;
  if (!apiKey) return { ok: false, error: 'EMERGENT_LLM_KEY non configurée', skip: true };
  const baseUrl = process.env.EMERGENT_LLM_BASE_URL || DEFAULT_EMERGENT_BASE_URL;
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user });
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, max_tokens, temperature }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, status: res.status, error: errText.slice(0, 600), source: 'emergent_proxy' };
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    return { ok: true, text, usage: data?.usage || null, raw: data, source: 'emergent_proxy' };
  } catch (e) {
    return { ok: false, error: e.message, source: 'emergent_proxy' };
  }
}

/**
 * Main entry: tries Anthropic direct first, then falls back to Emergent.
 * Inclut un retry automatique (1 tentative supplémentaire avec backoff 1s) en cas d'échec
 * réseau / timeout / erreur 5xx du provider, pour rendre la génération IA plus robuste.
 * Returns same shape regardless of source.
 */
export async function emergentChat(opts) {
  const isRetriable = (r) => {
    if (!r || r.ok) return false;
    if (r.skip) return false;
    // Erreurs réseau (fetch failed) ou timeouts ou 5xx du provider
    const msg = String(r.error || '').toLowerCase();
    if (msg.includes('timeout') || msg.includes('aborted') || msg.includes('fetch failed') || msg.includes('econn') || msg.includes('socket')) return true;
    if (r.status && r.status >= 500) return true;
    if (r.status === 429) return true; // rate-limit
    return false;
  };

  const tryOnce = async () => {
    if (process.env.ANTHROPIC_API_KEY) {
      const r = await anthropicChat(opts);
      if (r.ok) return r;
      if (!r.skip) console.warn('[llm] Anthropic direct failed → fallback Emergent:', String(r.error || '').slice(0, 200));
    }
    return emergentChatRaw(opts);
  };

  let result = await tryOnce();
  if (isRetriable(result)) {
    console.warn('[llm] Retry IA après échec retriable :', String(result.error || '').slice(0, 200));
    await new Promise(res => setTimeout(res, 1000));
    const second = await tryOnce();
    // Si 2e tentative ok → renvoyer, sinon renvoyer la dernière erreur
    if (second.ok) return second;
    return second;
  }
  return result;
}

/**
 * Returns which provider would be used right now.
 */
export function getActiveLlmProvider() {
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic_direct';
  if (process.env.EMERGENT_LLM_KEY) return 'emergent_proxy';
  return 'none';
}
