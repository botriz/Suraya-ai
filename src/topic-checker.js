// Very simple rule-based topic checker

const keywords = [
  // populate based on channel topic; example for AI-education
  'هوش مصنوعی', 'یادگیری ماشین', 'دیتا', 'مدل', 'شبکه عصبی', 'آموزش'
];

function isOnTopic({ title = '', description = '' }) {
  const text = (title + ' ' + description).toLowerCase();
  let hits = 0;
  for (const k of keywords) if (text.includes(k)) hits++;
  return { ok: hits > 0, hits };
}

module.exports = { isOnTopic };
