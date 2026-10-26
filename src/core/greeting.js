// Greeting period by local time (SCOPE §2.1). Returns a key; the text lives in src/renderer/strings.js.
export function greetingFor(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  return 'evening';
}
