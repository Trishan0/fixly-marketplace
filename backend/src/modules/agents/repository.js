'use strict';

const { sql } = require('drizzle-orm');
const { db } = require('../../db/drizzle');
const { instrumentRepository } = require('../../observability/request-context');

/** @param {import('drizzle-orm').SQL} statement @returns {Promise<any[]>} */
async function rows(statement) {
  return /** @type {any[]} */ ((await db.execute(statement)).rows);
}

/** @param {import('drizzle-orm').SQL} statement @returns {Promise<any | null>} */
async function one(statement) {
  return (await rows(statement))[0] || null;
}

/** @param {string} userId @param {string} jobId */
function activeMatch(userId, jobId) {
  return one(sql`SELECT id,status FROM agent_runs WHERE user_id=${userId} AND job_id=${jobId} AND agent_type='match' AND status IN ('pending','running','awaiting_confirmation') ORDER BY created_at DESC LIMIT 1`);
}

/** @param {string} userId */
function activeProposal(userId) {
  return one(sql`SELECT id,status FROM agent_runs WHERE user_id=${userId} AND agent_type='proposal' AND status IN ('pending','running','awaiting_confirmation') ORDER BY created_at DESC LIMIT 1`);
}

/** @param {string} runId @param {string} userId */
function runDetail(runId, userId) {
  return one(sql`SELECT id,user_id,agent_type,objective,plan_json,status,job_id,created_at,completed_at FROM agent_runs WHERE id=${runId} AND user_id=${userId}`);
}

/** @param {string} runId */
function runSteps(runId) {
  return rows(sql`SELECT id,step_index,step_name,input_json,output_json,decision,created_at FROM agent_run_steps WHERE run_id=${runId} ORDER BY step_index LIMIT 100`);
}

/** @param {string} runId */
function runRecommendations(runId) {
  return rows(sql`SELECT ar.*,CASE ar.entity_type WHEN 'worker' THEN (SELECT json_build_object('id',u.id,'full_name',u.full_name,'district',u.district,'profile_photo',u.profile_photo,'is_nic_verified',u.is_nic_verified,'avg_rating',wp.avg_rating,'total_jobs_done',wp.total_jobs_done,'primary_skill',wp.primary_skill,'starting_price',wp.starting_price) FROM users u LEFT JOIN worker_profiles wp ON wp.user_id=u.id WHERE u.id=ar.entity_id) WHEN 'job' THEN (SELECT json_build_object('id',j.id,'title',j.title,'district',j.district,'urgency',j.urgency,'pricing_mode',j.pricing_mode,'fixed_budget',j.fixed_budget,'category_name',c.name,'status',j.status) FROM jobs j LEFT JOIN categories c ON c.id=j.category_id WHERE j.id=ar.entity_id) END AS entity_data FROM agent_recommendations ar WHERE ar.run_id=${runId} ORDER BY ar.rank LIMIT 100`);
}

/** @param {string} userId @param {string | null} type @param {number} limit */
function history(userId, type, limit) {
  return rows(sql`SELECT ar.id,ar.agent_type,ar.objective,ar.status,ar.job_id,ar.created_at,ar.completed_at,(SELECT title FROM jobs WHERE id=ar.job_id) AS job_title,(SELECT COUNT(*)::int FROM agent_recommendations WHERE run_id=ar.id) AS recommendation_count FROM agent_runs ar WHERE ar.user_id=${userId} AND (${type}::text IS NULL OR ar.agent_type=${type}) ORDER BY ar.created_at DESC LIMIT ${limit}`);
}

/** @param {string} id @param {string} userId */
function cancelRun(id, userId) {
  return one(sql`UPDATE agent_runs SET status='cancelled',completed_at=NOW() WHERE id=${id} AND user_id=${userId} AND status IN ('pending','running','awaiting_confirmation') RETURNING id`);
}

/** @param {string} userId @param {string} scope @param {string} key */
function memory(userId, scope, key) {
  return one(sql`SELECT value_json FROM agent_memories WHERE user_id=${userId} AND scope=${scope} AND key=${key}`);
}

/** @param {string} userId @param {string} scope */
function memories(userId, scope) {
  return rows(sql`SELECT key,value_json FROM agent_memories WHERE user_id=${userId} AND scope=${scope}`);
}

/** @param {string} userId @param {string} scope @param {string} key @param {unknown} value */
function upsertMemory(userId, scope, key, value) {
  return one(sql`INSERT INTO agent_memories (user_id,scope,key,value_json,updated_at) VALUES (${userId},${scope},${key},${JSON.stringify(value)},NOW()) ON CONFLICT (user_id,scope,key) DO UPDATE SET value_json=EXCLUDED.value_json,updated_at=NOW() RETURNING key`);
}

/** @param {string} userId @param {'match' | 'proposal'} type @param {string} objective @param {string | null} [jobId] */
function createRun(userId, type, objective, jobId = null) {
  return one(sql`INSERT INTO agent_runs (user_id,agent_type,objective,status,job_id) VALUES (${userId},${type},${objective},'running',${jobId}) RETURNING id`);
}

/** @param {string} runId @param {number} index @param {string} name @param {unknown} input @param {unknown} output @param {string | null} decision */
function addStep(runId, index, name, input, output, decision) {
  return one(sql`INSERT INTO agent_run_steps (run_id,step_index,step_name,input_json,output_json,decision) VALUES (${runId},${index},${name},${JSON.stringify(input)},${JSON.stringify(output)},${decision}) RETURNING id`);
}

/** @param {string} runId @param {'worker' | 'job'} type @param {string} entityId @param {number} score @param {unknown} factors @param {string} rationale @param {number} rank */
function addRecommendation(runId, type, entityId, score, factors, rationale, rank) {
  return one(sql`INSERT INTO agent_recommendations (run_id,entity_type,entity_id,score,factors_json,rationale,rank) VALUES (${runId},${type},${entityId},${score},${JSON.stringify(factors)},${rationale},${rank}) ON CONFLICT (run_id,entity_type,entity_id) DO UPDATE SET score=EXCLUDED.score,factors_json=EXCLUDED.factors_json,rationale=EXCLUDED.rationale,rank=EXCLUDED.rank RETURNING id`);
}

/** @param {string} runId @param {unknown} plan */
function awaitConfirmation(runId, plan) {
  return one(sql`UPDATE agent_runs SET status='awaiting_confirmation',plan_json=${JSON.stringify(plan)} WHERE id=${runId} AND status='running' RETURNING id`);
}

/** @param {string} runId */
function failRun(runId) {
  return one(sql`UPDATE agent_runs SET status='error',completed_at=NOW() WHERE id=${runId} AND status IN ('pending','running') RETURNING id`);
}

/** @param {string} id */
function agentWorker(id) {
  return one(sql`SELECT u.id,u.full_name,u.district,u.area,u.is_nic_verified,wp.bio,wp.starting_price,wp.primary_skill,wp.total_jobs_done,wp.avg_rating FROM users u LEFT JOIN worker_profiles wp ON wp.user_id=u.id WHERE u.id=${id} AND u.role='worker'`);
}

/** @param {string} id */
function agentWorkerSkills(id) {
  return rows(sql`SELECT ws.category_id,ws.is_primary,c.name AS category_name FROM worker_skills ws JOIN categories c ON c.id=ws.category_id WHERE ws.worker_id=(SELECT id FROM worker_profiles WHERE user_id=${id})`);
}

/** @param {string | null | undefined} district @param {number} limit */
function candidateWorkers(district, limit) {
  return rows(sql`SELECT u.id,u.full_name,u.district,u.area,u.profile_photo,u.is_nic_verified,wp.id AS worker_profile_id,wp.bio,wp.starting_price,wp.primary_skill,wp.total_jobs_done,wp.avg_rating,COALESCE((SELECT json_agg(json_build_object('category_id',ws.category_id,'category_name',c.name,'category_icon',c.icon,'is_primary',ws.is_primary)) FROM worker_skills ws JOIN categories c ON c.id=ws.category_id WHERE ws.worker_id=wp.id),'[]'::json) AS skills FROM users u LEFT JOIN worker_profiles wp ON wp.user_id=u.id WHERE u.role='worker' AND u.is_suspended=false AND (${district}::text IS NULL OR u.district ILIKE ${`%${district || ''}%`}) ORDER BY wp.avg_rating DESC NULLS LAST,wp.total_jobs_done DESC LIMIT ${limit}`);
}

module.exports = instrumentRepository('agents', {
  activeMatch, activeProposal, addRecommendation, addStep, agentWorker, agentWorkerSkills,
  awaitConfirmation, cancelRun, candidateWorkers, createRun, failRun, history, memory,
  memories, runDetail, runRecommendations, runSteps, upsertMemory,
});
