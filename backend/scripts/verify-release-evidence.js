#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { z } = require('zod');

const timestamp = z.string().datetime({ offset: true });
const evidenceText = z.string().min(2).refine(value => !/(replace|example)/i.test(value), 'must contain recorded, non-placeholder evidence');
const releaseId = z.string().min(3).max(128).refine(value => !/(replace|example)/i.test(value), 'must contain recorded, non-placeholder evidence');
const evidenceUrl = z.string().url().refine(value => !/(replace|example)/i.test(value), 'must contain a recorded, non-placeholder evidence URL');
const owner = z.object({ name: evidenceText, contact: evidenceText }).strict();
const releaseEvidenceSchema = z.object({
  releaseId,
  environment: z.enum(['staging', 'production']),
  recordedAt: timestamp,
  owners: z.object({
    applicationRollback: owner,
    databaseRemediation: owner,
    incidentCommunication: owner,
  }).strict(),
  backupRestore: z.object({
    recoveryPointAt: timestamp,
    restoreRehearsedAt: timestamp,
    restoreDurationMinutes: z.number().positive(),
    rpoMinutes: z.number().nonnegative(),
    rtoMinutes: z.number().positive(),
    evidenceUrl,
  }).strict(),
  databaseAccess: z.object({
    runtimeRoleVerified: z.literal(true),
    migrationRoleVerified: z.literal(true),
    tlsVerified: z.literal(true),
    evidenceUrl,
  }).strict(),
  migration: z.object({
    ledgerState: z.literal('tracked'),
    checksumsVerified: z.literal(true),
    schemaDriftVerified: z.literal(true),
    evidenceUrl,
  }).strict(),
  compatibility: z.object({
    previousArtifactSmokePassed: z.literal(true),
    correctiveMigrationRehearsed: z.literal(true),
    evidenceUrl,
  }).strict(),
  reconciliation: z.object({
    marketplaceAuditPassed: z.literal(true),
    ratingsCheckPassed: z.literal(true),
    evidenceUrl,
  }).strict(),
  canary: z.object({
    completedAt: timestamp,
    rollbackTested: z.literal(true),
    metricsWithinBaseline: z.literal(true),
    evidenceUrl,
  }).strict(),
}).strict();

function usage() {
  console.log('Usage: node scripts/verify-release-evidence.js --file /absolute/or/relative/evidence.json');
}

function parseArgs(argv) {
  if (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h')) return { help: true };
  if (argv.length !== 2 || argv[0] !== '--file') throw new Error('--file requires an evidence JSON path');
  return { file: argv[1] };
}

function parseReleaseEvidence(value) {
  const parsed = releaseEvidenceSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid release evidence: ${parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  }
  return parsed.data;
}

function verifyReleaseEvidence(file) {
  const location = path.resolve(file);
  const document = JSON.parse(fs.readFileSync(location, 'utf8'));
  const evidence = parseReleaseEvidence(document);
  return {
    releaseId: evidence.releaseId,
    environment: evidence.environment,
    recordedAt: evidence.recordedAt,
  };
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      usage();
    } else {
      console.info(JSON.stringify({ event: 'release_evidence_verified', ...verifyReleaseEvidence(options.file) }));
    }
  } catch (error) {
    console.error(`Release evidence verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { parseArgs, parseReleaseEvidence, verifyReleaseEvidence };
