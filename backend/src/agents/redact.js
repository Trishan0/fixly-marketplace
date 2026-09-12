/**
 * redact.js — best-effort PII scrubbing for free text before it enters a
 * Gemini prompt, plus a script-detection helper used to flag content the
 * rest of the safety net (English-pattern-based) can't actually cover.
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

// Sri Lankan National Identity Card numbers - the old format (9 digits plus
// a V/X suffix) and the new 12-digit format. NIC verification is a
// first-class feature of this platform (is_nic_verified), which makes a
// leaked NIC number one of the more sensitive things this scrubber could
// miss if it only covered phone/email.
const NIC_OLD_PATTERN = /\b\d{9}[VvXx]\b/g;
const NIC_NEW_PATTERN = /\b\d{12}\b/g;

// Sinhala and Tamil Unicode blocks. The injection-marker tripwire in
// schemas.js is pure English idiom matching, so it's blind to content
// written in either script (or transliterated Sinhala/Tamil isn't caught
// by this either - only genuine script use). This only detects the
// condition; callers decide what to do with it (see matchAgent.js/
// proposalAgent.js, which flag it to the model instead of claiming
// coverage the redactor doesn't have).
const SINHALA_RANGE = /[඀-෿]/;
const TAMIL_RANGE = /[஀-௿]/;

/**
 * @param {string | null | undefined} text
 * @returns {string | null | undefined} the same value for non-strings (so
 *   callers can pass a possibly-null field straight through)
 */
function redactText(text) {
  if (typeof text !== 'string' || !text) return text;
  return text
    .replace(EMAIL_PATTERN, '[redacted email]')
    .replace(NIC_OLD_PATTERN, '[redacted NIC]')
    .replace(NIC_NEW_PATTERN, '[redacted NIC]')
    .replace(PHONE_PATTERN, '[redacted phone]');
}

/**
 * @param {string | null | undefined} text
 * @returns {boolean} true if the text contains Sinhala or Tamil script -
 *   a signal that the English-only injection tripwire can't meaningfully
 *   screen this content
 */
function containsNonLatinScript(text) {
  if (typeof text !== 'string' || !text) return false;
  return SINHALA_RANGE.test(text) || TAMIL_RANGE.test(text);
}

module.exports = { redactText, containsNonLatinScript };
