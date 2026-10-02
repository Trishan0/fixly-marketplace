'use strict';

const { checkDraft } = require('../src/agents/proposalDrafts');

const worker = { total_jobs_done: 12, avg_rating: '4.80', starting_price: 'LKR 2,500', bio: 'Plumber since 2015.' };
const reviews = [{ rating: 5, feedback: 'Fixed 3 leaks in one visit', job_title: 'Bathroom leaks' }];
const job = { title: 'Replace 2 taps', description: 'Two kitchen taps, budget 4,500', fixed_budget: '4500.00', proposal_count: 1 };
const evidence = { worker, reviews, job };

describe('checkDraft', () => {
  test('accepts numbers backed by the profile, reviews or job', () => {
    expect(checkDraft('I have 12 completed jobs, a 4.8 rating, and fixed 3 leaks in one visit. Happy to replace your 2 taps; my guide price starts at LKR 2,500 and your budget of 4,500 works.', evidence)).toEqual({ ok: true, reasons: [] });
  });

  test('rejects invented numbers', () => {
    const result = checkDraft('I have 10 years of experience and 50 happy customers.', evidence);
    expect(result.ok).toBe(false);
    expect(result.reasons[0]).toContain('10, 50');
  });

  test('rejects contact details and promises about timing', () => {
    expect(checkDraft('Call me on 0771234567.', evidence).ok).toBe(false);
    expect(checkDraft('Email me at worker@example.com', evidence).ok).toBe(false);
    expect(checkDraft('I can come today and fix it.', evidence).ok).toBe(false);
    expect(checkDraft("I'll be there tomorrow morning.", evidence).ok).toBe(false);
    expect(checkDraft('Available right away.', evidence).ok).toBe(false);
  });

  test('catches promises about timing in Sinhala, Tamil, Singlish and Tanglish too', () => {
    expect(checkDraft('Mata heta enna puluwan.', evidence).ok).toBe(false);
    expect(checkDraft('මට අද එන්න පුළුවන්.', evidence).ok).toBe(false);
    expect(checkDraft('நான் நாளை வர முடியும்.', evidence).ok).toBe(false);
    expect(checkDraft('Naan naalaiku varen.', evidence).ok).toBe(false);
  });

  test('accepts a plain draft in Singlish or Sinhala with backed-up numbers', () => {
    expect(checkDraft('Mama plumber kenek, Fixly eke jobs 12 k iwara karala thiyenawa.', evidence).ok).toBe(true);
    expect(checkDraft('මම Fixly හි රැකියා 12ක් සම්පූර්ණ කර ඇත.', evidence).ok).toBe(true);
  });

  test('accepts a plain draft with no claims to check', () => {
    expect(checkDraft('Hi, I fix leaking taps and would like to help with this job.', evidence).ok).toBe(true);
  });
});
