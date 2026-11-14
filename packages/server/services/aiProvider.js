// Minimal client for OpenAI-compatible chat-completions APIs.
//
// Providers are tried in order (Groq first, then OpenAI); a provider is
// skipped when its API key isn't set. Env vars:
//   GROQ_API_KEY   (alias GROK_API_KEY)   GROQ_MODEL   GROQ_ENDPOINT
//   OPENAI_API_KEY                         OPENAI_MODEL OPENAI_ENDPOINT
//
// chatCompletion() never throws: it returns null when no provider is
// configured or every configured provider fails, so callers can fall back.

const REQUEST_TIMEOUT_MS = 20_000;

const readEnv = (name, aliases = []) => {
  for (const key of [name, ...aliases]) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return '';
};

// Read at call time (not module load) so values from .env are picked up
// even though dotenv.config() runs after imports in server.js.
const providerConfigs = () => [
  {
    name: 'groq',
    apiKey: readEnv('GROQ_API_KEY', ['GROK_API_KEY']),
    endpoint: readEnv('GROQ_ENDPOINT', ['GROK_ENDPOINT']) || 'https://api.groq.com/openai/v1/chat/completions',
    model: readEnv('GROQ_MODEL', ['GROK_MODEL']) || 'openai/gpt-oss-120b',
  },
  {
    name: 'openai',
    apiKey: readEnv('OPENAI_API_KEY'),
    endpoint: readEnv('OPENAI_ENDPOINT') || 'https://api.openai.com/v1/chat/completions',
    model: readEnv('OPENAI_MODEL') || 'gpt-4o-mini',
  },
];

export const isAiConfigured = () => providerConfigs().some((provider) => provider.apiKey);

const extractContent = (json) => {
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item === 'string' ? item : item?.text || item?.content || ''))
      .filter(Boolean)
      .join('\n');
  }
  return '';
};

const callProvider = async (provider, { messages, maxTokens, temperature }) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(provider.endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        temperature,
        max_tokens: maxTokens,
        messages,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`AI provider ${provider.name} failed with ${response.status}: ${body.slice(0, 300)}`);
      return null;
    }

    const content = extractContent(await response.json()).trim();
    return content ? { content, provider: provider.name, model: provider.model } : null;
  } catch (error) {
    console.error(`AI provider ${provider.name} error:`, error.name === 'AbortError' ? 'timed out' : error.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
};

export const chatCompletion = async ({ messages, maxTokens = 700, temperature = 0.2 }) => {
  for (const provider of providerConfigs()) {
    if (!provider.apiKey) continue;
    const result = await callProvider(provider, { messages, maxTokens, temperature });
    if (result) return result;
  }
  return null;
};
