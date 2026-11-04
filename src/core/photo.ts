// Card photo (SCOPE §2.3): the renderer crops the picked image to a centred square and scales it to PHOTO_SIZE;
// the card shows it as a circle. Pure and DOM-free.

export const PHOTO_SIZE = 256;
/** What the file picker offers (decoded by the renderer's image decoder, which knows all three). */
export const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export function squareCrop(width: number, height: number): { x: number; y: number; size: number } {
  const size = Math.min(width, height);
  return { x: Math.floor((width - size) / 2), y: Math.floor((height - size) / 2), size };
}
