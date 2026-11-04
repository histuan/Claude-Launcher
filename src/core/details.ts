// Account details typed by the person (WINDOWS.md §5: local files are not reliable, so v1 uses option 3 only).
// Pure and DOM-free: the renderer validates the dialog with it, the main process validates again before saving.

export const MAX_EMAIL_LENGTH = 254;
export const MAX_REAL_NAME_LENGTH = 60;

/** Keys of strings.details.errors. */
export type DetailsError = 'emailMissing' | 'emailInvalid';

export interface Details {
  email: string;
  realName: string | null;
}

// One "@", no spaces, a dot inside the domain with text on both sides. Deliberately loose: the person types it.
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function checkDetails(email: string, realName: string): Details | { error: DetailsError } {
  const mail = email.trim();
  if (!mail) return { error: 'emailMissing' };
  if (mail.length > MAX_EMAIL_LENGTH || !EMAIL.test(mail)) return { error: 'emailInvalid' };
  const name = realName.trim().slice(0, MAX_REAL_NAME_LENGTH).trim();
  return { email: mail, realName: name || null };
}
