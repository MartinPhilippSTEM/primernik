/**
 * Model jednotek. Vlastní malá tabulka převodů, místo knihovny typu mathjs:
 * - potřebujeme dimenze, které mathjs nezná (Kč, osoby, domácnosti, byty, CO2 vs. CO2e),
 * - chceme, aby převod výkon ↔ energie byl možný JEN přes výslovný předpoklad,
 * - tabulka je krátká, čitelná a celá pokrytá testy (tests/units.test.ts).
 */
import type { DataPer, Dimension, Per, Quantity } from './types';

export const BASE_UNIT: Record<Dimension, string> = {
  money: 'Kč',
  power: 'W',
  energy: 'Wh',
  mass: 'kg',
  co2: 'kg CO2',
  co2e: 'kg CO2e',
  area: 'm2',
  length: 'm',
  volume: 'm3',
  persons: 'osoba',
  households: 'domácnost',
  dwellings: 'byt',
  time: 's',
};

export interface UnitDef {
  dim: Dimension;
  /** Kolik základních jednotek je v jedné této jednotce. U cizí měny NaN (kurz se dodá zvlášť). */
  factor: number;
  currency?: string;
}

const HOUR = 3600;
/** Rok = 365 dní = 8 760 h (konvence; stejná jako „nepřetržitý provoz 8 760 h/rok“). */
export const HOURS_PER_YEAR = 8760;
export const SECONDS_PER_YEAR = HOURS_PER_YEAR * HOUR;

/** Kolikrát za rok se opakuje tok udaný „za měsíc / den / sekundu“ (rok = 365 dní). */
export const PER_FACTORS: Record<Exclude<DataPer, null>, number> = {
  year: 1,
  month: 12,
  day: 365,
  second: SECONDS_PER_YEAR,
};

function massLike(dim: 'co2' | 'co2e', suffix: string): Record<string, UnitDef> {
  return {
    [`g ${suffix}`]: { dim, factor: 1e-3 },
    [`kg ${suffix}`]: { dim, factor: 1 },
    [`t ${suffix}`]: { dim, factor: 1e3 },
    [`kt ${suffix}`]: { dim, factor: 1e6 },
    [`Mt ${suffix}`]: { dim, factor: 1e9 },
  };
}

export const UNITS: Record<string, UnitDef> = {
  // peníze
  Kč: { dim: 'money', factor: 1 },
  EUR: { dim: 'money', factor: NaN, currency: 'EUR' },
  USD: { dim: 'money', factor: NaN, currency: 'USD' },
  GBP: { dim: 'money', factor: NaN, currency: 'GBP' },
  CHF: { dim: 'money', factor: NaN, currency: 'CHF' },
  SEK: { dim: 'money', factor: NaN, currency: 'SEK' },
  NOK: { dim: 'money', factor: NaN, currency: 'NOK' },
  DKK: { dim: 'money', factor: NaN, currency: 'DKK' },
  PLN: { dim: 'money', factor: NaN, currency: 'PLN' },
  HUF: { dim: 'money', factor: NaN, currency: 'HUF' },
  JPY: { dim: 'money', factor: NaN, currency: 'JPY' },
  CNY: { dim: 'money', factor: NaN, currency: 'CNY' },
  // výkon
  W: { dim: 'power', factor: 1 },
  kW: { dim: 'power', factor: 1e3 },
  MW: { dim: 'power', factor: 1e6 },
  GW: { dim: 'power', factor: 1e9 },
  TW: { dim: 'power', factor: 1e12 },
  // energie (základ Wh; 1 Wh = 3 600 J)
  Wh: { dim: 'energy', factor: 1 },
  kWh: { dim: 'energy', factor: 1e3 },
  MWh: { dim: 'energy', factor: 1e6 },
  GWh: { dim: 'energy', factor: 1e9 },
  TWh: { dim: 'energy', factor: 1e12 },
  J: { dim: 'energy', factor: 1 / HOUR },
  kJ: { dim: 'energy', factor: 1e3 / HOUR },
  MJ: { dim: 'energy', factor: 1e6 / HOUR },
  GJ: { dim: 'energy', factor: 1e9 / HOUR },
  TJ: { dim: 'energy', factor: 1e12 / HOUR },
  PJ: { dim: 'energy', factor: 1e15 / HOUR },
  // hmotnost
  g: { dim: 'mass', factor: 1e-3 },
  kg: { dim: 'mass', factor: 1 },
  t: { dim: 'mass', factor: 1e3 },
  kt: { dim: 'mass', factor: 1e6 },
  Mt: { dim: 'mass', factor: 1e9 },
  // emise
  ...massLike('co2', 'CO2'),
  ...massLike('co2e', 'CO2e'),
  // plocha
  m2: { dim: 'area', factor: 1 },
  a: { dim: 'area', factor: 100 }, // ar
  ha: { dim: 'area', factor: 1e4 },
  km2: { dim: 'area', factor: 1e6 },
  // délka
  mm: { dim: 'length', factor: 1e-3 },
  cm: { dim: 'length', factor: 1e-2 },
  m: { dim: 'length', factor: 1 },
  km: { dim: 'length', factor: 1e3 },
  // objem
  ml: { dim: 'volume', factor: 1e-6 },
  l: { dim: 'volume', factor: 1e-3 },
  hl: { dim: 'volume', factor: 0.1 },
  m3: { dim: 'volume', factor: 1 },
  km3: { dim: 'volume', factor: 1e9 },
  // počty
  osoba: { dim: 'persons', factor: 1 },
  domácnost: { dim: 'households', factor: 1 },
  byt: { dim: 'dwellings', factor: 1 },
  // čas
  s: { dim: 'time', factor: 1 },
  min: { dim: 'time', factor: 60 },
  h: { dim: 'time', factor: HOUR },
  den: { dim: 'time', factor: 24 * HOUR },
  týden: { dim: 'time', factor: 7 * 24 * HOUR },
  měsíc: { dim: 'time', factor: SECONDS_PER_YEAR / 12 },
  rok: { dim: 'time', factor: SECONDS_PER_YEAR },
};

/** Kurzy: kolik Kč stojí 1 jednotka měny (ČNB). */
export interface Rates {
  date: string;
  rates: Record<string, number>;
}

export class UnitError extends Error {}

export function unitDef(symbol: string): UnitDef {
  const def = UNITS[symbol];
  if (!def) throw new UnitError(`Neznámá jednotka: ${symbol}`);
  return def;
}

/** Převod toku „za měsíc / den / sekundu“ na „za rok“ (u dat). */
export function dataToBase(value: number, symbol: string, per: DataPer, rates?: Rates): Quantity {
  if (!per) return toBase(value, symbol, null, rates);
  return toBase(value * PER_FACTORS[per], symbol, 'year', rates);
}

/** Převod hodnoty v dané jednotce na základní jednotky. */
export function toBase(value: number, symbol: string, per: Per = null, rates?: Rates): Quantity {
  const def = unitDef(symbol);
  if (def.currency) {
    const rate = rates?.rates[def.currency];
    if (!rate) throw new UnitError(`Chybí kurz ČNB pro ${def.currency}`);
    return { value: value * rate, dim: 'money', per, currency: def.currency };
  }
  return { value: value * def.factor, dim: def.dim, per };
}

/** Převod ze základních jednotek do zadané jednotky téže dimenze. */
export function fromBase(q: Quantity, symbol: string): number {
  const def = unitDef(symbol);
  if (def.currency) throw new UnitError('Do cizí měny se nepřevádí');
  if (def.dim !== q.dim) throw new UnitError(`Nelze převést ${q.dim} na ${symbol}`);
  return q.value / def.factor;
}

export interface Compatibility {
  ok: boolean;
  /** Vysvětlení převodu, který se při porovnání použil (zobrazí se v detailu). */
  note?: string;
}

/**
 * Lze vstup (a) porovnat s referencí (b)? Jen ve stejné dimenzi.
 * Výjimka: CO2 lze porovnat s CO2e (1 t CO2 = 1 t CO2e, protože GWP CO2 = 1).
 * Opačně (CO2e se samotným CO2) to nejde – CO2e obsahuje i další plyny.
 */
export function compatible(a: Dimension, b: Dimension): Compatibility {
  if (a === b) return { ok: true };
  if (a === 'co2' && b === 'co2e') {
    return { ok: true, note: '1 t CO2 = 1 t CO2e (CO2 má podle definice GWP = 1)' };
  }
  return { ok: false };
}

/** Poměr a / b. Vyhodí chybu u nekompatibilních dimenzí (výkon vs. energie apod.). */
export function ratio(a: Quantity, b: Quantity): number {
  if (!compatible(a.dim, b.dim).ok) {
    throw new UnitError(`Nekompatibilní veličiny: ${a.dim} a ${b.dim}`);
  }
  if (b.value === 0) throw new UnitError('Dělení nulou');
  return a.value / b.value;
}

export interface PowerAssumption {
  /** Počet hodin provozu na plný výkon za rok (8 760 = nepřetržitě). */
  hoursPerYear: number;
  /** Lidský popis předpokladu, zobrazí se u výsledku. */
  label: string;
  source_name?: string;
  source_url?: string;
}

/**
 * Výkon → roční energie. Jediný povolený most mezi výkonem a energií a vždy
 * vyžaduje výslovný předpoklad (počet hodin za rok).
 */
export function powerToAnnualEnergy(p: Quantity, assumption: PowerAssumption): Quantity {
  if (p.dim !== 'power') throw new UnitError('Převod na energii jde jen z výkonu');
  if (!(assumption.hoursPerYear > 0 && assumption.hoursPerYear <= HOURS_PER_YEAR)) {
    throw new UnitError(`Počet hodin musí být mezi 0 a ${HOURS_PER_YEAR}`);
  }
  return { value: p.value * assumption.hoursPerYear, dim: 'energy', per: 'year' };
}

/** Doba, za kterou zdroj o výkonu p vyrobí energii e (při plném výkonu), v sekundách. */
export function timeAtFullPower(e: Quantity, p: Quantity): number {
  if (e.dim !== 'energy' || p.dim !== 'power') throw new UnitError('Potřebuji energii a výkon');
  return (e.value / p.value) * HOUR;
}
