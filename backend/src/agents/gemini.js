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
 * Run a Gemini agent with tool calling.
 *
 * @param {Object} opts
 * @param {string} opts.systemInstruction  — system prompt
 * @param {string} opts.userPrompt         — initial user message
 * @param {Object[]} opts.tools            — Gemini FunctionDeclaration array
 * @param {Object} opts.toolHandlers       — { toolName: async (args) => result }
 * @param {Function} [opts.onStep]         — callback(stepInfo) after each tool call
 * @param {number} [opts.maxIterations=12] — safety cap on tool-call rounds
 * @returns {{ text: string, steps: Object[] }}
 */
async function runGeminiAgent({ systemInstruction, userPrompt, tools, toolHandlers, onStep, maxIterations = 12 }) {
  const genAI = getGenAI();

  const MODEL_NAMES = ['gemini-flash-latest', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];
  let model = null;
  let lastErr = null;

  for (const mName of MODEL_NAMES) {
    try {
      model = genAI.getGenerativeModel({
        model: mName,
        systemInstruction,
        tools: [{ functionDeclarations: tools }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
        },
      });
      break;
    } catch (err) {
      lastErr = err;
    }
  }

  if (!model) throw lastErr || new Error('Could not initialize Gemini model');

  const contents = [
    { role: 'user', parts: [{ text: userPrompt }] }
  ];
  const steps = [];

  for (let i = 0; i < maxIterations; i++) {
    const res = await model.generateContent({ contents });
    const candidate = res.response.candidates?.[0];

    if (!candidate) throw new Error('No candidate returned from Gemini');

    const calls = res.response.functionCalls();

    if (!calls || calls.length === 0) {
      // Gemini finished reasoning — return final text
      return { text: res.response.text(), steps };
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

  throw new Error('Gemini agent exceeded max iterations without finishing');
}

/**
 * Parse JSON from Gemini's text response.
 */
function parseJsonFromText(text) {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenceMatch ? fenceMatch[1] : text;
  return JSON.parse(raw.trim());
}

module.exports = { runGeminiAgent, parseJsonFromText, isGeminiKeyConfigured };
