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

describe('proposal agent guardrails', () => {
  const { categoryId } = require('./support/marketplace');
  const { confirmProposalAgent } = require('../src/modules/marketplace/service');
  const marketplaceRepository = require('../src/modules/marketplace/repository');

  async function proposalRun(workerId) {
    return (await testPool.query(
      "INSERT INTO agent_runs (user_id, agent_type, status, claimed_at) VALUES ($1, 'proposal', 'running', NOW()) RETURNING id, user_id",
      [workerId],
    )).rows[0];
  }

  test('offers only open jobs in the worker\'s trade that they haven\'t applied or been invited to', async () => {
    const customer = await createUser(testPool, { email: 'pool-customer@fixly-test.local', fullName: 'Customer', role: 'customer' });
    const worker = await createUser(testPool, { email: 'pool-worker@fixly-test.local', fullName: 'Pool Worker', role: 'worker', primarySkill: 'Plumbing', district: 'Kandy' });
    const kandyPlumbing = await createJob(testPool, { customerId: customer.id, title: 'Kandy tap', district: 'Kandy' });
    const colomboPlumbing = await createJob(testPool, { customerId: customer.id, title: 'Colombo tap', district: 'Colombo' });
    await createJob(testPool, { customerId: customer.id, title: 'Paint a wall', district: 'Kandy', categoryId: await categoryId(testPool, 'Painting') });
    const invitedJob = await createJob(testPool, { customerId: customer.id, title: 'Invited tap', district: 'Kandy' });
    await testPool.query('INSERT INTO invites (job_id, customer_id, worker_id) VALUES ($1, $2, $3)', [invitedJob.id, customer.id, worker.id]);

    const inDistrict = await marketplaceRepository.listAgentOpenJobsForWorker(worker.id, 60, { district: 'Kandy' });
    expect(inDistrict.map(j => j.id)).toEqual([kandyPlumbing.id]);
    const everywhere = await marketplaceRepository.listAgentOpenJobsForWorker(worker.id, 60);
    expect(everywhere.map(j => j.id).sort()).toEqual([kandyPlumbing.id, colomboPlumbing.id].sort());
  });

  test('replaces drafts with invented claims, keeps truthful ones, and caps the list at 5', async () => {
    const customer = await createUser(testPool, { email: 'guard-customer@fixly-test.local', fullName: 'Customer', role: 'customer' });
    const worker = await createUser(testPool, { email: 'guard-worker@fixly-test.local', fullName: 'New Plumber', role: 'worker', primarySkill: 'Plumbing' });
    const jobs = [];
    for (let i = 0; i < 6; i += 1) jobs.push(await createJob(testPool, { customerId: customer.id, title: `Tap repair ${i}` }));

    const drafts = [
      'Hi, I have 10 years of experience fixing taps like this.',
      'Hi, I can come today and fix this right away.',
      'Hi, call me on 0771234567 to talk about the tap.',
      'Hi, I fix leaking taps and would like to help with this one.',
      'Hi, I read your description and this is the kind of plumbing work I do.',
      'Hi, extra recommendation over the cap.',
    ];
    const finalJson = JSON.stringify({
      overall_reasoning: 'Plumbing jobs that fit.',
      recommendations: jobs.map((job, i) => ({ job_id: job.id, rank: i + 1, score: 0.5, ai_rationale: 'Fits', proposal_draft: drafts[i] })),
    });
    const model = fakeModel([toolCallResponse([{ name: 'get_open_jobs', args: {} }]), textResponse(finalJson)]);
    const run = await proposalRun(worker.id);

    await executeProposalRun(run, { genAI: fakeGenAI(model) });

    const recs = (await testPool.query('SELECT entity_id, proposal_draft FROM agent_recommendations WHERE run_id = $1 ORDER BY rank', [run.id])).rows;
    expect(recs).toHaveLength(5);
    const profile = await agentsRepository.agentWorker(worker.id);
    const template = (job) => draftProposalMessage(job, profile);
    expect(recs[0].proposal_draft).toBe(template(jobs[0]));
    expect(recs[1].proposal_draft).toBe(template(jobs[1]));
    expect(recs[2].proposal_draft).toBe(template(jobs[2]));
    expect(recs[3].proposal_draft).toBe(drafts[3]);
    expect(recs[4].proposal_draft).toBe(drafts[4]);
    const step = (await testPool.query("SELECT output_json FROM agent_run_steps WHERE run_id = $1 AND step_name = 'draft_replaced'", [run.id])).rows[0];
    expect(step.output_json.count).toBe(3);
  });

  test('confirming needs a price (or inspection) and availability for each job, at most 3 at a time', async () => {
    const customer = await createUser(testPool, { email: 'confirm-customer@fixly-test.local', fullName: 'Customer', role: 'customer' });
    const worker = await createUser(testPool, { email: 'confirm-worker@fixly-test.local', fullName: 'Confirm Worker', role: 'worker', primarySkill: 'Plumbing' });
    const jobs = [];
    for (let i = 0; i < 4; i += 1) jobs.push(await createJob(testPool, { customerId: customer.id, title: `Confirm job ${i}` }));
    const run = await proposalRun(worker.id);
    await testPool.query("UPDATE agent_runs SET status = 'awaiting_confirmation' WHERE id = $1", [run.id]);
    for (const [i, job] of jobs.entries()) {
      await testPool.query("INSERT INTO agent_recommendations (run_id, entity_type, entity_id, score, rank) VALUES ($1, 'job', $2, 0.5, $3)", [run.id, job.id, i + 1]);
    }
    const confirm = (selections) => confirmProposalAgent({ runId: run.id, worker: { id: worker.id, full_name: 'Confirm Worker' }, selections });

    await expect(confirm([{ job_id: jobs[0].id, message: 'Hi', availability: 'Tomorrow' }])).rejects.toMatchObject({ status: 400 });
    await expect(confirm([{ job_id: jobs[0].id, message: 'Hi', proposed_price: '3000' }])).rejects.toMatchObject({ status: 400 });
    await expect(confirm(jobs.map(job => ({ job_id: job.id, message: 'Hi', proposed_price: '3000', availability: 'Tomorrow' })))).rejects.toMatchObject({ status: 400 });

    const result = await confirm([
      { job_id: jobs[0].id, message: 'Hi', proposed_price: '3000', availability: 'Tomorrow morning' },
      { job_id: jobs[1].id, message: 'Hi', inspection_needed: true, availability: 'Saturday' },
    ]);
    expect(result.results.map(r => r.status)).toEqual(['submitted', 'submitted']);
    const saved = (await testPool.query('SELECT proposed_price, inspection_needed, availability FROM proposals WHERE worker_id = $1 ORDER BY proposed_price NULLS LAST', [worker.id])).rows;
    expect(saved).toEqual([
      { proposed_price: '3000.00', inspection_needed: false, availability: 'Tomorrow morning' },
      { proposed_price: null, inspection_needed: true, availability: 'Saturday' },
    ]);
  });
});
