'use strict';

// Verifies the specific fallback wired into executeProposalRun: when
// Gemini's own JSON recommendation omits proposal_draft, the persisted
// recommendation falls back to draftProposalMessage()'s deterministic
// template instead of being left blank. Uses executeProposalRun's
// injectable `genAI` option (see gemini.js's own genAI param) to run the
// real tool-calling loop against a fake Gemini client rather than the
// network - no GEMINI_API_KEY needed.

const { executeProposalRun } = require('../src/agents/proposalAgent');
const { draftProposalMessage } = require('../src/agents/scoring');
const agentsRepository = require('../src/modules/agents/repository');
const {
  createTestPool,
  migrateTestDatabase,
  resetTestDatabase,
} = require('./support/database');
const { createJob, createUser } = require('./support/marketplace');

let testPool;

beforeAll(async () => {
  await migrateTestDatabase();
  testPool = createTestPool();
});

afterAll(async () => {
  await testPool.end();
});

beforeEach(async () => {
  await resetTestDatabase(testPool);
});

function fakeModel(steps) {
  let call = 0;
  return { generateContent: vi.fn(() => Promise.resolve(steps[Math.min(call++, steps.length - 1)])) };
}

function fakeGenAI(model) {
  return { getGenerativeModel: vi.fn(() => model) };
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

describe('executeProposalRun draft fallback', () => {
  test('uses draftProposalMessage() when Gemini omits proposal_draft for a recommendation', async () => {
    const customer = await createUser(testPool, { email: 'draft-fallback-customer@fixly-test.local', fullName: 'Customer', role: 'customer' });
    const worker = await createUser(testPool, {
      email: 'draft-fallback-worker@fixly-test.local', fullName: 'Worker Wilma', role: 'worker', primarySkill: 'Plumbing',
    });
    const job = await createJob(testPool, { customerId: customer.id, title: 'Fix a leaking tap' });

    const finalJson = JSON.stringify({
      overall_reasoning: 'Strong skill match for this job.',
      recommendations: [
        {
          job_id: job.id,
          rank: 1,
          score: 0.8,
          ai_rationale: 'Plumbing specialist, good fit for this tap repair.',
          key_strengths: ['Plumbing specialist'],
          // proposal_draft intentionally omitted
        },
      ],
    });

    const model = fakeModel([
      toolCallResponse([{ name: 'get_open_jobs', args: {} }]),
      textResponse(finalJson),
    ]);

    const run = await testPool.query(
      `INSERT INTO agent_runs (user_id, agent_type, status, claimed_at)
       VALUES ($1, 'proposal', 'running', NOW()) RETURNING id, user_id`,
      [worker.id]
    );

    await executeProposalRun(run.rows[0], { genAI: fakeGenAI(model) });

    const recs = await testPool.query(
      `SELECT ar.proposal_draft FROM agent_recommendations ar
       JOIN agent_runs r ON r.id = ar.run_id
       WHERE r.id = $1`,
      [run.rows[0].id]
    );

    expect(recs.rows).toHaveLength(1);
    const workerProfile = await agentsRepository.agentWorker(worker.id);
    const expectedDraft = draftProposalMessage(job, workerProfile);
    expect(recs.rows[0].proposal_draft).toBe(expectedDraft);

    const runRow = await testPool.query('SELECT status FROM agent_runs WHERE id = $1', [run.rows[0].id]);
    expect(runRow.rows[0].status).toBe('awaiting_confirmation');
  });
});
