import { strings } from './strings.js';

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

document.title = strings.appName;
byId('title').textContent = strings.appName;
byId('placeholder').textContent = strings.placeholder;
