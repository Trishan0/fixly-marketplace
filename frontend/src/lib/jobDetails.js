// Builds the job description from the customer's own text plus their
// answers to suggested questions. This is the only place answers become
// description text, and it's plain code: the AI suggests questions (and
// answer choices the customer may tap), but every word added here was typed
// or chosen by the customer. The original text is never changed.

export const MAX_DESCRIPTION_LENGTH = 4000
export const MAX_ANSWER_LENGTH = 200

const HEADINGS = { si: 'විස්තර', ta: 'விவரங்கள்', en: 'Details' }

/** The heading in the customer's script: Sinhala, Tamil, or English. */
export function detailsHeading(text) {
  if (/[඀-෿]/.test(text)) return HEADINGS.si
  if (/[஀-௿]/.test(text)) return HEADINGS.ta
  return HEADINGS.en
}

function oneLine(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

/** "- Question? Answer" lines for every question the customer answered. */
export function detailLines(answers) {
  return answers
    .map(({ question, answer }) => ({ question: oneLine(question, 200), answer: oneLine(answer, MAX_ANSWER_LENGTH) }))
    .filter(({ question, answer }) => question && answer)
    .map(({ question, answer }) => `- ${question} ${answer}`)
}

/**
 * Appends answered questions under a details heading, reusing the heading
 * if an earlier round already added one at the end. Lines that would push
 * the description past the length limit are left out and counted.
 * @returns {{ text: string, added: number, skipped: number }}
 */
export function appendDetails(description, answers) {
  const original = String(description || '').replace(/\s+$/, '')
  const lines = detailLines(answers)
  if (lines.length === 0) return { text: original, added: 0, skipped: 0 }

  const heading = detailsHeading(original)
  const blockStart = `\n\n${heading}:\n`
  const lastBlock = original.lastIndexOf(blockStart)
  const hasBlockAtEnd = lastBlock !== -1 && original.slice(lastBlock + blockStart.length).split('\n').every(line => line.startsWith('- '))

  let text = hasBlockAtEnd ? original : `${original}${blockStart}`.replace(/\n$/, '')
  let added = 0
  for (const line of lines) {
    const next = `${text}\n${line}`
    if (next.length > MAX_DESCRIPTION_LENGTH) break
    text = next
    added += 1
  }
  if (added === 0) return { text: original, added: 0, skipped: lines.length }
  return { text, added, skipped: lines.length - added }
}
