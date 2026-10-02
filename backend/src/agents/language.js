/**
 * language.js — How a customer writes, so the agents can answer in the
 * same language: Sinhala or Tamil script, Sinhala or Tamil typed with
 * English letters ("Singlish", "Tanglish"), or English.
 */

'use strict';

// Common words in Sinhala or Tamil typed with English letters ("Singlish",
// "Tanglish"). Script detection can't tell these apart from English, and
// the model alone doesn't always notice on a short description, so a
// couple of hits make the prompt say which language to ask in. Words that
// are also everyday English ("one", "api") are left out on purpose.
const SINGLISH_WORDS = new Set([
  'eka', 'ekak', 'eke', 'ekata', 'na', 'naha', 'nane', 'onne', 'ona', 'kedila', 'kadila', 'kedilaa', 'kaduna',
  'wada', 'karanne', 'karanna', 'karala', 'thiyenawa', 'tiyenawa', 'thiyena', 'enawa', 'yanawa', 'hadanna',
  'hadala', 'mage', 'mata', 'oya', 'meka', 'kohoma', 'mokakda', 'kawda', 'aniwa', 'hari',
  'godak', 'tikak', 'wathura', 'watura', 'bate', 'kussiye', 'kamare', 'gedara', 'adha', 'heta', 'ikmanata',
]);
const TANGLISH_WORDS = new Set([
  'illa', 'irukku', 'iruku', 'panna', 'pannanum', 'venum', 'vendum', 'udanchiduchu', 'udainthu', 'aagala',
  'aaguthu', 'veetla', 'enna', 'konjam', 'romba', 'thanni', 'vela', 'seiyanum', 'innaiku', 'naalaiku',
]);

/**
 * How the customer writes, as a hint for the prompt.
 * @returns {'sinhala_script' | 'tamil_script' | 'singlish' | 'tanglish' | 'english'}
 */
function writingStyle(text) {
  if (/[\u0D80-\u0DFF]/.test(text)) return 'sinhala_script';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'tamil_script';
  const words = String(text).toLowerCase().match(/[a-z]+/g) || [];
  const hits = (list) => words.filter(word => list.has(word)).length;
  const needed = words.length <= 4 ? 1 : 2;
  if (hits(SINGLISH_WORDS) >= needed) return 'singlish';
  if (hits(TANGLISH_WORDS) >= needed) return 'tanglish';
  return 'english';
}

// What to tell the model, per style, when it writes to this customer.
const STYLE_NAMES = {
  sinhala_script: 'Sinhala, in Sinhala script',
  tamil_script: 'Tamil, in Tamil script',
  singlish: 'Sinhala typed with English letters (Singlish), in the same casual style the customer used',
  tanglish: 'Tamil typed with English letters (Tanglish), in the same casual style the customer used',
  english: 'English',
};

module.exports = { writingStyle, STYLE_NAMES };
