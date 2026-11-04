/**
 * Čeština: formátování čísel (Intl cs-CZ), zaokrouhlení na 2 platné číslice,
 * volba tvaru podle čísla a výpis veličin a dob.
 */
import type { Dimension, Forms, Quantity } from './types';

const NBSP = ' ';

/** Zaokrouhlí na `sig` platných číslic (výchozí 2). */
export function roundSig(n: number, sig = 2): number {
  if (n === 0 || !Number.isFinite(n)) return n;
  const p = Math.floor(Math.log10(Math.abs(n))) - sig + 1;
  const f = 10 ** p;
  // korekce plovoucí čárky (např. 0,29999999)
  return Number((Math.round(n / f) * f).toPrecision(sig + 1));
}

/** Formátuje číslo česky (mezera jako oddělovač tisíců, desetinná čárka). */
export function fmtNumber(n: number, maxFractionDigits = 2): string {
  return new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: maxFractionDigits }).format(n);
}

/** Přesný výpis do detailu výpočtu: až 6 platných číslic, bez exponentu. */
export function fmtExact(n: number): string {
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e6) return fmtNumber(Math.round(n), 0);
  return new Intl.NumberFormat('cs-CZ', { maximumSignificantDigits: 6 }).format(n);
}

export interface Approx {
  /** Text čísla, např. „12 000“, „1,5“, „3,4 mil.“ */
  text: string;
  /** Zaokrouhlená hodnota (pro volbu tvaru). */
  rounded: number;
  /** Bylo použito slovo „mil./mld.“? Pak se pojí s 2. pádem množného čísla. */
  word: boolean;
}

/** Číslo zaokrouhlené na 2 platné číslice; od milionu se slovem (mil., mld., bil.). */
export function approx(n: number): Approx {
  const r = roundSig(n, 2);
  const abs = Math.abs(r);
  const scales: [number, string][] = [
    [1e12, 'bil.'],
    [1e9, 'mld.'],
    [1e6, 'mil.'],
  ];
  for (const [scale, word] of scales) {
    if (abs >= scale) {
      return { text: `${fmtNumber(r / scale, 2)}${NBSP}${word}`, rounded: r, word: true };
    }
  }
  // malá čísla: 2 platné číslice mohou mít víc desetinných míst (0,0013)
  const digits = abs > 0 && abs < 1 ? Math.min(10, 1 - Math.floor(Math.log10(abs))) : 2;
  return { text: fmtNumber(r, digits), rounded: r, word: false };
}

export type PluralKey = 'one' | 'few' | 'many' | 'dec';

/**
 * Tvar podle čísla: 1 → one, 2–4 → few, desetinné → dec, jinak many.
 * Složená čísla zapsaná číslicí (21, 22) bereme jako „dvacet jedna / dvaadvacet“
 * → tvar many („21 aut“, „22 aut“), což je v psaném textu s číslicemi běžné a správné.
 */
export function pluralKey(n: number, word = false): PluralKey {
  if (word) return 'many'; // „3,4 mil. obyvatel“, „2 mld. Kč“
  if (!Number.isInteger(n)) return 'dec';
  const abs = Math.abs(n);
  if (abs === 1) return 'one';
  if (abs >= 2 && abs <= 4) return 'few';
  return 'many';
}

export function pick(forms: Pick<Forms, PluralKey>, n: number, word = false): string {
  return forms[pluralKey(n, word)];
}

/** „≈ 12 000 nových Škod Fabia“ – číslo a správný tvar. */
export function countPhrase(n: number, forms: Pick<Forms, PluralKey>): string {
  const a = approx(n);
  return `${a.text} ${pick(forms, a.rounded, a.word)}`;
}

/** Procenta na 2 platné číslice: „0,25 %“, „12 %“. */
export function fmtPercent(fraction: number): string {
  return `${fmtNumber(roundSig(fraction * 100, 2), 6)}${NBSP}%`;
}

type Case = 'nom' | 'acc';
interface UnitWord {
  seconds: number;
  forms: Record<PluralKey, string>;
  acc1?: string; // 4. pád j. č., pokud se liší („za 1 hodinu“)
}

const DURATION_UNITS: UnitWord[] = [
  { seconds: 1e-6, forms: { one: 'mikrosekunda', few: 'mikrosekundy', many: 'mikrosekund', dec: 'mikrosekundy' }, acc1: 'mikrosekundu' },
  { seconds: 1e-3, forms: { one: 'milisekunda', few: 'milisekundy', many: 'milisekund', dec: 'milisekundy' }, acc1: 'milisekundu' },
  { seconds: 1, forms: { one: 'sekunda', few: 'sekundy', many: 'sekund', dec: 'sekundy' }, acc1: 'sekundu' },
  { seconds: 60, forms: { one: 'minuta', few: 'minuty', many: 'minut', dec: 'minuty' }, acc1: 'minutu' },
  { seconds: 3600, forms: { one: 'hodina', few: 'hodiny', many: 'hodin', dec: 'hodiny' }, acc1: 'hodinu' },
  { seconds: 86400, forms: { one: 'den', few: 'dny', many: 'dní', dec: 'dne' } },
  { seconds: 8760 * 3600 / 12, forms: { one: 'měsíc', few: 'měsíce', many: 'měsíců', dec: 'měsíce' } },
  { seconds: 8760 * 3600, forms: { one: 'rok', few: 'roky', many: 'let', dec: 'roku' } },
];

/** Volba jednotky: pod 1 ms mikrosekundy, pod 1 s milisekundy, do 90 s sekundy, do hodiny minuty, do 48 h hodiny, do 60 dní dny, do 2 let měsíce, pak roky. */
function durationUnit(seconds: number): UnitWord {
  const [us, ms, s, m, h, d, mo, y] = DURATION_UNITS;
  if (seconds < 1e-3) return us;
  if (seconds < 1) return ms;
  if (seconds < 90) return s;
  if (seconds < 3600) return m;
  if (seconds < 48 * 3600) return h;
  if (seconds < 60 * 86400) return d;
  if (seconds < 2 * y.seconds) return mo;
  return y;
}

/** Doba česky na 2 platné číslice: „3 dny“, „1,5 dne“; v 4. pádě „za 1 hodinu“. */
export function fmtDuration(seconds: number, grammaticalCase: Case = 'nom'): string {
  const u = durationUnit(seconds);
  const a = approx(seconds / u.seconds);
  const key = pluralKey(a.rounded, a.word);
  const word = key === 'one' && grammaticalCase === 'acc' && u.acc1 ? u.acc1 : u.forms[key];
  return `${a.text} ${word}`;
}

const COUNT_FORMS: Partial<Record<Dimension, Record<PluralKey, string>>> = {
  persons: { one: 'osoba', few: 'osoby', many: 'osob', dec: 'osoby' },
  households: { one: 'domácnost', few: 'domácnosti', many: 'domácností', dec: 'domácnosti' },
  dwellings: { one: 'byt', few: 'byty', many: 'bytů', dec: 'bytu' },
};

interface Scale {
  min: number;
  factor: number;
  symbol: string;
}

const DISPLAY_SCALES: Partial<Record<Dimension, Scale[]>> = {
  power: [
    { min: 1e9, factor: 1e9, symbol: 'GW' },
    { min: 1e6, factor: 1e6, symbol: 'MW' },
    { min: 1e3, factor: 1e3, symbol: 'kW' },
    { min: 0, factor: 1, symbol: 'W' },
  ],
  energy: [
    { min: 1e12, factor: 1e12, symbol: 'TWh' },
    { min: 1e9, factor: 1e9, symbol: 'GWh' },
    { min: 1e6, factor: 1e6, symbol: 'MWh' },
    { min: 1e3, factor: 1e3, symbol: 'kWh' },
    { min: 0, factor: 1, symbol: 'Wh' },
  ],
  mass: [
    { min: 1e3, factor: 1e3, symbol: 't' },
    { min: 0, factor: 1, symbol: 'kg' },
  ],
  co2: [
    { min: 1e3, factor: 1e3, symbol: 't CO₂' },
    { min: 0, factor: 1, symbol: 'kg CO₂' },
  ],
  co2e: [
    { min: 1e3, factor: 1e3, symbol: 't CO₂e' },
    { min: 0, factor: 1, symbol: 'kg CO₂e' },
  ],
  area: [
    { min: 1e7, factor: 1e6, symbol: 'km²' },
    { min: 1e4, factor: 1e4, symbol: 'ha' },
    { min: 0, factor: 1, symbol: 'm²' },
  ],
  length: [
    { min: 1e3, factor: 1e3, symbol: 'km' },
    { min: 0, factor: 1, symbol: 'm' },
  ],
  volume: [
    { min: 1, factor: 1, symbol: 'm³' },
    { min: 0, factor: 1e-3, symbol: 'l' },
  ],
  money: [{ min: 0, factor: 1, symbol: 'Kč' }],
};

/**
 * Lidský výpis veličiny, např. „5 mld. Kč“, „3 MW“, „300 ha“, „200 000 domácností“.
 * `exact` = bez zaokrouhlení na 2 platné číslice (pro „Rozumím: …“).
 */
export function fmtQuantity(q: Quantity, exact = false): string {
  const perSuffix = q.per === 'year' ? '/rok' : '';
  if (q.dim === 'time') return fmtDuration(q.value) + perSuffix;
  const counts = COUNT_FORMS[q.dim];
  if (counts) {
    const a = exact ? exactApprox(q.value) : approx(q.value);
    return `${a.text} ${counts[pluralKey(a.rounded, a.word)]}${perSuffix}`;
  }
  const scales = DISPLAY_SCALES[q.dim]!;
  const s = scales.find((sc) => Math.abs(q.value) >= sc.min) ?? scales[scales.length - 1];
  const v = q.value / s.factor;
  const a = exact ? exactApprox(v) : approx(v);
  return `${a.text}${NBSP}${s.symbol}${perSuffix}`;
}

/** Jako approx(), ale bez zaokrouhlení (až 6 platných číslic). */
function exactApprox(n: number): Approx {
  const abs = Math.abs(n);
  if (abs >= 1e9) return { text: `${fmtExact(n / 1e9)}${NBSP}mld.`, rounded: n, word: true };
  if (abs >= 1e6) return { text: `${fmtExact(n / 1e6)}${NBSP}mil.`, rounded: n, word: true };
  return { text: fmtExact(n), rounded: n, word: false };
}

/** Vědecký zápis pro „Rozumím: 5 × 10⁹ Kč“. */
export function fmtScientific(n: number): string {
  if (n === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(n)));
  if (exp >= -2 && exp < 4) return fmtExact(n);
  const mant = n / 10 ** exp;
  const sup = String(exp)
    .split('')
    .map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'['0123456789'.indexOf(c)] ?? (c === '-' ? '⁻' : c))
    .join('');
  return `${fmtExact(Number(mant.toPrecision(6)))} × 10${sup}`;
}
