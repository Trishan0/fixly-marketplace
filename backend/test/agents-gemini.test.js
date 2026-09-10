'use strict';

// Unit tests for the ReAct-style tool-calling loop in src/agents/gemini.js.
// runGeminiAgent accepts an injectable `genAI` client, so these tests supply
// a fake one directly instead of mocking the @google/generative-ai package
// (which native require() calls bypass Vitest's mock registry for in this
// project's CommonJS setup). They exercise the loop's own control flow
// (termination, tool dispatch, model failover, max-iteration guard) rather
// than any real Gemini call.

const { runGeminiAgent, GeminiAgentError } = require('../src/agents/gemini');

function makeModel(generateContentImpl) {
  return { generateContent: vi.fn(generateContentImpl) };
}

function fakeGenAI(models) {
  const getGenerativeModel = vi.fn();
  for (const model of models) getGenerativeModel.mockReturnValueOnce(model);
  // Once all queued models are consumed, keep returning the last one.
  getGenerativeModel.mockReturnValue(models[models.length - 1]);
  return { getGenerativeModel };
}

function textResponse(text) {
  return {
    response: {
      candidates: [{ content: { role: 'model', parts: [{ text }] } }],
      functionCalls: () => null,
      text: () => text,
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
    },
  };
}

function toolCallResponse(calls) {
  return {
    response: {
      candidates: [{ content: { role: 'model', parts: calls.map(c => ({ functionCall: c })) } }],
      functionCalls: () => calls,
      text: () => '',
      usageMetadata: { promptTokenCount: 8, candidatesTokenCount: 4, totalTokenCount: 12 },
    },
  };
}

describe('runGeminiAgent', () => {
  test('terminates as soon as the model stops requesting tools', async () => {
    const model = makeModel(() => Promise.resolve(textResponse('final answer')));

    const result = await runGeminiAgent({
      systemInstruction: 'sys', userPrompt: 'go', tools: [], toolHandlers: {}, genAI: fakeGenAI([model]),
    });

    expect(result.text).toBe('final answer');
    expect(result.steps).toEqual([]);
    expect(result.telemetry.iterationCount).toBe(1);
    expect(model.generateContent).toHaveBeenCalledTimes(1);
  });

  test('executes a multi-round tool call before finishing', async () => {
    let call = 0;
    const model = makeModel(() => {
      call += 1;
      return call === 1
        ? Promise.resolve(toolCallResponse([{ name: 'get_thing', args: { id: 1 } }]))
        : Promise.resolve(textResponse('done'));
    });

    const handler = vi.fn().mockResolvedValue({ value: 42 });
    const onStep = vi.fn();

    const result = await runGeminiAgent({
      systemInstruction: 'sys', userPrompt: 'go', tools: [], toolHandlers: { get_thing: handler },
      onStep, genAI: fakeGenAI([model]),
    });

    expect(handler).toHaveBeenCalledWith({ id: 1 });
    expect(onStep).toHaveBeenCalledTimes(1);
    expect(result.text).toBe('done');
    expect(result.steps).toHaveLength(1);
    expect(result.telemetry.iterationCount).toBe(2);
  });

  test('an unknown tool name yields an error function response instead of crashing', async () => {
    let call = 0;
    const model = makeModel(() => {
      call += 1;
      return call === 1
        ? Promise.resolve(toolCallResponse([{ name: 'nonexistent_tool', args: {} }]))
        : Promise.resolve(textResponse('recovered'));
    });

    const result = await runGeminiAgent({
      systemInstruction: 'sys', userPrompt: 'go', tools: [], toolHandlers: {}, genAI: fakeGenAI([model]),
    });

    expect(result.steps[0].output).toEqual({ error: 'Unknown tool: nonexistent_tool' });
    expect(result.text).toBe('recovered');
  });

  test('fails over to the next model name when generateContent throws a retryable error', async () => {
    const failingModel = makeModel(() =>
      Promise.reject(Object.assign(new Error('rate limited'), { status: 429 })));
    const workingModel = makeModel(() => Promise.resolve(textResponse('recovered via fallback model')));

    const result = await runGeminiAgent({
      systemInstruction: 'sys', userPrompt: 'go', tools: [], toolHandlers: {}, maxIterations: 3,
      genAI: fakeGenAI([failingModel, workingModel, workingModel]),
    });

    expect(result.text).toBe('recovered via fallback model');
    expect(result.telemetry.modelUsed).not.toBe('gemini-2.5-flash');
    expect(failingModel.generateContent).toHaveBeenCalledTimes(1);
  });

  test('does not retry other models when the SDK reports an invalid API key', async () => {
    const model = makeModel(() =>
      Promise.reject(Object.assign(new Error('key invalid'), { status: 401 })));

    await expect(runGeminiAgent({
      systemInstruction: 'sys', userPrompt: 'go', tools: [], toolHandlers: {}, genAI: fakeGenAI([model]),
    })).rejects.toMatchObject({ classification: 'invalid_key' });

    expect(model.generateContent).toHaveBeenCalledTimes(1);
  });

  test('throws a GeminiAgentError after exceeding maxIterations without a final answer', async () => {
    const model = makeModel(() => Promise.resolve(toolCallResponse([{ name: 'noop', args: {} }])));

    await expect(runGeminiAgent({
      systemInstruction: 'sys', userPrompt: 'go', tools: [], toolHandlers: { noop: async () => ({}) },
      maxIterations: 2, genAI: fakeGenAI([model]),
    })).rejects.toThrow(/exceeded max iterations/);
  });

  test('GeminiAgentError instances carry their classification', () => {
    const err = new GeminiAgentError('boom', 'network', new Error('cause'));
    expect(err).toBeInstanceOf(Error);
    expect(err.classification).toBe('network');
  });
});
