import test from 'node:test'
import assert from 'node:assert/strict'
import { appendDetails, detailsHeading, MAX_DESCRIPTION_LENGTH } from './jobDetails.js'

test('keeps the customer\'s text unchanged and adds only their answers', () => {
  const { text, added } = appendDetails('Pipe is broken', [
    { question: 'Which pipe is broken?', answer: 'Kitchen sink' },
    { question: 'Leaking or fully burst?', answer: '' },
    { question: 'Since when?', answer: '  Today\n morning ' },
  ])
  assert.equal(text, 'Pipe is broken\n\nDetails:\n- Which pipe is broken? Kitchen sink\n- Since when? Today morning')
  assert.equal(added, 2)
  assert.ok(text.startsWith('Pipe is broken'))
})

test('nothing answered leaves the description as it was', () => {
  assert.deepEqual(appendDetails('Pipe is broken  ', [{ question: 'Which pipe?', answer: ' ' }]), { text: 'Pipe is broken', added: 0, skipped: 0 })
})

test('a second round adds to the same details list', () => {
  const first = appendDetails('Pipe is broken', [{ question: 'Which pipe?', answer: 'Sink' }]).text
  const second = appendDetails(first, [{ question: 'Since when?', answer: 'Today' }]).text
  assert.equal(second, 'Pipe is broken\n\nDetails:\n- Which pipe? Sink\n- Since when? Today')
})

test('starts a new list if the customer wrote more text after the last one', () => {
  const edited = 'Pipe is broken\n\nDetails:\n- Which pipe? Sink\n\nAlso the tap drips.'
  assert.equal(appendDetails(edited, [{ question: 'Since when?', answer: 'Today' }]).text, `${edited}\n\nDetails:\n- Since when? Today`)
})

test('uses a heading in the customer\'s script', () => {
  assert.equal(detailsHeading('නළය කැඩිලා'), 'විස්තර')
  assert.equal(detailsHeading('குழாய் உடைந்துவிட்டது'), 'விவரங்கள்')
  assert.equal(detailsHeading('Paipe eka kadila'), 'Details')
})

test('never goes past the length limit', () => {
  const long = 'x'.repeat(MAX_DESCRIPTION_LENGTH - 30)
  const { text, added, skipped } = appendDetails(long, [{ question: 'Which pipe?', answer: 'Sink' }, { question: 'Since when?', answer: 'Today' }])
  assert.ok(text.length <= MAX_DESCRIPTION_LENGTH)
  assert.equal(added + skipped, 2)
})
