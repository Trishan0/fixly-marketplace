'use strict';

const { matchAgentOutputSchema, proposalAgentOutputSchema } = require('../src/agents/schemas');

const workerId = '11111111-1111-4111-8111-111111111111';
const jobId = '22222222-2222-4222-8222-222222222222';

describe('matchAgentOutputSchema', () => {
  test('accepts a well-formed response', () => {
    const result = matchAgentOutputSchema.safeParse({
      overall_reasoning: 'Ranked by skill fit.',
      recommendations: [
        { worker_id: workerId, rank: 1, score: 0.9, ai_rationale: 'Great fit', key_strengths: ['skill'] },
      ],
    });
    expect(result.success).toBe(true);
  });

  test('rejects a recommendation missing worker_id', () => {
    const result = matchAgentOutputSchema.safeParse({
      overall_reasoning: 'x',
      recommendations: [{ rank: 1, score: 0.9, ai_rationale: 'x' }],
    });
    expect(result.success).toBe(false);
  });

  test('rejects a non-uuid worker_id', () => {
    const result = matchAgentOutputSchema.safeParse({
      overall_reasoning: 'x',
      recommendations: [{ worker_id: 'not-a-uuid', rank: 1, score: 0.5, ai_rationale: 'x' }],
    });
    expect(result.success).toBe(false);
  });

  test('rejects an out-of-range score', () => {
    const result = matchAgentOutputSchema.safeParse({
      overall_reasoning: 'x',
      recommendations: [{ worker_id: workerId, rank: 1, score: 1.5, ai_rationale: 'x' }],
    });
    expect(result.success).toBe(false);
  });

  test('defaults key_strengths to an empty array when omitted', () => {
    const result = matchAgentOutputSchema.safeParse({
      overall_reasoning: 'x',
      recommendations: [{ worker_id: workerId, rank: 1, score: 0.5, ai_rationale: 'x' }],
    });
    expect(result.success).toBe(true);
    expect(result.data.recommendations[0].key_strengths).toEqual([]);
  });
});

describe('proposalAgentOutputSchema', () => {
  test('accepts a well-formed response with an optional proposal_draft', () => {
    const result = proposalAgentOutputSchema.safeParse({
      overall_reasoning: 'Ranked by fit.',
      recommendations: [
        { job_id: jobId, rank: 1, score: 0.8, ai_rationale: 'Good match', key_strengths: [], proposal_draft: 'Hi there' },
      ],
    });
    expect(result.success).toBe(true);
  });

  test('rejects a recommendation missing job_id', () => {
    const result = proposalAgentOutputSchema.safeParse({
      overall_reasoning: 'x',
      recommendations: [{ rank: 1, score: 0.5, ai_rationale: 'x' }],
    });
    expect(result.success).toBe(false);
  });

  test('rejects a non-positive rank', () => {
    const result = proposalAgentOutputSchema.safeParse({
      overall_reasoning: 'x',
      recommendations: [{ job_id: jobId, rank: 0, score: 0.5, ai_rationale: 'x' }],
    });
    expect(result.success).toBe(false);
  });
});
