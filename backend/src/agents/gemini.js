/**
 * gemini.js — Gemini API client with agentic tool-calling loop.
 *
 * Uses explicit contents history array with role: 'user' for tool responses
 * to ensure 100% compatibility with Google Generative AI API v1beta.
 */

const dns = require('dns');
// Force IPv4 first resolution in Node 22 to prevent undici fetch ETIMEDOUT
dns.setDefaultResultOrder('ipv4first');

const { GoogleGenerativeAI } = require('@google/generative-ai');

// gemini-2.5-flash was retired by Google ("no longer available to new
// users") and now 404s outright - caught live by the eval harness
// (agents-eval.integration.test.js). gemini-flash-latest is an alias that
// tracks whatever's current, so it leads the list to reduce how often this
// needs a manual bump again; gemini-3.6-flash is what Google's own error
// pointed at as of this fix.
//
// Availability shifts by the hour: under load Google returns 503 "high
// demand" for the newest models while older and lite ones still answer
// in a second or two. So the list mixes generations, ends on a lite model,
// and GEMINI_MODELS (comma-separated) overrides it without a deploy.
const DEFAULT_MODEL_NAMES = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-lite-latest'];
const RETRY_BACKOFF_MS = 250;
// Each model call gives up after this long, so one overloaded model can't
// stall a run; failover moves on to the next.
const DEFAULT_TIMEOUT_MS = 30_000;

/** The models to try, in order: an explicit list, GEMINI_MODELS, or the default. */
function modelNames(override) {
  const configured = (process.env.GEMINI_MODELS || '').split(',').map(name => name.trim()).filter(Boolean);
  const names = override?.length ? override : configured.length ? configured : DEFAULT_MODEL_NAMES;
  return [...new Set(names)];
}

// The model that last answered, remembered per model list for a while, so
// the next run starts there instead of waiting out an overloaded model
// again. Per list, so a small task's quick lite model never becomes the
// match agent's first choice.
const PREFERENCE_TTL_MS = 10 * 60 * 1000;
const preferredModels = new Map(); // list key -> { name, at }
function preferredModelFor(key) {
  const entry = preferredModels.get(key);
  return entry && Date.now() - entry.at < PREFERENCE_TTL_MS ? entry.name : null;
}
function resetModelPreference() { preferredModels.clear(); }

function isGeminiKeyConfigured() {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key !== 'YOUR_KEY_HERE' && key.trim().length > 10);
}

let _genAI = null;
function getGenAI() {
  if (!_genAI) {
    if (!isGeminiKeyConfigured()) {
      throw new Error('GEMINI_API_KEY is missing or invalid in backend/.env');
    }
    _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim());
  }
  return _genAI;
}

/**
 * Error thrown by the Gemini call layer, tagged with a coarse classification
 * so callers can decide whether to retry, fall back, or surface the error.
 */
class GeminiAgentError extends Error {
  constructor(message, classification, cause) {
    super(message);
    this.name = 'GeminiAgentError';
    this.classification = classification;
    this.cause = cause;
  }
}

/**
 * Thrown when the user stops a run while the agent is still working. Not a
 * Gemini failure: callers must not fall back to a degraded result for it.
 */
class AgentRunCancelledError extends Error {
  constructor() {
    super('Agent run was cancelled');
    this.name = 'AgentRunCancelledError';
  }
}

/**
 * Classify an error thrown by the @google/generative-ai SDK into a coarse
 * bucket. `invalid_key` is treated as non-retryable everywhere else in this
 * file since it will fail identically against every model in MODEL_NAMES.
 */
function classifyGeminiError(err) {
  const status = err?.status ?? err?.response?.status;
  if (status === 429) return 'rate_limit';
  if (status === 401 || status === 403) return 'invalid_key';
  if (typeof status === 'number' && status >= 500) return 'server_error';

  const code = err?.code ?? err?.cause?.code;
  if (['ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', 'ECONNREFUSED'].includes(code)) return 'network';
  if (/fetch failed|timeout|network/i.test(err?.message || '')) return 'network';

  return 'other';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run a Gemini agent with tool calling.
 *
 * @param {Object} opts
 * @param {string} opts.systemInstruction  — system prompt
 * @param {string} opts.userPrompt         — initial user message
 * @param {Object[]} opts.tools            — Gemini FunctionDeclaration array
 * @param {Object} opts.toolHandlers       — { toolName: async (args) => result }
 * @param {Function} [opts.onStep]         — callback(stepInfo) after each tool call
 * @param {number} [opts.maxIterations=12] — safety cap on tool-call rounds
 * @param {{ getGenerativeModel: Function }} [opts.genAI] — injectable SDK client, for tests; defaults to the real Gemini client
 * @returns {{ text: string, steps: Object[], telemetry: Object }}
 */
// `shouldStop` is checked before every model call, so a run the user
// stopped ends within one step instead of finishing (and spending tokens).
// With no `tools` it's a single plain generation; `timeoutMs` bounds each
// model call (the SDK has no default timeout).
// `models` overrides the model list for one call (e.g. fast lite models
// for a small task).
async function runGeminiAgent({ systemInstruction, userPrompt, tools = [], toolHandlers = {}, onStep, shouldStop, maxIterations = 12, timeoutMs = DEFAULT_TIMEOUT_MS, models: modelOverride, genAI = getGenAI() }) {
  const startedAt = Date.now();

  const models = modelNames(modelOverride).map(name => {
    try {
      return {
        name,
        model: genAI.getGenerativeModel({
          model: name,
          systemInstruction,
          ...(tools.length > 0 ? { tools: [{ functionDeclarations: tools }] } : {}),
          generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
        }, timeoutMs ? { timeout: timeoutMs } : undefined),
      };
    } catch {
      return null;
    }
  }).filter(Boolean);

  if (models.length === 0) throw new GeminiAgentError('Could not initialize any Gemini model', 'other');

  const listKey = models.map(m => m.name).join(',');
  let modelIndex = Math.max(0, models.findIndex(m => m.name === preferredModelFor(listKey)));
  let modelUsed = models[modelIndex].name;

  // Try each model in turn for a single generateContent call, backing off
  // between attempts. Sticks with whichever model last succeeded so later
  // iterations don't keep re-probing a model that already failed.
  async function generateWithFailover(contents) {
    let lastErr;
    for (let attempt = 0; attempt < models.length; attempt++) {
      const idx = (modelIndex + attempt) % models.length;
      const { name, model } = models[idx];
      try {
        const res = await model.generateContent({ contents });
        modelIndex = idx;
        modelUsed = name;
        preferredModels.set(listKey, { name, at: Date.now() });
        return res;
      } catch (err) {
        lastErr = err;
        const classification = classifyGeminiError(err);
        console.warn(`[gemini] model "${name}" failed (${classification}): ${err.message}`);
        if (classification === 'invalid_key') {
          throw new GeminiAgentError('Gemini API key was rejected', classification, err);
        }
        if (attempt < models.length - 1) await sleep(RETRY_BACKOFF_MS * (attempt + 1));
      }
    }
    throw new GeminiAgentError(
      `All Gemini models failed: ${lastErr?.message}`,
      classifyGeminiError(lastErr),
      lastErr
    );
  }

  const contents = [
    { role: 'user', parts: [{ text: userPrompt }] }
  ];
  const steps = [];
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;

  function buildTelemetry(iterationCount) {
    return {
      modelUsed,
      iterationCount,
      promptTokens,
      completionTokens,
      totalTokens,
      latencyMs: Date.now() - startedAt,
    };
  }

  for (let i = 0; i < maxIterations; i++) {
    if (shouldStop && await shouldStop()) throw new AgentRunCancelledError();
    const res = await generateWithFailover(contents);
    const candidate = res.response.candidates?.[0];

    if (!candidate) throw new GeminiAgentError('No candidate returned from Gemini', 'other');

    const usage = res.response.usageMetadata;
    if (usage) {
      promptTokens += usage.promptTokenCount || 0;
      completionTokens += usage.candidatesTokenCount || 0;
      totalTokens += usage.totalTokenCount || 0;
    }

    const calls = res.response.functionCalls();

    if (!calls || calls.length === 0) {
      // Gemini finished reasoning — return final text
      return { text: res.response.text(), steps, telemetry: buildTelemetry(i + 1) };
    }

    // Append model's response (with functionCall parts) to history
    contents.push(candidate.content);

    // Execute all requested tools
    const functionResponseParts = [];

    for (const call of calls) {
      const handler = toolHandlers[call.name];
      const stepInfo = { stepName: call.name, input: call.args };

      let output;
      if (!handler) {
        output = { error: `Unknown tool: ${call.name}` };
      } else {
        try {
          output = await handler(call.args);
        } catch (err) {
          output = { error: err.message };
        }
      }

      stepInfo.output = output;
      steps.push(stepInfo);
      onStep?.(stepInfo);

      functionResponseParts.push({
        functionResponse: {
          name: call.name,
          response: output && typeof output === 'object' ? output : { result: output },
        },
      });
    }

    // Append tool responses turn (role: 'user') to history
    contents.push({
      role: 'user',
      parts: functionResponseParts,
    });
  }

  throw new GeminiAgentError('Gemini agent exceeded max iterations without finishing', 'other');
}

/**
 * Parse JSON from Gemini's text response.
 */
function parseJsonFromText(text) {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenceMatch ? fenceMatch[1] : text;
  return JSON.parse(raw.trim());
}

module.exports = { runGeminiAgent, parseJsonFromText, isGeminiKeyConfigured, GeminiAgentError, AgentRunCancelledError, classifyGeminiError, modelNames, resetModelPreference };
