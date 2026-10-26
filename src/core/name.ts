// Default greeting name (SCOPE §2.1): first word of the Windows display name, without stray punctuation.
// Falls back to USERNAME. Real case from Phase 0: "histuan ." -> "histuan".
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

function firstWord(text: string | null | undefined): string {
  for (const word of (text ?? '').split(/\s+/)) {
    const clean = word.replace(EDGE_PUNCTUATION, '');
    if (clean) return clean;
  }
  return '';
}

export function cleanDisplayName(fullName: string | null | undefined, username: string | undefined): string {
  return firstWord(fullName) || (username ?? '').trim();
}
