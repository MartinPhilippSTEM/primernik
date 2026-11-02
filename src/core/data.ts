/**
 * Načtení a validace referenčních dat (data/curated.json, data/generated/*.json).
 * Validace se používá v testech i ve skriptu scripts/validate-data.ts.
 */
import type { Category, Dimension, Ref, RefItem } from './types';
import { dataToBase, toBase, UNITS, type Rates } from './units';

export interface Dataset {
  dataset: string;
  source_name: string;
  source_url: string;
  retrieved_at: string;
  items: RefItem[];
}

const DIMENSIONS: Dimension[] = [
  'money', 'power', 'energy', 'mass', 'co2', 'co2e', 'area', 'length', 'volume', 'persons', 'households', 'dwellings', 'time',
];
const CATEGORIES: Category[] = ['kazdodenni', 'energetika', 'verejne-finance', 'geografie'];

/** Věrohodný rozsah hodnoty v základních jednotkách (spodní a horní mez). */
export const PLAUSIBLE: Record<Dimension, [number, number]> = {
  money: [1, 1e15], // do 1 000 bil. Kč (HDP Německa ≈ 110 bil. Kč)
  power: [1, 1e12], // do 1 TW
  energy: [1, 1e15], // do 1 000 TWh
  mass: [1e-3, 1e13],
  co2: [1e-3, 1e13],
  co2e: [1e-3, 1e13],
  area: [1e-2, 1e12], // ČR má 7,9 × 10¹⁰ m²
  length: [1e-3, 1e12], // do 1 mld. km (vzdálenost Země–Slunce je 1,5 × 10¹¹ m)
  volume: [1e-6, 1e12],
  persons: [1, 1e10],
  households: [1, 1e9],
  dwellings: [1, 1e9],
  time: [1e-3, 1e10],
};

/** Vrátí seznam chyb položky (prázdný = v pořádku). Kurzy jsou potřeba jen u cizích měn. */
export function validateItem(it: Partial<RefItem>, rates?: Rates): string[] {
  const e: string[] = [];
  const need = (k: keyof RefItem) => {
    const v = it[k];
    if (v === undefined || v === null || v === '') e.push(`chybí ${String(k)}`);
  };
  (['id', 'label', 'value', 'unit', 'dimension', 'basis', 'category', 'source_name', 'source_url', 'year', 'retrieved_at', 'kind'] as const).forEach(need);
  if (it.dimension && !DIMENSIONS.includes(it.dimension)) e.push(`neznámá dimenze ${it.dimension}`);
  if (it.category && !CATEGORIES.includes(it.category)) e.push(`neznámá kategorie ${it.category}`);
  if (it.kind && !['unit', 'aggregate', 'rate'].includes(it.kind)) e.push(`neznámý kind ${it.kind}`);
  if (it.per !== undefined && it.per !== null && !['year', 'month', 'day', 'second'].includes(it.per)) e.push(`neznámé per ${it.per}`);
  if (it.kind === 'rate') {
    if (!it.rate_unit || !UNITS[it.rate_unit]) e.push(`rate: neznámá rate_unit ${it.rate_unit}`);
    else if (UNITS[it.rate_unit].dim !== it.rate_dimension) e.push(`rate: rate_unit nepatří k rate_dimension ${it.rate_dimension}`);
    if (!(typeof it.rate_value === 'number' && it.rate_value > 0)) e.push('rate: rate_value musí být kladné číslo');
    if (!it.rate_phrase?.includes('{n}')) e.push('rate: rate_phrase musí obsahovat {n}');
    if (it.reverse_phrase && !it.reverse_phrase.includes('{n}')) e.push('rate: reverse_phrase musí obsahovat {n}');
  }
  if (it.time_phrase && !it.time_phrase.includes('{t}')) e.push('time_phrase musí obsahovat {t}');
  if (it.source_url && !/^https:\/\/\S+$/.test(it.source_url)) e.push('source_url musí být https odkaz');
  if (it.year !== undefined && !(Number.isInteger(it.year) && it.year >= 1990 && it.year <= 2035)) e.push(`nevěrohodný rok ${it.year}`);
  if (it.retrieved_at && !/^\d{4}-\d{2}-\d{2}$/.test(it.retrieved_at)) e.push('retrieved_at musí být YYYY-MM-DD');
  if (it.familiarity !== undefined && ![1, 2, 3].includes(it.familiarity)) e.push('familiarity musí být 1–3');
  const f = it.forms;
  if (!f || !f.one || !f.few || !f.many || !f.dec || !f.gen) e.push('chybí některý tvar ve forms (one/few/many/dec/gen)');
  if (it.unit) {
    const def = UNITS[it.unit];
    if (!def) e.push(`neznámá jednotka ${it.unit}`);
    else if (it.dimension && def.dim !== it.dimension) e.push(`jednotka ${it.unit} nepatří k dimenzi ${it.dimension}`);
  }
  if (typeof it.value !== 'number' || !Number.isFinite(it.value) || it.value <= 0) e.push('hodnota musí být kladné číslo');
  else if (it.unit && UNITS[it.unit] && it.dimension && e.length === 0 && !(UNITS[it.unit].currency && !rates)) {
    try {
      const q = dataToBase(it.value, it.unit, it.per ?? null, rates);
      const [lo, hi] = PLAUSIBLE[it.dimension];
      if (q.value < lo || q.value > hi) e.push(`hodnota ${it.value} ${it.unit} je mimo věrohodný rozsah`);
    } catch (err) {
      e.push((err as Error).message);
    }
  }
  return e;
}

/** Převede položky na Ref (hodnota v základních jednotkách). Nevalidní položky vyhodí chybu. */
export function toRefs(items: RefItem[], rates?: Rates): Ref[] {
  const ids = new Set<string>();
  return items.map((it) => {
    const errors = validateItem(it, rates);
    if (ids.has(it.id)) errors.push(`duplicitní id ${it.id}`);
    ids.add(it.id);
    if (errors.length) throw new Error(`Položka ${it.id}: ${errors.join('; ')}`);
    const q = dataToBase(it.value, it.unit, it.per ?? null, rates);
    const rq = it.kind === 'rate' ? toBase(it.rate_value!, it.rate_unit!) : undefined;
    return { ...it, per: it.per ?? null, q, rq };
  });
}
