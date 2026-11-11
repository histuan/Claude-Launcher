import {
  START_STEPS, type ActionResult, type LauncherApi, type LauncherState, type SignInStatus, type SignInTarget, type StartStep,
  type UpdateStatus,
} from '../core/api.js';
import { cardBadge, cardStatus } from '../core/card.js';
import type { Account } from '../core/config.js';
import { checkDetails, type Details } from '../core/details.js';
import {
  checkedByDefault, checkMemoryText, joinMemoryFiles, MAX_MEMORY_CHARS, memoryFolders, memorySection, memorySources,
  splitMemoryParts, type MemoryFile,
} from '../core/memories.js';
import { MAX_ZIP_FILE_BYTES, readMemoryZip } from '../core/memoryZip.js';
import { PHOTO_SIZE, squareCrop } from '../core/photo.js';
import { greetingFor } from '../core/greeting.js';
import { strings } from './strings.js';

declare global {
  interface Window { launcher: LauncherApi }
}

const api = window.launcher;
let state: LauncherState;
let running = new Set<string>();

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  el.append(...children);
  return el;
}

const PENCIL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
  + 'stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';

const cardName = (a: Account): string => a.label ?? strings.mainAccount;
const isMain = (a: Account): boolean => a.profileDir === null;
const isSignedOut = (a: Account): boolean => state.signedOut.includes(a.id);
const signInOff = (): boolean => !state.signInAvailable;
const initial = (name: string): string => (Array.from(name.trim())[0] ?? '?').toLocaleUpperCase();

// ---------- Greeting (SCOPE §2.1) ----------

function renderGreetingText(): void {
  byId('greeting-text').textContent = `${strings.greeting[greetingFor()]},`;
}

function renderName(): void {
  const name = state.greetingName ?? (state.defaultName || strings.greetingNoName);
  const label = h('span', { class: 'name', role: 'button', tabindex: '0', title: strings.editName }, name);
  const pencil = h('button', { class: 'pencil', type: 'button', title: strings.editName, 'aria-label': strings.editName });
  pencil.innerHTML = PENCIL_SVG;
  label.addEventListener('click', editName);
  label.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); editName(); } });
  pencil.addEventListener('click', editName);
  byId('name-wrap').replaceChildren(label, pencil);
}

/** Enter or leaving the field saves, Esc cancels, an empty field restores the Windows name. */
function editName(): void {
  const input = h('input', {
    class: 'name-input', type: 'text', maxlength: '40', spellcheck: 'false', 'aria-label': strings.yourName,
  });
  input.value = state.greetingName ?? state.defaultName;
  let done = false;
  const finish = async (save: boolean): Promise<void> => {
    if (done) return;
    done = true;
    if (save) state = await api.setGreetingName(input.value);
    renderName();
    byId('name-wrap').querySelector<HTMLElement>('.name')?.focus();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void finish(true);
    if (e.key === 'Escape') void finish(false);
  });
  input.addEventListener('blur', () => void finish(true));
  byId('name-wrap').replaceChildren(input);
  input.focus();
  input.select();
}

// ---------- Cards (SCOPE §2.2) ----------

function renderCards(): void {
  const cards = state.accounts.map((account) => {
    const name = cardName(account);
    const open = h('button', { class: 'card-open', type: 'button', 'aria-label': strings.openAccount(name) },
      avatar(account, name),
      h('span', { class: 'label clip' }, name),
      h('span', { class: 'email clip' }, account.email ?? ''),
      h('span', { class: 'real-name clip' }, account.realName ?? ''),
    );
    // 1.0.1: a click always opens the account (a signed-out one shows Claude's own sign-in); Sign in again is in ⋯.
    open.addEventListener('click', () => void openAccount(account, open));
    const shown = cardStatus(running.has(account.id), isSignedOut(account), state.checking.includes(account.id));
    const kind = shown === 'checking' ? ' checking' : shown === 'signedOut' ? ' signed-out' : '';
    const status = h('span', { class: `running${kind}` }, shown ? strings.status[shown] : '');
    status.hidden = shown === null;
    const badge = cardBadge(account);
    const extra = badge ? [h('span', { class: 'badge' }, strings.badges[badge])] : [];
    const more = h('button', {
      class: 'card-menu', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false',
      'aria-label': strings.accountOptions(name), title: strings.accountOptions(name), 'data-focus-key': `menu:${account.id}`,
    }, '⋯');
    more.addEventListener('click', () => openMenu(account, more));
    return h('div', { class: 'card' }, open, status, ...extra, more);
  });
  byId('cards').replaceChildren(...cards);
}

/** The chosen photo (shown as a circle) or the card name's initial. */
function avatar(account: Account, name: string): HTMLElement {
  const photo = state.photos[account.id];
  return photo
    ? h('img', { class: 'avatar', src: photo, alt: '', 'aria-hidden': 'true' })
    : h('span', { class: 'avatar', 'aria-hidden': 'true' }, initial(name));
}

async function openAccount(account: Account, button: HTMLButtonElement): Promise<void> {
  if (button.disabled) return;
  button.disabled = true; // no double launch while Claude starts
  try {
    await showResult(await api.openAccount(account.id)); // on success the launcher closes by itself
  } finally {
    button.disabled = false;
  }
}

// ---------- "Running" indicator: every ~3 s while the window is visible ----------
// When an account starts or stops running, the cards are drawn again with a fresh "Not signed in" check. A running
// account is never read (Claude locks its cookie database), so a sign-out inside Claude shows only after it is
// closed; while the file is still locked right after a close, the card says "Checking…" (main retries for ~10 s and
// sends cardsChanged when done).

const sameIds = (a: Iterable<string>, b: Iterable<string>): boolean => {
  const x = [...a].sort();
  const y = [...b].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

/**
 * Draws the cards again with a fresh state when the running set or the signed-out set changed. Also follows a new
 * Windows name or sign-in availability (0.5.1: the cached values are looked up again after the cards are shown).
 */
async function refreshCards(nextRunning: Set<string>): Promise<void> {
  const fresh = await api.getState();
  const cardsSame = sameIds(nextRunning, running) && sameIds(fresh.signedOut, state.signedOut)
    && sameIds(fresh.checking, state.checking);
  const nameChanged = fresh.defaultName !== state.defaultName;
  const availabilityChanged = fresh.signInAvailable !== state.signInAvailable;
  if (cardsSame && !nameChanged && !availabilityChanged) return;
  running = nextRunning;
  state = fresh;
  if (!cardsSame) {
    closeMenu(); // its card is about to be replaced
    renderCards();
  }
  // Not while the person is typing a name (the field would vanish).
  if (nameChanged && !byId('name-wrap').querySelector('input')) renderName();
  if (availabilityChanged) renderSignInAvailability();
}

async function refreshRunning(): Promise<void> {
  try {
    const next = new Set(await api.runningAccounts());
    if (!sameIds(next, running)) await refreshCards(next);
  } catch {
    // keep the last known state; the next poll tries again
  }
}

async function pollRunning(): Promise<void> {
  if (!document.hidden) await refreshRunning();
  setTimeout(() => void pollRunning(), 3000);
}

/** A background card check changed something (last known state corrected, "Checking…" on or off). */
api.onCardsChanged(() => void refreshCards(running).catch(() => undefined));

// Full text in a tooltip only when it is cut with an ellipsis.
document.addEventListener('mouseover', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('.clip');
  if (el) el.title = el.scrollWidth > el.clientWidth ? (el.textContent ?? '') : '';
});

// ---------- Card ⋯ menu (SCOPE §2.3) ----------

const menu = byId('menu');
let menuOwner: HTMLElement | null = null;

function menuItem(text: string | (Node | string)[], action: (() => void) | null, extra: Record<string, string> = {}): HTMLButtonElement {
  const button = h('button', { type: 'button', role: 'menuitem', ...extra }, ...(typeof text === 'string' ? [text] : text));
  if (action) {
    // Focus goes back to the card's ⋯ button first: a dialog opened by the action returns there when it closes.
    button.addEventListener('click', () => { closeMenu(true); action(); });
  } else {
    button.setAttribute('aria-disabled', 'true');
    button.title = extra.title ?? strings.comingSoon;
  }
  return button;
}

function openMenu(account: Account, owner: HTMLElement): void {
  if (menuOwner === owner) return closeMenu();
  closeMenu();
  const item = menuItem;
  const items = isMain(account) ? []
    : [signInOff() ? item(strings.menu.signIn, null, { title: strings.signInOff }) : item(strings.menu.signIn, () => void signIn(account))];
  items.push(
    item(strings.menu.rename, () => void rename(account)),
    item(strings.menu.editDetails, () => void editDetails(account)),
    item(strings.menu.changePhoto, () => pickPhoto(account)),
    ...(state.photos[account.id] ? [item(strings.menu.removePhoto, () => void setPhoto(account, null))] : []),
    memoriesItem(account, owner),
    running.has(account.id)
      ? item(strings.menu.close, () => void closeAccount(account))
      : item(strings.menu.close, null, { title: strings.menu.closeOff }),
  );
  if (!isMain(account)) items.push(item(strings.menu.remove, () => void remove(account), { class: 'danger' }));
  showMenu(owner, items);
}

/** Puts the items in the menu under the card's ⋯ button. */
function showMenu(owner: HTMLElement, items: HTMLElement[], title?: string): void {
  menu.replaceChildren(...(title ? [h('p', { class: 'menu-title' }, title)] : []), ...items);
  menu.hidden = false;

  const box = owner.getBoundingClientRect();
  const left = Math.min(box.left, window.innerWidth - menu.offsetWidth - 8);
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${box.bottom + 4}px`;
  menuOwner = owner;
  owner.setAttribute('aria-expanded', 'true');
  items[0]?.focus();
}

/** "Receive memories from…": the menu turns into the list of the other signed-in accounts (Phase 5.1). */
function memoriesItem(target: Account, owner: HTMLElement): HTMLButtonElement {
  const sources = memorySources(state.accounts, target.id, state);
  if (sources.length === 0) {
    const why = isSignedOut(target) ? strings.menu.memoriesSignedOut : strings.menu.memoriesNoSource;
    return menuItem(strings.menu.receiveMemories, null, { title: why });
  }
  return menuItem(strings.menu.receiveMemories, () => {
    const items = sources.map((source) => menuItem(
      source.email ? [cardName(source), h('span', { class: 'menu-email' }, source.email)] : cardName(source),
      () => void receiveMemories(source, target),
    ));
    showMenu(owner, items, strings.menu.memoriesFrom);
  });
}

function closeMenu(focusOwner = false): void {
  if (!menuOwner) return;
  menu.hidden = true;
  menuOwner.setAttribute('aria-expanded', 'false');
  if (focusOwner) menuOwner.focus();
  menuOwner = null;
}

menu.addEventListener('keydown', (e) => {
  const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  const index = items.indexOf(document.activeElement as HTMLElement);
  if (e.key === 'Escape') closeMenu(true);
  if (e.key === 'ArrowDown') items[(index + 1) % items.length]?.focus();
  if (e.key === 'ArrowUp') items[(index - 1 + items.length) % items.length]?.focus();
  if (e.key === 'Tab') closeMenu();
});
document.addEventListener('mousedown', (e) => {
  const target = e.target as Node;
  if (menuOwner && !menu.contains(target) && !menuOwner.contains(target)) closeMenu();
});
window.addEventListener('resize', () => closeMenu());
byId('cards').addEventListener('scroll', () => closeMenu());

// ---------- Focus back to what opened a dialog (0.7.0) ----------
// Cards are drawn again after most actions, so the opener is also found again by its data-focus-key (the card's ⋯
// button). A chain of dialogs (details → sign-in → result) returns to the first opener.

let focusBack: { el: Element | null; key: string | null } | null = null;

function openModal(d: HTMLDialogElement): void {
  if (!focusBack) {
    const el = document.activeElement;
    focusBack = { el, key: el instanceof HTMLElement ? el.dataset.focusKey ?? null : null };
  }
  d.showModal();
}

function restoreFocus(): void {
  if (!focusBack || document.querySelector('dialog[open]')) return;
  const { el, key } = focusBack;
  focusBack = null;
  const target = el instanceof HTMLElement && el.isConnected && el !== document.body ? el
    : key ? document.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(key)}"]`) ?? byId('add-account') : null;
  target?.focus();
}

for (const d of document.querySelectorAll('dialog')) d.addEventListener('close', () => setTimeout(restoreFocus, 0));

// ---------- Rename / remove dialog ----------

const dialog = byId<HTMLDialogElement>('dialog');
const dialogInput = byId<HTMLInputElement>('dialog-input');
const dialogConfirm = byId<HTMLButtonElement>('dialog-confirm');
byId('dialog-cancel').textContent = strings.cancel;
byId('dialog-cancel').addEventListener('click', () => dialog.close());

/** Resolves with the typed text (or '' without a field) on confirm, null on cancel. */
function ask(opts: {
  title: string; body?: string; value?: string; confirm: string; danger?: boolean; cancel?: boolean;
  /** Cancel in red (Receive memories warning). */
  cancelDanger?: boolean;
}): Promise<string | null> {
  byId('dialog-title').textContent = opts.title;
  byId('dialog-body').textContent = opts.body ?? '';
  dialogInput.hidden = opts.value === undefined;
  dialogInput.value = opts.value ?? '';
  dialogConfirm.textContent = opts.confirm;
  dialogConfirm.classList.toggle('danger', opts.danger === true);
  byId('dialog-cancel').hidden = opts.cancel === false;
  byId('dialog-cancel').classList.toggle('danger', opts.cancelDanger === true);
  dialog.returnValue = '';
  openModal(dialog);
  if (opts.value !== undefined) dialogInput.select();
  else dialogConfirm.focus();
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm' ? dialogInput.value : null), { once: true });
  });
}

async function rename(account: Account): Promise<void> {
  const label = await ask({ title: strings.rename.title, value: cardName(account), confirm: strings.rename.save });
  if (label === null) return;
  state = await api.renameAccount(account.id, label);
  renderCards();
}

// ---------- Add account / Edit details: typed by the person (WINDOWS.md §5) ----------

const detailsDialog = byId<HTMLDialogElement>('details');
const detailsName = byId<HTMLInputElement>('details-name');
const detailsEmail = byId<HTMLInputElement>('details-email');
const detailsRealName = byId<HTMLInputElement>('details-real-name');
const detailsError = byId('details-error');
byId('details-name-label').textContent = strings.details.cardName;
byId('details-email-label').textContent = strings.details.email;
byId('details-real-name-label').textContent = strings.details.realName;
byId('details-cancel').textContent = strings.cancel;
byId('details-cancel').addEventListener('click', () => detailsDialog.close());

/**
 * Card name (only when adding), e-mail (required) and real name (optional). Enter or the button checks the fields:
 * a missing or invalid one keeps the dialog open with a message. Resolves null on Cancel / Esc.
 */
function askDetails(opts: {
  title: string; body: string; confirm: string; name?: string; email: string; realName: string;
}): Promise<{ name: string } & Details | null> {
  byId('details-title').textContent = opts.title;
  byId('details-body').textContent = opts.body;
  byId('details-name-row').hidden = opts.name === undefined;
  detailsName.value = opts.name ?? '';
  detailsEmail.value = opts.email;
  detailsRealName.value = opts.realName;
  detailsError.textContent = '';
  byId('details-confirm').textContent = opts.confirm;
  detailsDialog.returnValue = '';
  openModal(detailsDialog);
  (opts.name !== undefined ? detailsName : detailsEmail).focus();
  return new Promise((resolve) => {
    let value: ({ name: string } & Details) | null = null;
    const form = detailsDialog.querySelector('form')!;
    const onSubmit = (e: SubmitEvent): void => {
      const name = detailsName.value.trim();
      const checked = checkDetails(detailsEmail.value, detailsRealName.value);
      const error = opts.name !== undefined && !name ? strings.details.nameMissing
        : 'error' in checked ? strings.details.errors[checked.error] : null;
      if (error) {
        e.preventDefault();
        detailsError.textContent = error;
        (opts.name !== undefined && !name ? detailsName : detailsEmail).focus();
        return;
      }
      if (!('error' in checked)) value = { name, ...checked };
    };
    form.addEventListener('submit', onSubmit);
    detailsDialog.addEventListener('close', () => {
      form.removeEventListener('submit', onSubmit);
      resolve(detailsDialog.returnValue === 'confirm' ? value : null);
    }, { once: true });
  });
}

async function editDetails(account: Account): Promise<void> {
  const details = await askDetails({
    title: strings.details.editTitle(cardName(account)), body: strings.details.editBody, confirm: strings.details.save,
    email: account.email ?? '', realName: account.realName ?? '',
  });
  if (!details) return;
  state = await api.setDetails(account.id, details.email, details.realName ?? '');
  renderCards();
}

// ---------- Change photo (SCOPE §2.3): cropped to a centred square here, saved by the main process ----------

const photoInput = byId<HTMLInputElement>('photo-input');
let photoFor: Account | null = null;
photoInput.addEventListener('change', () => {
  const file = photoInput.files?.[0];
  const account = photoFor;
  photoInput.value = ''; // picking the same file again fires change again
  if (file && account) void usePhoto(account, file);
});

function pickPhoto(account: Account): void {
  photoFor = account;
  photoInput.click();
}

/** Square PNG (PHOTO_SIZE) from the centre of the image. Throws if the file is not an image the browser decodes. */
async function squarePng(file: Blob): Promise<string> {
  const image = await createImageBitmap(file);
  try {
    const crop = squareCrop(image.width, image.height);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = PHOTO_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No canvas');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, crop.x, crop.y, crop.size, crop.size, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
    return canvas.toDataURL('image/png');
  } finally {
    image.close();
  }
}

async function usePhoto(account: Account, file: File): Promise<void> {
  try {
    await setPhoto(account, await squarePng(file));
  } catch {
    await ask({ title: strings.photo.failed.title, body: strings.photo.failed.body, confirm: strings.ok, cancel: false });
  }
}

async function setPhoto(account: Account, dataUrl: string | null): Promise<void> {
  state = await api.setPhoto(account.id, dataUrl);
  renderCards();
}

async function remove(account: Account): Promise<void> {
  const name = cardName(account);
  /** A running account gets "Cancel" / "Close and remove" (its folder is locked while Claude runs). */
  const askRunning = (): Promise<string | null> => ask({
    title: strings.remove.title, body: strings.remove.runningBody(name), confirm: strings.remove.closeAndRemove, danger: true,
  });
  const isRunning = running.has(account.id);
  const ok = isRunning
    ? await askRunning()
    : await ask({ title: strings.remove.title, body: strings.remove.body(name), confirm: strings.remove.confirm, danger: true });
  if (ok === null) return;
  let result = await api.removeAccount(account.id, isRunning);
  // The "Running" indicator is refreshed every ~3 s: the account may have started in between.
  if (result.error === 'running') {
    if ((await askRunning()) === null) return;
    result = await api.removeAccount(account.id, true);
  }
  await showResult(result);
  await refreshRunning();
}

async function closeAccount(account: Account): Promise<void> {
  await showResult(await api.closeAccount(account.id));
  await refreshRunning();
}

// ---------- Receive memories from… (Phase 5.1): a guided copy and paste ----------
// The text is sent to the main process, which keeps it only in memory; Done / Cancel / Esc clear it there and here.
// From Claude's exported .zip the person checks which files to bring; over the limit, the text goes in parts of
// whole files, imported one Start import at a time.

const memoriesDialog = byId<HTMLDialogElement>('memories');
const memoriesText = byId<HTMLTextAreaElement>('memories-text');
const memoriesError = byId('memories-error');
const memoriesNext = byId<HTMLButtonElement>('memories-next');
const memoriesCopy = byId<HTMLButtonElement>('memories-copy');
const memoriesFiles = byId('memories-files');
const memoriesTotal = byId('memories-total');
const memoriesPart = byId('memories-part');
const memoriesTip = byId('memories-tip');
memoriesText.placeholder = strings.memories.copy.placeholder;
byId('memories-cancel').textContent = strings.cancel;
const memoriesFile = byId<HTMLButtonElement>('memories-file');
const memoriesFileInput = byId<HTMLInputElement>('memories-file-input');
memoriesFile.textContent = strings.memories.copy.chooseFile;
/** Set while a transfer runs: what Next / Done / Cancel do. */
let memoriesStep: 'copy' | 'import' | null = null;
/** The files of the exported .zip while step 1 shows their checklist (null = pasted text or a .txt / .md file). */
let zipFiles: MemoryFile[] | null = null;
const checkedPaths = new Set<string>();
/** Step 2: how many parts the main process holds, and which one is on the clipboard (0-based). */
let partCount = 0;
let partIndex = 0;

const characters = (n: number): string => n.toLocaleString('en');

async function receiveMemories(source: Account, target: Account): Promise<void> {
  const refused = await api.memories.begin(source.id, target.id);
  if (refused) return showResult({ state, error: refused });
  const ok = await ask({
    title: strings.memories.warning.title,
    body: strings.memories.warning.body(cardName(source), cardName(target)),
    confirm: strings.memories.warning.proceed,
    cancelDanger: true,
  });
  if (ok === null) return api.memories.cancel();
  showCopyStep(source, target);
  memoriesNext.disabled = true;
  memoriesTip.textContent = strings.memories.copy.opening;
  const error = await api.memories.proceed().catch(() => 'launchFailed' as const);
  if (memoriesStep !== 'copy') return; // cancelled meanwhile
  if (error) {
    await closeMemories();
    return showResult({ state, error });
  }
  memoriesNext.disabled = false;
  if (!zipFiles) memoriesTip.textContent = strings.memories.copy.tip;
}

function showSteps(title: string, body: string, steps: readonly string[]): void {
  byId('memories-title').textContent = title;
  byId('memories-body').textContent = body;
  byId('memories-steps').replaceChildren(...steps.map((line) => h('li', {}, line)));
  memoriesError.textContent = '';
}

function showCopyStep(source: Account, target: Account): void {
  memoriesStep = 'copy';
  const text = strings.memories.copy;
  showSteps(text.title(cardName(source)), text.body(cardName(source)), text.steps);
  memoriesText.hidden = false;
  memoriesFile.hidden = false;
  memoriesCopy.hidden = true;
  memoriesPart.textContent = '';
  memoriesTip.textContent = text.tip;
  memoriesNext.textContent = text.next;
  memoriesNext.onclick = () => void useMemories(target);
  if (!memoriesDialog.open) openModal(memoriesDialog);
  memoriesText.focus();
}

function showImportStep(target: Account): void {
  memoriesStep = 'import';
  const text = strings.memories.import;
  const name = cardName(target);
  const many = partCount > 1;
  showSteps(text.title(name), many ? text.partsBody(name, partCount) : text.body(name), text.steps);
  memoriesText.hidden = true;
  memoriesFile.hidden = true;
  memoriesFiles.hidden = true;
  memoriesTotal.textContent = '';
  memoriesCopy.hidden = false;
  memoriesCopy.textContent = many ? text.copyPart : text.copyAgain;
  memoriesTip.textContent = '';
  renderPart();
  memoriesNext.onclick = () => void nextPart();
  memoriesNext.focus();
}

/** "Part 2 of 3 is on the clipboard"; the last part (or the only one) gets Done. */
function renderPart(): void {
  const last = partIndex >= partCount - 1;
  memoriesPart.textContent = partCount > 1 ? strings.memories.import.partOnClipboard(partIndex + 1, partCount) : '';
  memoriesNext.textContent = last ? strings.memories.import.done : strings.memories.import.nextPart;
}

async function nextPart(): Promise<void> {
  if (partIndex >= partCount - 1) return closeMemories(true);
  memoriesNext.disabled = true;
  try {
    await api.memories.copyPart(partIndex + 1);
    partIndex++;
    memoriesTip.textContent = '';
    renderPart();
  } finally {
    memoriesNext.disabled = false;
  }
}

memoriesCopy.addEventListener('click', () => {
  void api.memories.copyPart(partIndex).then(() => {
    memoriesTip.textContent = partCount > 1
      ? strings.memories.import.partCopied(partIndex + 1, partCount)
      : strings.memories.import.copied;
  });
});

// --- Step 1: the .zip checklist ---

/** The checked files, in the order of the list (top level first, then folders in path order). */
function checkedFiles(): MemoryFile[] {
  return zipFiles ? memoryFolders(zipFiles).flatMap((g) => g.files).filter((f) => checkedPaths.has(f.path)) : [];
}

function useZip(files: MemoryFile[]): void {
  zipFiles = files;
  checkedPaths.clear();
  for (const f of files) if (checkedByDefault(f.path)) checkedPaths.add(f.path);
  memoriesText.readOnly = true; // the box shows the checked files; the checklist decides what goes
  memoriesText.rows = 3; // a preview: the list needs the room
  memoriesFiles.hidden = false;
  memoriesTip.textContent = strings.memories.copy.fromZip(files.length, files.some((f) => !checkedByDefault(f.path)));
  renderChecklist();
}

function leaveZip(): void {
  zipFiles = null;
  checkedPaths.clear();
  memoriesText.readOnly = false;
  memoriesText.rows = 7;
  memoriesFiles.hidden = true;
  memoriesFiles.replaceChildren();
  memoriesTotal.textContent = '';
}

function renderChecklist(): void {
  if (!zipFiles) return;
  const scroll = memoriesFiles.scrollTop;
  const checkbox = (checked: boolean, onChange: (on: boolean) => void): HTMLInputElement => {
    const box = h('input', { type: 'checkbox' });
    box.checked = checked;
    box.addEventListener('change', () => { onChange(box.checked); renderChecklist(); });
    return box;
  };
  memoriesFiles.replaceChildren(...memoryFolders(zipFiles).map(({ folder, files }) => {
    const on = files.filter((f) => checkedPaths.has(f.path)).length;
    const all = checkbox(on === files.length, (value) => {
      for (const f of files) value ? checkedPaths.add(f.path) : checkedPaths.delete(f.path);
    });
    all.indeterminate = on > 0 && on < files.length;
    const rows = files.map((f) => h('label', { class: 'file' },
      checkbox(checkedPaths.has(f.path), (value) => { value ? checkedPaths.add(f.path) : checkedPaths.delete(f.path); }),
      h('span', { class: 'clip' }, f.path.slice(folder ? folder.length + 1 : 0)),
      h('span', { class: 'size' }, characters(memorySection(f).length)),
    ));
    return h('div', { class: 'group' },
      h('label', { class: 'folder' }, all, folder ? `${folder}/` : strings.memories.copy.topLevel), ...rows);
  }));
  memoriesFiles.scrollTop = scroll;

  const chosen = checkedFiles();
  const text = joinMemoryFiles(chosen);
  memoriesText.value = text;
  const split = splitMemoryParts(chosen);
  memoriesTotal.textContent = strings.memories.copy.total(
    chosen.length, zipFiles.length, characters(text.length), 'parts' in split ? split.parts.length : 0,
  );
  memoriesError.textContent = 'error' in split && split.error === 'fileTooLong' ? tooLongFile(split.path) : '';
}

function tooLongFile(path: string): string {
  const file = zipFiles?.find((f) => f.path === path);
  return strings.memories.fileTooLong(path, characters(file ? memorySection(file).length : 0));
}

/** Next: the checked files in parts (or the pasted text as one part) go to the main process. */
async function useMemories(target: Account): Promise<void> {
  let parts: string[];
  if (zipFiles) {
    const split = splitMemoryParts(checkedFiles());
    if ('error' in split) {
      memoriesError.textContent = split.error === 'empty' ? strings.memories.noneChecked : tooLongFile(split.path);
      return;
    }
    parts = split.parts;
  } else {
    const checked = checkMemoryText(memoriesText.value);
    if ('error' in checked) {
      memoriesError.textContent = checked.error === 'tooLong'
        ? strings.memories.pastedTooLong(characters(memoriesText.value.trim().length))
        : strings.memories.errors.empty;
      memoriesText.focus();
      return;
    }
    parts = [checked.text];
  }
  memoriesNext.disabled = true;
  try {
    const error = await api.memories.useParts(parts);
    // The main process holds the text now (and the clipboard): nothing stays in the window.
    memoriesText.value = '';
    leaveZip();
    partCount = parts.length;
    partIndex = 0;
    showImportStep(target);
    // Part 1 is on the clipboard: the person can still open the account and paste.
    if (error) memoriesError.textContent = strings.errors[error].title;
  } finally {
    memoriesNext.disabled = false;
  }
}

/** Done or Cancel (Esc too): the text is forgotten here and in the main process. */
async function closeMemories(done = false): Promise<void> {
  if (memoriesStep === null) return;
  memoriesStep = null;
  memoriesText.value = '';
  leaveZip();
  partCount = 0;
  partIndex = 0;
  if (memoriesDialog.open) memoriesDialog.close();
  await (done ? api.memories.finish() : api.memories.cancel());
}

byId('memories-cancel').addEventListener('click', () => void closeMemories());
memoriesDialog.addEventListener('close', () => void closeMemories()); // Esc

// The exported .zip (or a .txt / .md file), dropped or chosen. It is read here, in memory only: nothing is
// extracted to disk and nothing is logged. A drop anywhere else does nothing (Electron would otherwise open the
// file in the window).
async function loadMemoryFile(file: File): Promise<void> {
  memoriesError.textContent = '';
  if (/\.zip$/i.test(file.name)) {
    if (file.size > MAX_ZIP_FILE_BYTES) {
      memoriesError.textContent = strings.memories.zipErrors.tooBig;
      return;
    }
    memoriesTip.textContent = strings.memories.copy.reading;
    const result = await readMemoryZip(new Uint8Array(await file.arrayBuffer()));
    if (memoriesStep !== 'copy') return; // cancelled meanwhile
    if ('error' in result) {
      memoriesTip.textContent = zipFiles ? memoriesTip.textContent : strings.memories.copy.tip;
      memoriesError.textContent = strings.memories.zipErrors[result.error];
      return;
    }
    useZip(result.files);
  } else if (/\.(txt|md)$/i.test(file.name)) {
    // A UTF-8 character is at most 4 bytes: a bigger file cannot fit the limit.
    if (file.size > MAX_MEMORY_CHARS * 4) {
      memoriesError.textContent = strings.memories.pastedTooLong(`more than ${characters(MAX_MEMORY_CHARS)}`);
      return;
    }
    leaveZip();
    memoriesText.value = await file.text();
    memoriesTip.textContent = strings.memories.copy.tip;
    const length = memoriesText.value.trim().length;
    if (length > MAX_MEMORY_CHARS) memoriesError.textContent = strings.memories.pastedTooLong(characters(length));
  } else {
    memoriesError.textContent = strings.memories.fileType;
  }
}

memoriesFile.addEventListener('click', () => memoriesFileInput.click());
memoriesFileInput.addEventListener('change', () => {
  const file = memoriesFileInput.files?.[0];
  memoriesFileInput.value = ''; // the same file can be chosen again
  if (file) void loadMemoryFile(file);
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());
memoriesText.addEventListener('dragenter', () => memoriesText.classList.add('drop'));
memoriesText.addEventListener('dragleave', () => memoriesText.classList.remove('drop'));
memoriesText.addEventListener('drop', (e) => {
  e.preventDefault();
  memoriesText.classList.remove('drop');
  const file = e.dataTransfer?.files[0];
  if (file) void loadMemoryFile(file);
});

// ---------- Sign-in (WINDOWS.md §4): the main process runs the flow, the window shows its progress ----------

/** Sign-in is off when the main Claude profile was not found with confidence: explain instead of starting. */
async function explainSignInOff(): Promise<boolean> {
  if (!signInOff()) return false;
  await showResult({ state, error: 'noProfile' });
  return true;
}

function renderSignInAvailability(): void {
  const off = signInOff();
  add.setAttribute('aria-disabled', String(off));
  add.title = off ? strings.signInOff : '';
  const note = byId('signin-note');
  note.textContent = off ? strings.signInOff : '';
  note.hidden = !off;
}

async function addNew(): Promise<void> {
  if (await explainSignInOff()) return;
  const details = await askDetails({
    title: strings.add.title, body: strings.add.body, confirm: strings.add.confirm, name: '', email: '', realName: '',
  });
  if (!details) return;
  await startSignIn({ label: details.name, email: details.email, realName: details.realName ?? '' });
}

async function signIn(account: Account): Promise<void> {
  if (await explainSignInOff()) return;
  const ok = await ask({ title: strings.signIn.title(cardName(account)), body: strings.signIn.body, confirm: strings.signIn.start });
  if (ok === null) return;
  await startSignIn({ accountId: account.id });
}

/** True between the click and the reply: "starting" steps are shown only then (never a stale one later). */
let starting = false;

/** The dialog shows at once with its steps; the main process moves them on while it works. */
async function startSignIn(target: SignInTarget): Promise<void> {
  starting = true;
  showSignIn({ phase: 'starting', step: 'closing' });
  let result: ActionResult;
  try {
    result = await api.startSignIn(target);
  } finally {
    starting = false;
  }
  if (result.error && signInDialog.open) {
    signInDialog.close();
    shownPhase = null;
  }
  // The "waiting" status normally arrived already; this only covers a missed one.
  if (!result.error && shownPhase === 'starting') showSignIn({ phase: 'waiting' });
  await showResult(result);
}

const signInDialog = byId<HTMLDialogElement>('signin');
const signInConfirm = byId<HTMLButtonElement>('signin-confirm');
const signInCancel = byId<HTMLButtonElement>('signin-cancel');
signInConfirm.textContent = strings.signIn.confirm;
signInCancel.textContent = strings.cancel;
signInDialog.addEventListener('cancel', (e) => e.preventDefault()); // Esc does nothing: the buttons decide
const lockSignIn = (): void => { signInConfirm.disabled = true; signInCancel.disabled = true; };
signInConfirm.addEventListener('click', () => {
  lockSignIn();
  void (shownPhase === 'notSaved' ? api.waitLongerSignIn() : shownPhase === 'notFound' ? api.finishSignIn() : api.confirmSignIn());
});
signInCancel.addEventListener('click', () => { lockSignIn(); void api.cancelSignIn(); });
const signInSteps = byId<HTMLOListElement>('signin-steps');
let shownPhase: SignInStatus['phase'] | null = null;

/** The start steps: done ✓, the current one, the next ones dimmed. */
function renderSteps(current: StartStep): void {
  const at = START_STEPS.indexOf(current);
  signInSteps.replaceChildren(...START_STEPS.map((step, i) =>
    h('li', { class: i < at ? 'done' : i === at ? 'current' : 'next' }, strings.signIn.starting.steps[step])));
}

function showSignIn(status: SignInStatus): void {
  if (status.phase === 'starting' && !starting) return; // a step that arrived after the reply
  shownPhase = status.phase;
  signInConfirm.textContent = status.phase === 'notSaved' ? strings.signIn.notSaved.waitLonger
    : status.phase === 'notFound' ? strings.signIn.finishByHand : strings.signIn.confirm;
  signInSteps.hidden = status.phase !== 'starting';
  signInConfirm.hidden = status.phase === 'starting'; // nothing to confirm before the sign-in window is up
  if (status.phase === 'starting') {
    byId('signin-title').textContent = strings.signIn.starting.title;
    byId('signin-body').textContent = '';
    renderSteps(status.step);
    lockSignIn(); // nothing to confirm or cancel until the sign-in window is up
    if (!signInDialog.open) openModal(signInDialog);
    return;
  }
  if (status.phase === 'checking' || status.phase === 'notFound') {
    // "I've signed in": countdown, then the hint. Cancel stays available; nothing was moved.
    byId('signin-title').textContent = strings.signIn.waiting.title;
    byId('signin-body').textContent = status.phase === 'checking'
      ? strings.signIn.checking(status.secondsLeft) : strings.signIn.notFound;
    signInConfirm.disabled = status.phase === 'checking';
    signInCancel.disabled = false;
    if (!signInDialog.open) openModal(signInDialog);
    return;
  }
  if (status.phase === 'notSaved') {
    // Nothing moved yet: Wait longer (another ~45 s) or Cancel (puts the main profile back).
    byId('signin-title').textContent = strings.signIn.notSaved.title;
    byId('signin-body').textContent = strings.signIn.notSaved.body;
    signInConfirm.disabled = false;
    signInCancel.disabled = false;
    if (!signInDialog.open) openModal(signInDialog);
    return;
  }
  if (status.phase === 'waiting' || status.phase === 'saving') {
    const text = strings.signIn[status.phase];
    byId('signin-title').textContent = text.title;
    byId('signin-body').textContent = text.body;
    const saving = status.phase === 'saving';
    signInConfirm.disabled = saving;
    signInCancel.disabled = saving;
    if (!signInDialog.open) openModal(signInDialog);
    return;
  }
  if (signInDialog.open) signInDialog.close();
  shownPhase = null;
  void signInFinished(status);
}

async function signInFinished(status: SignInStatus): Promise<void> {
  state = await api.getState();
  renderCards();
  renderSignInAvailability();
  if (status.phase === 'done') {
    // The main Claude was already put back (and reopened if it was open); now open the new account so the person
    // lands in it. The launcher closes once its window is visible.
    await showResult(await api.openAccount(status.account.id));
  } else if (status.phase === 'failed') {
    await ask({
      title: strings.signIn.failed.title, body: strings.signIn.failed.body(status.stashPath), confirm: strings.ok, cancel: false,
    });
  }
}

api.onSignIn(showSignIn);

/** Shows the new cards, or the error message in the dialog. */
async function showResult(result: ActionResult): Promise<void> {
  state = result.state;
  renderCards();
  renderSignInAvailability();
  if (result.error) {
    const text = strings.errors[result.error];
    const body = result.error === 'noProfile' ? `${text.body}\n\n${state.signInLog}` : text.body;
    await ask({ title: text.title, body, confirm: strings.ok, cancel: false });
  }
}

// ---------- Self-update (Phase 5.2, 0.6.2): What's new / Later / Install; nothing is ever forced ----------

const updateDialog = byId<HTMLDialogElement>('update');
const updateProgress = byId<HTMLProgressElement>('update-progress');
const updateError = byId('update-error');
const updateReleases = byId<HTMLButtonElement>('update-releases');
const updateNotes = byId<HTMLButtonElement>('update-notes');
const updateLater = byId<HTMLButtonElement>('update-later');
const updateInstall = byId<HTMLButtonElement>('update-install');
const updateLink = byId<HTMLButtonElement>('update-link');
updateNotes.textContent = strings.update.whatsNew;
updateInstall.textContent = strings.update.install;
updateReleases.textContent = strings.update.releases;

let updateRunning = false;
/** The newer version on offer (dialog and corner link), or null. */
let updateOffer: string | null = null;
/** Later was chosen: a re-sent notice only updates the corner link, it does not open the dialog again. */
let updateDeferred = false;

updateNotes.addEventListener('click', () => void api.updates.openNotes());
updateReleases.addEventListener('click', () => void api.updates.openReleases());
updateLater.addEventListener('click', () => closeUpdate());
updateInstall.addEventListener('click', () => void installUpdate());
updateLink.addEventListener('click', () => void reopenUpdate());
updateDialog.addEventListener('cancel', (e) => {
  e.preventDefault(); // Esc = Later, never while downloading or installing
  if (!updateRunning) closeUpdate();
});
updateDialog.addEventListener('close', renderUpdateLink);

/** "Update to X" next to the version label: only while a newer version is known and its dialog is closed. */
function renderUpdateLink(): void {
  updateLink.hidden = !updateOffer || updateRunning || updateDialog.open;
  if (updateOffer) updateLink.textContent = strings.update.link(updateOffer);
}

function closeUpdate(): void {
  updateDeferred = true;
  updateDialog.close();
  void api.updates.later();
}

async function installUpdate(): Promise<void> {
  updateError.textContent = '';
  updateInstall.disabled = true;
  const error = await api.updates.install().catch(() => null);
  updateInstall.disabled = false;
  if (error) updateError.textContent = strings.update.busy;
}

/** The corner link: the same dialog again; during a sign-in or the memory assistant, the busy message. */
async function reopenUpdate(): Promise<void> {
  if (!updateOffer) return;
  const error = await api.updates.show().catch(() => null);
  renderUpdate({ phase: 'available', version: updateOffer });
  if (error) updateError.textContent = strings.update.busy;
}

function showUpdate(status: UpdateStatus): void {
  if (status.phase === 'none') {
    updateOffer = null;
    if (updateDialog.open && !updateRunning) updateDialog.close();
    renderUpdateLink();
    return;
  }
  if (status.phase === 'available') {
    updateOffer = status.version;
    // After Later the corner link is enough. Never on top of another dialog: it waits until that one is closed.
    if (updateDeferred && !updateDialog.open) return renderUpdateLink();
    if (!updateDialog.open && document.querySelector('dialog[open]')) {
      renderUpdateLink();
      setTimeout(() => showUpdate(status), 1_000);
      return;
    }
  }
  renderUpdate(status);
}

function renderUpdate(status: Exclude<UpdateStatus, { phase: 'none' }>): void {
  updateRunning = status.phase === 'downloading' || status.phase === 'installing';
  byId('update-title').textContent = status.phase === 'failed'
    ? strings.update.failedTitle(status.version) : strings.update.title(status.version);
  byId('update-body').textContent = status.phase === 'available' ? strings.update.body
    : status.phase === 'downloading' ? strings.update.downloading(status.percent)
      : status.phase === 'installing' ? strings.update.installing : '';
  updateProgress.hidden = !updateRunning;
  updateProgress.value = status.phase === 'downloading' ? status.percent : 100;
  updateError.textContent = status.phase === 'failed' ? strings.update.failed : '';
  updateReleases.hidden = status.phase !== 'failed';
  updateNotes.hidden = status.phase !== 'available';
  updateInstall.hidden = status.phase !== 'available';
  updateLater.hidden = updateRunning;
  updateLater.textContent = status.phase === 'failed' ? strings.update.close : strings.update.later;
  if (!updateDialog.open) {
    openModal(updateDialog);
    updateInstall.focus();
  }
  renderUpdateLink();
}

api.updates.onStatus(showUpdate);

// ---------- Start ----------

document.title = strings.appName;
byId('app-name').textContent = strings.appName;
byId('cards').setAttribute('aria-label', strings.accounts);
const add = byId('add-account');
add.textContent = `+ ${strings.addAccount}`;
add.addEventListener('click', () => void addNew());

state = await api.getState();
const version = byId('version');
version.textContent = strings.version(state.version);
version.title = strings.logs(state.timingsLog);
version.addEventListener('click', () => void api.openVersionNotes());
// "Copy diagnostics" (0.7.0): the main process builds the report; the link says "Copied" for ~2 s.
const diagnostics = byId<HTMLButtonElement>('diagnostics');
diagnostics.textContent = strings.diagnostics.link;
let diagnosticsTimer: ReturnType<typeof setTimeout> | undefined;
diagnostics.addEventListener('click', async () => {
  const copied = await api.copyDiagnostics().catch(() => false);
  diagnostics.textContent = copied ? strings.diagnostics.copied : strings.diagnostics.failed;
  clearTimeout(diagnosticsTimer);
  diagnosticsTimer = setTimeout(() => { diagnostics.textContent = strings.diagnostics.link; }, 2_000);
});
renderGreetingText();
renderName();
renderCards();
renderSignInAvailability();
// Right after the cards are in the page: the startup time is logged and the cookie checks start (background).
// Not requestAnimationFrame: the window is still hidden until ready-to-show, where frames may not run.
setTimeout(() => void api.cardsShown(), 0);
setInterval(renderGreetingText, 30_000); // follows the morning/afternoon/evening boundary
void pollRunning();
if (state.signIn) showSignIn(state.signIn); // a sign-in resumed on startup
