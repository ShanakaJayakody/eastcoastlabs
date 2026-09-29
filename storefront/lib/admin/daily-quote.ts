export const QUOTES = [
  'Let your purpose set the direction. Let your discipline set the pace.',
  'Ambition becomes progress when it has a place in your calendar.',
  'Protect the standard, especially when no one is watching.',
  'Make today a clear step towards the work you want to be known for.',
  'Build the habits that make your goals believable.',
  'Do the important work before the comfortable work.',
  'A strong purpose deserves a consistent effort.',
  'Raise the quality of the work, and let the results follow.',
  'Choose the next right action. Then give it your full attention.',
  'The future you want is built in the decisions you repeat.',
  'Work with urgency. Think with patience.',
  'Keep your ambition high and your next step clear.',
  'Measure progress honestly. Celebrate it generously.',
  'Let excellence be a practice, not an occasion.',
  'Create something useful enough to earn its place in the world.',
  'Your standards are built one decision at a time.',
  'Start with purpose. Finish with care.',
  'Consistency gives ambition somewhere to go.',
  'The smallest meaningful action is worth more than a perfect intention.',
  'Make room for the work that moves the mission forward.',
  'Build trust at the same pace you build the business.',
  'A good day is one that moves the important things forward.',
  'Turn what you learn into how you work.',
  'Aim for a result you can be proud to stand behind.',
  'Be patient with the outcome and demanding of the effort.',
  'Give your best attention to what deserves your best work.',
  'A clear priority makes a thousand small decisions easier.',
  'Success is stronger when it serves a purpose beyond itself.',
  'Keep showing up for the future you believe in.',
  'Let the next step reflect the size of your ambition.',
  'Progress compounds when the standard stays high.',
] as const;

const formatter = new Intl.DateTimeFormat('en-AU', {timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'});
export function dailyQuote(now: Date) {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid quote date');
  const parts = Object.fromEntries(formatter.formatToParts(now).map(p=>[p.type,p.value]));
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const ordinal = Math.floor(Date.parse(day+'T00:00:00Z')/86400000);
  const index = ((ordinal % QUOTES.length)+QUOTES.length)%QUOTES.length;
  return {id:String(index),text:QUOTES[index] as string,day};
}
export function nextQuoteDelay(now: Date): number {
  const start=now.getTime(),day=dailyQuote(now).day;
  let low=start+1,high=start+27*60*60*1000;
  while(low<high) {
    const middle=Math.floor((low+high)/2);
    if(dailyQuote(new Date(middle)).day===day) low=middle+1;else high=middle;
  }
  return Math.max(1,low-start);
}
