// Run with: node tests/triage.test.js
const assert = require('assert');
const T = require('../triage.js');

const cases = [
  // [text, from, expected verdict]
  ['Your Uber code is 4821. Never share this code.', '22395', 'automated'],
  ['G-582910 is your Google verification code.', '', 'automated'],
  ['Your package has been delivered. Track at https://amzn.to/x', 'Amazon', 'automated'],
  ['USPS: Your parcel could not be delivered. Redeliver here: usps-help.top/x', '+1 (415) 555-0199', 'automated'],
  ['Unpaid toll balance of $4.15. Pay now to avoid fees: ezpass-pay.info', '+44 7700 900123', 'automated'],
  ['Congratulations! You have won a $500 gift card. Claim your prize now', '+1 555 010 2222', 'automated'],
  ['Flash sale! 40% off everything. Reply STOP to opt out', '88776', 'automated'],
  ['Reminder: Dr. Lee appointment Tue 3pm. Reply C to confirm', '', 'automated'],
  ['Purchase of $82.10 on your card ending 1234', 'Chase', 'automated'],
  ['Are you free for dinner Saturday?', 'Sam Rivera', 'reply'],
  ['can you pick up milk on the way home', 'Mom', 'reply'],
  ['How have you been?? It\'s been forever', 'Jess', 'reply'],
  ['I got the job!!!', 'Priya', 'reply'],
  ['Rough week. My grandpa is in the hospital', 'Alex', 'reply'],
  ['Happy birthday!! 🎂', 'Uncle Bob', 'reply'],
  ['lmk when you land', 'Dad', 'reply'],
  ['ok', 'Sam', 'none'],
  ['Sounds good!', 'Sam', 'none'],
  ['haha', 'Jess', 'none'],
  ['haha ok', 'Jess', 'none'],
  ['ok thanks!! 😂', 'Jess', 'none'],
  ['ok but are you coming?', 'Jess', 'reply'],
  ['👍', 'Dad', 'none'],
  ['Loved “see you at 7”', 'Sam', 'none'],
  ['Saw your mom at the store today', 'Neighbor Kim', 'maybe'],
];

let fail = 0;
for (const [text, from, want] of cases) {
  const r = T.classify(text, from);
  const ok = r.verdict === want;
  if (!ok) fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${want.padEnd(9)} got ${r.verdict.padEnd(9)} ${JSON.stringify(text)}  [${r.reasons.join('; ')}]`);
}

// Suggestions fill names, and drop the placeholder cleanly with no name
assert.strictEqual(T.suggest(T.classify('Are you free for dinner?'), 'Sam Rivera')[0].text, "Yes, I'm in! What time works for you, Sam?");
assert.strictEqual(T.suggest(T.classify('Are you free for dinner?'), '')[0].text, "Yes, I'm in! What time works for you?");
assert.strictEqual(T.fill('Anytime {name}!', '+1 555 123 4567'), 'Anytime!');
assert.strictEqual(T.classify('I got the job!!!', 'Priya').intent, 'news');

// Shortcut inbox file
const inbox = T.parseInbox('From: Mom\ncan you call me?\n---\nFrom: 22395\nYour code is 1234\n---\n\n---\nno sender line here\n');
assert.deepStrictEqual(inbox, [
  { from: 'Mom', text: 'can you call me?' },
  { from: '22395', text: 'Your code is 1234' },
  { from: '', text: 'no sender line here' },
]);

if (fail) { console.error(`\n${fail} classification case(s) failed`); process.exit(1); }
console.log('\nAll triage tests passed');
