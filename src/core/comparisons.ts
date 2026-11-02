/**
 * Tvorba přirovnání. Pět typů:
 *  multiple   – násobek („≈ 12 000 nových Škod Fabia“)
 *  share      – podíl celku („≈ 0,25 % výdajů státního rozpočtu 2026“)
 *  per_capita – na osobu / domácnost („≈ 470 Kč na každého obyvatele ČR“)
 *  time       – časový ekvivalent („Temelín by to vyrobil za ≈ 3 dny“)
 *  locality   – ekvivalent lokality („≈ tolik domácností má Olomoucký kraj“)
 *
 * Funkce jsou čisté: dostanou vstupní veličinu, data a volby, vrátí návrhy.
 */
import { countPhrase, fmtDuration, fmtExact, fmtPercent, fmtQuantity } from './czech';
import type { Category, Dimension, Quantity, Ref } from './types';
import {
  compatible,
  powerToAnnualEnergy,
  SECONDS_PER_YEAR,
  timeAtFullPower,
  type PowerAssumption,
} from './units';

export type SuggestionType = 'multiple' | 'share' | 'per_capita' | 'time' | 'locality';

export const TYPE_LABELS: Record<SuggestionType, string> = {
  multiple: 'Násobek',
  share: 'Podíl celku',
  per_capita: 'Na osobu / domácnost',
  time: 'Časový ekvivalent',
  locality: 'Ekvivalent lokality',
};

export interface Suggestion {
  id: string;
  type: SuggestionType;
  /** Věta k použití bez vstupního čísla, např. „≈ 12 000 nových Škod Fabia“. */
  sentence: string;
  /** Hlavní číslo, které se ve větě zobrazuje (nezaokrouhlené) – pro bodování „kulatosti“. */
  shownValue: number;
  /** Poměr vstup / reference (u podílu zlomek, u lokality poměr k nejbližší lokalitě). */
  ratio: number;
  refs: Ref[];
  steps: string[];
  assumptions: string[];
  category: Category;
  /** Hypotetický návrh (např. „při plném výkonu“) – v řazení se znevýhodní. */
  hypothetical?: boolean;
}

export interface CpiTable {
  /** Roční průměr indexu (libovolný základ) podle roku. */
  index: Record<number, number>;
  source_name: string;
  source_url: string;
}

export interface CompareOptions {
  /** Předpoklad pro převod výkonu na roční energii; bez něj se výkon porovnává jen s výkonem. */
  power?: PowerAssumption | null;
  /** Přepočet peněžních referencí na ceny roku `cpiYear`. */
  cpi?: CpiTable | null;
  cpiYear?: number | null;
  /** Aktuální rok; peněžní reference starší o víc než rok nesou ve větě „ceny roku X“. */
  currentYear?: number;
}

interface View {
  q: Quantity;
  /** Hodiny za rok, pokud vznikl převodem z výkonu. */
  hours?: number;
  assumptions: string[];
  steps: string[];
}

const LOCALITY_TOLERANCE = 1.15; // lokalita se nabídne, jen když se liší nejvýš o 15 %

/** Hodnota reference v základních jednotkách, případně přepočtená inflací. */
export function refValue(ref: Ref, opts: CompareOptions): { value: number; note: string | null } {
  const { cpi, cpiYear } = opts;
  if (ref.q.dim !== 'money' || !cpi || !cpiYear || ref.year === cpiYear) return { value: ref.q.value, note: null };
  const from = cpi.index[ref.year];
  const to = cpi.index[cpiYear];
  if (!from || !to) {
    return { value: ref.q.value, note: `ceny roku ${ref.year} (přepočet CPI pro tento rok není k dispozici)` };
  }
  const value = (ref.q.value * to) / from;
  return {
    value,
    note: `v cenách roku ${cpiYear}: ${fmtExact(ref.q.value)} Kč × CPI ${cpiYear} (${fmtExact(to)}) / CPI ${ref.year} (${fmtExact(from)}) = ${fmtExact(value)} Kč`,
  };
}

function citation(ref: Ref): string {
  return `${ref.source_name}, ${ref.year}`;
}

function inputCategory(dim: Dimension): Category {
  if (dim === 'money') return 'verejne-finance';
  if (dim === 'energy' || dim === 'power' || dim === 'co2' || dim === 'co2e') return 'energetika';
  return 'geografie';
}

function views(q: Quantity, opts: CompareOptions): View[] {
  const out: View[] = [{ q, assumptions: [], steps: [] }];
  if (q.dim === 'power' && opts.power) {
    const e = powerToAnnualEnergy(q, opts.power);
    out.push({
      q: e,
      hours: opts.power.hoursPerYear,
      assumptions: [`Převod výkonu na energii: ${opts.power.label} (${fmtExact(opts.power.hoursPerYear)} h/rok).`],
      steps: [`${fmtQuantity(q)} × ${fmtExact(opts.power.hoursPerYear)} h/rok = ${fmtQuantity(e)}`],
    });
  }
  return out;
}

const isLocality = (r: Ref) => r.level === 'obec' || r.level === 'kraj';

export function compare(input: Quantity, inputText: string, refs: Ref[], opts: CompareOptions = {}): Suggestion[] {
  const out: Suggestion[] = [];
  const populationCz = refs.find((r) => r.tags?.includes('population-cz'));
  const householdsCz = refs.find((r) => r.tags?.includes('households-cz'));

  for (const v of views(input, opts)) {
    const q = v.q;
    const flowSuffix = q.per === 'year' ? ' ročně' : '';
    const viaPower = q.dim !== input.dim;
    const shown = viaPower ? `${inputText} → ${fmtQuantity(q)}` : inputText;
    // předpoklad převodu výkonu musí být vidět i ve větě (a tedy i v kopírovaném textu)
    const powerTag = viaPower && opts.power ? ` (při ${fmtExact(opts.power.hoursPerYear)} h provozu ročně)` : '';

    for (const ref of refs) {
      const comp = compatible(q.dim, ref.q.dim);
      if (!comp.ok || isLocality(ref)) continue;
      const rv = refValue(ref, opts);
      const r = q.value / rv.value;
      const assumptions = [...v.assumptions];
      if (comp.note) assumptions.push(comp.note);
      if (rv.note) assumptions.push(`Cena přepočtena ${rv.note}.`);
      const base = {
        refs: [ref],
        category: ref.category,
      };
      const refText = `${fmtQuantity({ ...ref.q, value: rv.value })} (${ref.basis}; ${citation(ref)})`;
      const cpiTag = rv.note?.startsWith('v cenách')
        ? ` (v cenách roku ${opts.cpiYear})`
        : ref.q.dim === 'money' && ref.year < (opts.currentYear ?? new Date().getFullYear()) - 1
          ? ` (ceny roku ${ref.year})`
          : '';

      // násobek
      const flowMismatch = q.per === 'year' && ref.q.per === null ? flowSuffix : '';
      if ((ref.kind === 'unit' || r >= 1) && r >= 0.5 && r <= 1e6) {
        out.push({
          ...base,
          id: `multiple:${ref.id}${viaPower ? ':e' : ''}`,
          type: 'multiple',
          sentence: `≈ ${ref.prefix ? ref.prefix + ' ' : ''}${countPhrase(r, ref.forms)}${flowMismatch}${cpiTag}${powerTag}`,
          shownValue: r,
          ratio: r,
          steps: [...v.steps, `${shown} ÷ ${refText} = ${fmtExact(r)}`],
          assumptions,
        });
      }

      // podíl celku
      if (ref.kind === 'aggregate' && r < 1 && r >= 5e-5) {
        out.push({
          ...base,
          id: `share:${ref.id}${viaPower ? ':e' : ''}`,
          type: 'share',
          sentence: `≈ ${fmtPercent(r)} ${ref.forms.gen}${flowMismatch}${cpiTag}${powerTag}`,
          shownValue: r * 100,
          ratio: r,
          steps: [...v.steps, `${shown} ÷ ${refText} = ${fmtExact(r * 100)} %`],
          assumptions,
        });
      }

      // časový ekvivalent: množství vs. roční tok
      if (ref.time_phrase && q.per === null && ref.q.per === 'year') {
        const t = r * SECONDS_PER_YEAR;
        out.push({
          ...base,
          id: `time:${ref.id}${viaPower ? ':e' : ''}`,
          type: 'time',
          sentence: ref.time_phrase.replace('{t}', `≈ ${fmtDuration(t, 'acc')}`),
          shownValue: t,
          ratio: r,
          steps: [...v.steps, `${shown} ÷ ${refText} = ${fmtExact(r)} roku = ${fmtDuration(t)}`],
          assumptions: [...assumptions, 'Předpoklad: tok je rovnoměrně rozložen v průběhu roku (rok = 8 760 h).'],
        });
      }
    }

    // časový ekvivalent: energie vs. výkon zdroje (při plném výkonu)
    if (q.dim === 'energy' && q.per === null) {
      for (const ref of refs) {
        if (ref.q.dim !== 'power' || !ref.time_phrase) continue;
        const t = timeAtFullPower(q, ref.q);
        out.push({
          id: `time:${ref.id}`,
          type: 'time',
          sentence: ref.time_phrase.replace('{t}', `≈ ${fmtDuration(t, 'acc')}`),
          shownValue: t,
          ratio: t / SECONDS_PER_YEAR,
          hypothetical: true,
          refs: [ref],
          category: ref.category,
          steps: [...v.steps, `${shown} ÷ ${fmtQuantity(ref.q)} (${ref.basis}; ${citation(ref)}) = ${fmtDuration(t)}`],
          assumptions: [...v.assumptions, 'Předpoklad: zdroj běží celou dobu na plný instalovaný výkon (ve skutečnosti by to trvalo déle).'],
        });
      }
    }

    // na obyvatele / domácnost
    const perDims: Dimension[] = ['money', 'energy', 'co2', 'co2e', 'mass', 'area', 'volume'];
    if (perDims.includes(q.dim) && !viaPower) {
      const denominators: [Ref | undefined, string][] = [
        [populationCz, 'na každého obyvatele ČR'],
        [householdsCz, 'na každou domácnost v ČR'],
      ];
      for (const [den, phrase] of denominators) {
        if (!den) continue;
        const per = q.value / den.q.value;
        const perQ: Quantity = { value: per, dim: q.dim, per: q.per };
        const defNote = den.household_definition ? ` (${den.household_definition})` : '';
        out.push({
          id: `per_capita:${den.id}`,
          type: 'per_capita',
          sentence: `≈ ${fmtQuantity({ ...perQ, per: null })} ${phrase}${flowSuffix}`,
          shownValue: approxMantissaValue(perQ),
          ratio: 1,
          refs: [den],
          category: inputCategory(q.dim),
          steps: [`${inputText} ÷ ${fmtExact(den.q.value)} (${den.basis}; ${citation(den)}) = ${fmtQuantity(perQ, true)}`],
          assumptions: defNote ? [`Definice domácnosti: ${den.household_definition}.`] : [],
        });
      }
    }

    // ekvivalent lokality
    out.push(...localities(q, inputText, refs, v));
  }
  return out;
}

/** Číslo, které se zobrazí ve výpisu veličiny (kvůli bodování kulatosti). */
function approxMantissaValue(q: Quantity): number {
  const text = fmtQuantity(q);
  const m = text.match(/^[\d\s ]+(?:,\d+)?/);
  return m ? Number(m[0].replace(/[\s ]/g, '').replace(',', '.')) : q.value;
}

const LOCALITY_PHRASES: Partial<Record<Dimension, (place: string, level: string) => string>> = {
  persons: (p) => `≈ tolik obyvatel má ${p}`,
  households: (p) => `≈ tolik domácností má ${p}`,
  dwellings: (p) => `≈ tolik obydlených bytů má ${p}`,
  area: (p, level) => `≈ rozloha ${level === 'kraj' ? 'území' : 'obce'} ${p}`,
};

function powerTagFor(v: View, q: Quantity): string {
  return v.hours && q.dim === 'energy' ? ` (při ${fmtExact(v.hours)} h provozu ročně)` : '';
}

function localities(q: Quantity, inputText: string, refs: Ref[], v: View): Suggestion[] {
  const out: Suggestion[] = [];
  const pool = refs.filter((r) => isLocality(r) && r.q.dim === q.dim);
  let target = q.value;
  let lead = '';
  const steps = [...v.steps];
  const assumptions = [...v.assumptions];
  const extraRefs: Ref[] = [];

  // energie → počet průměrných bytů → obec se stejným počtem obydlených bytů
  // (průměrná spotřeba ČSÚ je na obydlený byt, proto se porovnává s byty, ne s domácnostmi)
  if (q.dim === 'energy') {
    const avg = refs.find((r) => r.tags?.includes('dwelling-electricity-avg'));
    if (!avg) return out;
    const n = q.value / avg.q.value;
    target = n;
    lead = `≈ roční spotřeba elektřiny ${countPhrase(n, { one: 'průměrného bytu', few: 'průměrných bytů', many: 'průměrných bytů', dec: 'průměrného bytu' })} – zhruba tolik obydlených bytů má `;
    steps.push(`${inputText} ÷ ${fmtQuantity(avg.q)} (${avg.basis}; ${citation(avg)}) = ${fmtExact(n)} bytů`);
    extraRefs.push(avg);
    pool.push(...refs.filter((r) => isLocality(r) && r.q.dim === 'dwellings'));
  } else if (!LOCALITY_PHRASES[q.dim]) {
    return out;
  }

  for (const level of ['obec', 'kraj'] as const) {
    const candidates = pool
      .filter((r) => r.level === level)
      .map((r) => ({ r, d: Math.abs(Math.log(target / r.q.value)) }))
      .filter((c) => c.d <= Math.log(LOCALITY_TOLERANCE))
      // nejbližší, při podobné vzdálenosti známější
      .sort((a, b) => a.d - 0.02 * a.r.familiarity - (b.d - 0.02 * b.r.familiarity));
    for (const { r } of candidates.slice(0, 1)) {
      const ratio = target / r.q.value;
      const place = r.place ?? r.label;
      const dimLead = lead || LOCALITY_PHRASES[q.dim]!(place, level);
      const sentence = lead ? `${dimLead}${place}` : dimLead;
      const defNote = r.household_definition ? [`Definice domácnosti: ${r.household_definition}.`] : [];
      out.push({
        id: `locality:${r.id}`,
        type: 'locality',
        sentence: `${sentence} (${fmtQuantity(r.q)}, ${r.basis})${powerTagFor(v, q)}`,
        shownValue: 1,
        ratio,
        refs: [...extraRefs, r],
        category: 'geografie',
        steps: [...steps, `${place}: ${fmtQuantity(r.q, true)} (${r.basis}; ${citation(r)}); poměr ${fmtExact(ratio)}`],
        assumptions: [...assumptions, ...defNote],
      });
    }
  }
  return out;
}

/** Text ke zkopírování: „5 mld. Kč ≈ 12 000 nových Škod Fabia (Škoda Auto – ceník, 2026)“. */
export function copyText(inputText: string, s: Suggestion): string {
  const sources = s.refs.map((r) => `${r.source_name}, ${r.year}, ${r.source_url}`).join('; ');
  const body = s.sentence.startsWith('≈') ? `${inputText} ${s.sentence}` : `${inputText}: ${s.sentence}`;
  return `${body} (zdroj: ${sources})`;
}
