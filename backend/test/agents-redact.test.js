'use strict';

const { redactText } = require('../src/agents/redact');

describe('redactText', () => {
  test('redacts an email address', () => {
    expect(redactText('Reach me at jane.doe@example.com for details.'))
      .toBe('Reach me at [redacted email] for details.');
  });

  test('redacts a plain 10-digit Sri Lankan mobile number', () => {
    expect(redactText('Call me on 0771234567 anytime.'))
      .toBe('Call me on [redacted phone] anytime.');
  });

  test('redacts a hyphenated Sri Lankan number', () => {
    expect(redactText('Landline: 011-234-5678')).toBe('Landline: [redacted phone]');
  });

  test('redacts an international-format number', () => {
    expect(redactText('WhatsApp +94 77 123 4567 works best.'))
      .toBe('WhatsApp [redacted phone] works best.');
  });

  test('redacts multiple matches in the same string', () => {
    expect(redactText('Text 0771234567 or email me@site.com'))
      .toBe('Text [redacted phone] or email [redacted email]');
  });

  test('leaves an ordinary price mention alone', () => {
    expect(redactText('Budget is LKR 5000 for this job.')).toBe('Budget is LKR 5000 for this job.');
  });

  test('leaves an ISO date alone', () => {
    expect(redactText('Needs to be done by 2026-01-02.')).toBe('Needs to be done by 2026-01-02.');
  });

  test('leaves ordinary text with no PII untouched', () => {
    const text = 'Water is leaking under the sink, please bring your own tools.';
    expect(redactText(text)).toBe(text);
  });

  test('passes through null and undefined unchanged', () => {
    expect(redactText(null)).toBeNull();
    expect(redactText(undefined)).toBeUndefined();
  });

  test('passes through an empty string unchanged', () => {
    expect(redactText('')).toBe('');
  });
});
