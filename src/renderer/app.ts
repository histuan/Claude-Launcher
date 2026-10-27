import {
  START_STEPS, type ActionResult, type LauncherApi, type LauncherState, type SignInStatus, type SignInTarget, type StartStep,
} from '../core/api.js';
import { cardBadge } from '../core/card.js';
import type { Account } from '../core/config.js';
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
      h('span', { class: 'avatar', 'aria-hidden': 'true' }, initial(name)),
      h('span', { class: 'label clip' }, name),
      h('span', { class: 'email clip' }, account.email ?? (isSignedOut(account) ? strings.signIn.notSignedIn : '')),
      h('span', { class: 'real-name clip' }, account.realName ?? ''),
    );
    open.addEventListener('click', () => void (isSignedOut(account) ? signIn(account) : openAccount(account, open)));
    const status = h('span', { class: 'running', 'data-id': account.id }, strings.running);
    status.hidden = !running.has(account.id);
    const badge = cardBadge(account);
    const extra = badge ? [h('span', { class: 'badge' }, strings.badges[badge])] : [];
    const more = h('button', {
      class: 'card-menu', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false',
      'aria-label': strings.accountOptions(name), title: strings.accountOptions(name),
    }, '⋯');
    more.addEventListener('click', () => openMenu(account, more));
    return h('div', { class: 'card' }, open, status, ...extra, more);
  });
  byId('cards').replaceChildren(...cards);
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

function renderRunning(): void {
  for (const el of document.querySelectorAll<HTMLElement>('.running')) el.hidden = !running.has(el.dataset.id ?? '');
}

async function refreshRunning(): Promise<void> {
  try {
    running = new Set(await api.runningAccounts());
    renderRunning();
  } catch {
    // keep the last known state; the next poll tries again
  }
}

async function pollRunning(): Promise<void> {
  if (!document.hidden) await refreshRunning();
  setTimeout(() => void pollRunning(), 3000);
}

// Full text in a tooltip only when it is cut with an ellipsis.
document.addEventListener('mouseover', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('.clip');
  if (el) el.title = el.scrollWidth > el.clientWidth ? (el.textContent ?? '') : '';
});

// ---------- Card ⋯ menu (SCOPE §2.3) ----------

const menu = byId('menu');
let menuOwner: HTMLElement | null = null;

function openMenu(account: Account, owner: HTMLElement): void {
  if (menuOwner === owner) return closeMenu();
  closeMenu();
  const item = (text: string, action: (() => void) | null, extra: Record<string, string> = {}): HTMLButtonElement => {
    const button = h('button', { type: 'button', role: 'menuitem', ...extra }, text);
    if (action) {
      button.addEventListener('click', () => { closeMenu(); action(); });
    } else {
      button.setAttribute('aria-disabled', 'true');
      button.title = extra.title ?? strings.comingSoon;
    }
    return button;
  };
  const items = !isSignedOut(account) ? []
    : [signInOff() ? item(strings.menu.signIn, null, { title: strings.signInOff }) : item(strings.menu.signIn, () => void signIn(account))];
  items.push(
    item(strings.menu.rename, () => void rename(account)),
    item(strings.menu.changePhoto, null), // the photo picker arrives in Phase 5
    running.has(account.id)
      ? item(strings.menu.close, () => void closeAccount(account))
      : item(strings.menu.close, null, { title: strings.menu.closeOff }),
  );
  if (!isMain(account)) items.push(item(strings.menu.remove, () => void remove(account), { class: 'danger' }));
  menu.replaceChildren(...items);
  menu.hidden = false;

  const box = owner.getBoundingClientRect();
  const left = Math.min(box.left, window.innerWidth - menu.offsetWidth - 8);
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${box.bottom + 4}px`;
  menuOwner = owner;
  owner.setAttribute('aria-expanded', 'true');
  items[0]?.focus();
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

// ---------- Rename / remove dialog ----------

const dialog = byId<HTMLDialogElement>('dialog');
const dialogInput = byId<HTMLInputElement>('dialog-input');
const dialogConfirm = byId<HTMLButtonElement>('dialog-confirm');
byId('dialog-cancel').textContent = strings.cancel;
byId('dialog-cancel').addEventListener('click', () => dialog.close());

/** Resolves with the typed text (or '' without a field) on confirm, null on cancel. */
function ask(opts: {
  title: string; body?: string; value?: string; confirm: string; danger?: boolean; cancel?: boolean;
}): Promise<string | null> {
  byId('dialog-title').textContent = opts.title;
  byId('dialog-body').textContent = opts.body ?? '';
  dialogInput.hidden = opts.value === undefined;
  dialogInput.value = opts.value ?? '';
  dialogConfirm.textContent = opts.confirm;
  dialogConfirm.classList.toggle('danger', opts.danger === true);
  byId('dialog-cancel').hidden = opts.cancel === false;
  dialog.returnValue = '';
  dialog.showModal();
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
  const label = await ask({ title: strings.add.title, body: strings.add.body, value: '', confirm: strings.add.confirm });
  if (label === null || !label.trim()) return;
  await startSignIn({ label });
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
signInConfirm.addEventListener('click', () => { lockSignIn(); void api.confirmSignIn(); });
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
  signInSteps.hidden = status.phase !== 'starting';
  signInConfirm.hidden = status.phase === 'starting'; // nothing to confirm before the sign-in window is up
  if (status.phase === 'starting') {
    byId('signin-title').textContent = strings.signIn.starting.title;
    byId('signin-body').textContent = '';
    renderSteps(status.step);
    lockSignIn(); // nothing to confirm or cancel until the sign-in window is up
    if (!signInDialog.open) signInDialog.showModal();
    return;
  }
  if (status.phase === 'checking' || status.phase === 'notFound') {
    // "I've signed in": countdown, then the hint. Cancel stays available; nothing was moved.
    byId('signin-title').textContent = strings.signIn.waiting.title;
    byId('signin-body').textContent = status.phase === 'checking'
      ? strings.signIn.checking(status.secondsLeft) : strings.signIn.notFound;
    signInConfirm.disabled = status.phase === 'checking';
    signInCancel.disabled = false;
    if (!signInDialog.open) signInDialog.showModal();
    return;
  }
  if (status.phase === 'waiting' || status.phase === 'saving') {
    const text = strings.signIn[status.phase];
    byId('signin-title').textContent = text.title;
    byId('signin-body').textContent = text.body;
    const saving = status.phase === 'saving';
    signInConfirm.disabled = saving;
    signInCancel.disabled = saving;
    if (!signInDialog.open) signInDialog.showModal();
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
  } else if (status.phase === 'noSession') {
    await ask({ title: strings.signIn.noSession.title, body: strings.signIn.noSession.body, confirm: strings.ok, cancel: false });
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

// ---------- Start ----------

document.title = strings.appName;
byId('app-name').textContent = strings.appName;
byId('cards').setAttribute('aria-label', strings.accounts);
const add = byId('add-account');
add.textContent = `+ ${strings.addAccount}`;
add.addEventListener('click', () => void addNew());

state = await api.getState();
byId('version').textContent = strings.version(state.version);
renderGreetingText();
renderName();
renderCards();
renderSignInAvailability();
setInterval(renderGreetingText, 30_000); // follows the morning/afternoon/evening boundary
void pollRunning();
if (state.signIn) showSignIn(state.signIn); // a sign-in resumed on startup
