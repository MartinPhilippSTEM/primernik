import '@fontsource/newsreader/500.css';
import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/600.css';
import '@fontsource/jetbrains-mono/400.css';
import './styles.css';
import { compare, copyText, TYPE_LABELS, type CompareOptions } from './core/comparisons';
import { fmtExact } from './core/czech';
import { parse, type Interpretation } from './core/parser';
import { powerPresets } from './core/presets';
import { rankPages, WEIGHTS, type Ranked } from './core/ranker';
import { CATEGORY_LABELS, type Category, type Ref } from './core/types';
import { catalog } from './data';

const CURRENT_YEAR = new Date().getFullYear();
const presets = powerPresets(catalog.refs);

// ------------------------------------------------------------ pomocníci DOM

type Child = Node | string | null | undefined | false;
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | ((e: Event) => void)> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false) el.setAttribute(k, v);
  }
  for (const c of children) if (c) el.append(c);
  return el;
}
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const form = $<HTMLFormElement>('form');
const input = $<HTMLInputElement>('q');
const understood = $('understood');
const choices = $('choices');
const controls = $('controls');
const filters = $('filters');
const powerBox = $('power');
const powerSelect = $<HTMLSelectElement>('power-preset');
const powerCustomWrap = $('power-custom-wrap');
const powerHours = $<HTMLInputElement>('power-hours');
const powerNote = $('power-note');
const cpiBox = $('cpi');
const cpiToggle = $<HTMLInputElement>('cpi-toggle');
const cpiLabel = $('cpi-label');
const cpiNote = $('cpi-note');
const results = $<HTMLOListElement>('results');
const status = $('status');
const more = $<HTMLButtonElement>('more');

// ------------------------------------------------------------ stav (zrcadlí se do URL)

interface State {
  q: string;
  pick: number; // zvolený výklad při nejednoznačnosti
  cats: Category[];
  power: string; // id předvolby, '' = nepřevádět, 'vlastni' = vlastní hodiny
  hours: number;
  cpi: boolean;
}

function readUrl(): State {
  const p = new URLSearchParams(location.search);
  return {
    q: p.get('q') ?? '',
    pick: Number(p.get('v') ?? 0) || 0,
    cats: (p.get('k') ?? '').split(',').filter((c): c is Category => c in CATEGORY_LABELS),
    power: p.get('p') ?? '',
    hours: Number(p.get('h') ?? 0) || 1000,
    cpi: p.get('cpi') === '1',
  };
}

function writeUrl(s: State): void {
  const p = new URLSearchParams();
  if (s.q) p.set('q', s.q);
  if (s.pick) p.set('v', String(s.pick));
  if (s.cats.length) p.set('k', s.cats.join(','));
  if (s.power) p.set('p', s.power);
  if (s.power === 'vlastni') p.set('h', String(s.hours));
  if (s.cpi) p.set('cpi', '1');
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

let state = readUrl();
let pages: Ranked[][] = [];
let shownPages = 0;
let current: Interpretation | null = null;

// ------------------------------------------------------------ ovládací prvky

function renderFilters(): void {
  filters.replaceChildren(
    h('span', { class: 'filters-label' }, 'Kategorie:'),
    ...(['all', ...Object.keys(CATEGORY_LABELS)] as const).map((c) => {
      const active = c === 'all' ? state.cats.length === 0 : state.cats.includes(c as Category);
      return h(
        'button',
        {
          type: 'button',
          class: 'chip',
          'aria-pressed': String(active),
          onclick: () => {
            if (c === 'all') state.cats = [];
            else state.cats = active ? state.cats.filter((x) => x !== c) : [...state.cats, c as Category];
            update();
          },
        },
        c === 'all' ? 'Vše' : CATEGORY_LABELS[c as Category],
      );
    }),
  );
}

powerSelect.append(
  h('option', { value: '' }, 'nepřevádět – porovnat jen s výkonem'),
  ...presets.map((p) => h('option', { value: p.id }, `${p.id === 'nepretrzite' ? 'nepřetržitý provoz' : p.label.split(':')[0].replace('typické využití – ', 'typické využití: ')} (${fmtExact(p.hoursPerYear)} h/rok)`)),
  h('option', { value: 'vlastni' }, 'vlastní počet hodin…'),
);
powerSelect.addEventListener('change', () => {
  state.power = powerSelect.value;
  update();
});
powerHours.addEventListener('change', () => {
  state.hours = Math.min(8760, Math.max(1, Math.round(Number(powerHours.value) || 1)));
  update();
});
cpiToggle.addEventListener('change', () => {
  state.cpi = cpiToggle.checked;
  update();
});

function powerAssumption(): CompareOptions['power'] {
  if (!state.power) return null;
  if (state.power === 'vlastni') {
    return { hoursPerYear: state.hours, label: `vlastní předpoklad uživatele: ${fmtExact(state.hours)} h provozu na plný výkon ročně` };
  }
  return presets.find((p) => p.id === state.power) ?? null;
}

// ------------------------------------------------------------ výpočet a vykreslení

let timer: number | undefined;
input.addEventListener('input', () => {
  clearTimeout(timer);
  timer = window.setTimeout(() => {
    state.q = input.value;
    state.pick = 0;
    update();
  }, 350);
});
form.addEventListener('submit', (e) => {
  e.preventDefault();
  clearTimeout(timer);
  state.q = input.value;
  update();
});

function update(): void {
  writeUrl(state);
  renderFilters();
  choices.replaceChildren();
  results.replaceChildren();
  more.hidden = true;
  current = null;
  if (!state.q.trim()) {
    understood.textContent = '';
    controls.hidden = true;
    status.textContent = '';
    return;
  }
  const parsed = parse(state.q, catalog.rates ?? undefined);
  if (!parsed.ok) {
    controls.hidden = true;
    understood.replaceChildren(h('span', { class: 'error' }, parsed.error));
    if (parsed.suggestions) {
      choices.replaceChildren(
        h('span', { class: 'hint' }, 'Myslíte:'),
        ...parsed.suggestions.map((s) =>
          h('button', { type: 'button', class: 'chip', onclick: () => ((input.value = s), (state.q = s), update()) }, s),
        ),
      );
    }
    status.textContent = parsed.error;
    return;
  }
  const list = parsed.interpretations;
  const pick = Math.min(state.pick, list.length - 1);
  current = list[pick];
  understood.replaceChildren('Rozumím: ', h('strong', { class: 'num' }, current.explain), ...current.notes.map((n) => h('span', { class: 'hint block' }, n)));
  if (list.length > 1) {
    choices.replaceChildren(
      h('span', { class: 'hint' }, 'Zápis je nejednoznačný, vyberte výklad:'),
      ...list.map((it, i) =>
        h(
          'button',
          { type: 'button', class: 'chip', 'aria-pressed': String(i === pick), onclick: () => ((state.pick = i), update()) },
          `${it.explain} (${it.notes[0]?.replace('Čtení čísla: ', '').replace(/\.$/, '') ?? ''})`,
        ),
      ),
    );
  }

  // volby podle dimenze
  controls.hidden = false;
  const q = current.quantity;
  powerBox.hidden = q.dim !== 'power';
  powerSelect.value = state.power;
  powerCustomWrap.hidden = state.power !== 'vlastni';
  powerHours.value = String(state.hours);
  const pa = powerAssumption();
  powerNote.textContent = pa ? `Předpoklad: ${pa.label}.` : 'Výkon (MW) a energie (MWh) jsou různé veličiny. Bez předpokladu se porovnává jen s výkonem.';
  cpiBox.hidden = q.dim !== 'money' || !catalog.cpi;
  cpiToggle.checked = state.cpi;
  if (catalog.cpi && catalog.cpiYear) {
    cpiLabel.textContent = `Přepočítat starší ceny inflací na ceny roku ${catalog.cpiYear}`;
    cpiNote.textContent = `Index spotřebitelských cen: ${catalog.cpi.source_name}. Ceny novější než ${catalog.cpiYear} se nepřepočítávají.`;
  }

  const suggestions = compare(q, state.q.trim(), catalog.refs, {
    power: q.dim === 'power' ? pa : null,
    cpi: state.cpi ? catalog.cpi : null,
    cpiYear: catalog.cpiYear,
    currentYear: CURRENT_YEAR,
  });
  pages = rankPages(suggestions, { categories: state.cats, currentYear: CURRENT_YEAR });
  shownPages = 0;
  showMore();
}

function showMore(): void {
  const page = pages[shownPages];
  if (!page) return;
  const start = results.children.length;
  page.forEach((s, i) => results.append(card(s, start + i + 1)));
  shownPages++;
  more.hidden = shownPages >= pages.length;
  const total = results.children.length;
  status.textContent = total
    ? `${total} ${total === 1 ? 'návrh' : total < 5 ? 'návrhy' : 'návrhů'} pro ${current?.explain ?? ''}.`
    : 'Pro tento vstup nemám vhodné přirovnání.';
  if (!total) results.append(h('li', { class: 'empty' }, 'Pro tento vstup nemám v datech vhodné přirovnání. Zkuste jinou kategorii nebo jednotku.'));
}
more.addEventListener('click', () => {
  const first = results.children.length;
  showMore();
  (results.children[first]?.querySelector('.sentence') as HTMLElement | null)?.focus();
});

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function citation(r: Ref): HTMLElement {
  return h('a', { href: r.source_url, target: '_blank', rel: 'noopener' }, `${r.source_name}, ${r.year}`);
}

function card(s: Ranked, n: number): HTMLLIElement {
  const text = copyText(state.q.trim(), s);
  const copyBtn = h('button', { type: 'button', class: 'copy' }, 'Kopírovat') as HTMLButtonElement;
  copyBtn.addEventListener('click', async () => {
    await copy(text);
    copyBtn.textContent = 'Zkopírováno';
    status.textContent = 'Věta se zdrojem zkopírována do schránky.';
    setTimeout(() => (copyBtn.textContent = 'Kopírovat'), 1600);
  });
  const sc = s.score;
  const pct = (x: number) => fmtExact(Math.round(x * 100) / 100);
  return h(
    'li',
    { class: 'card' },
    h('p', { class: 'type' }, `${n}. ${TYPE_LABELS[s.type]} · ${CATEGORY_LABELS[s.category]}`),
    h('p', { class: 'sentence', tabindex: '-1' }, h('span', { class: 'input num' }, state.q.trim()), ' ', capitalize(s.sentence)),
    h('p', { class: 'source' }, 'Zdroj: ', ...s.refs.flatMap((r, i) => [i ? '; ' : '', citation(r)])),
    h(
      'div',
      { class: 'actions' },
      copyBtn,
      h(
        'details',
        {},
        h('summary', {}, 'Výpočet a předpoklady'),
        h('h3', {}, 'Výpočet'),
        h('ul', { class: 'mono' }, ...s.steps.map((x) => h('li', {}, x))),
        s.assumptions.length ? h('h3', {}, 'Předpoklady a poznámky') : null,
        s.assumptions.length ? h('ul', {}, ...s.assumptions.map((x) => h('li', {}, x))) : null,
        h('h3', {}, 'Použitá data'),
        h(
          'ul',
          {},
          ...s.refs.map((r) =>
            h(
              'li',
              {},
              h('strong', {}, r.label),
              ` – ${fmtExact(r.value)} ${r.unit}${r.per ? '/rok' : ''} (${r.basis}). `,
              citation(r),
              `. Staženo ${r.retrieved_at}.`,
              r.source_id ? ` Identifikátor: ${r.source_id}.` : '',
              r.household_definition ? ` Definice: ${r.household_definition}.` : '',
              r.note ? h('span', { class: 'block hint' }, r.note) : null,
              r.evidence ? h('q', { class: 'block evidence' }, r.evidence) : null,
            ),
          ),
        ),
        h('h3', {}, 'Proč tento návrh'),
        h(
          'p',
          { class: 'hint' },
          `Skóre ${pct(sc.total)} = ${WEIGHTS.ratio} × poměr ${pct(sc.ratio)} + ${WEIGHTS.familiarity} × známost ${pct(sc.familiarity)} + ` +
            `${WEIGHTS.roundness} × kulatost ${pct(sc.roundness)} + ${WEIGHTS.freshness} × čerstvost ${pct(sc.freshness)}.`,
        ),
      ),
    ),
  );
}

async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = h('textarea', {}, text);
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

// ------------------------------------------------------------ patička

const generatedDates = catalog.refs.map((r) => r.retrieved_at).sort();
$('foot').replaceChildren(
  h(
    'p',
    {},
    `Data: ${fmtExact(catalog.refs.length)} referenčních hodnot, poslední stažení ${generatedDates[generatedDates.length - 1] ?? '–'}. `,
    catalog.rates ? `Kurzy ČNB ze dne ${catalog.rates.date}. ` : '',
    'Každé číslo má zdroj; výpočty jsou v detailu návrhu. Výsledky jsou zaokrouhleny na 2 platné číslice.',
  ),
  h('p', {}, 'STEM, Ústav empirických výzkumů · interní nástroj'),
);

input.value = state.q;
update();
input.focus();
