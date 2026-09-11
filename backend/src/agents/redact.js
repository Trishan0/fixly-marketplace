/**
 * redact.js — best-effort PII scrubbing for free text before it enters a
 * Gemini prompt.
 *
 * Job descriptions, worker bios, and review feedback are all real
 * user-written text that now gets sent to a third-party API as a matter of
 * course. This is a best-effort regex screen, not a guarantee: it won't
 * catch an address written as prose, a name, or a phone number in an
 * unusual format. It's applied at the tool-handler boundary only - the raw
 * text is still stored and shown normally everywhere else in the app.
 */

'use strict';

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Sri Lankan mobile/landline numbers, the common formats: +94771234567,
// +94 77 123 4567, 0771234567, 077-123-4567. Requires the leading 0/+94
// marker and the right digit count, rather than matching any long digit
// run, to avoid flagging prices, dates, or other ordinary numbers.
const PHONE_PATTERN = /(\+94[-.\s]?\d{2}[-.\s]?\d{3}[-.\s]?\d{4}|0\d{2}[-.\s]?\d{3}[-.\s]?\d{4}|0\d{9})/g;

/**
 * @param {string | null | undefined} text
 * @returns {string | null | undefined} the same value for non-strings (so
 *   callers can pass a possibly-null field straight through)
 */
function redactText(text) {
  if (typeof text !== 'string' || !text) return text;
  return text
    .replace(EMAIL_PATTERN, '[redacted email]')
    .replace(PHONE_PATTERN, '[redacted phone]');
}

module.exports = { redactText };
