/**
 * Vysvětlitelné bodování a výběr návrhů. Čisté funkce, pokryté testy.
 *
 * Skóre = 0,40 × poměr + 0,30 × známost + 0,15 × kulatost + 0,15 × čerstvost (vše 0–1).
 */
import type { Suggestion, SuggestionType } from './comparisons';
import type { Category } from './types';

export interface ScoreBreakdown {
  ratio: number;
  familiarity: number;
  roundness: number;
  freshness: number;
  total: number;
}

export const WEIGHTS = { ratio: 0.4, familiarity: 0.3, roundness: 0.15, freshness: 0.15 } as const;

/** Jak „dobře uchopitelný“ je poměr. Násobky ideálně 1–100, podíly 1–50 %. */
export function ratioScore(s: Pick<Suggestion, 'type' | 'ratio' | 'shownValue'>): number {
  const r = s.ratio;
  switch (s.type) {
    case 'multiple':
      if (r >= 1 && r <= 100) return 1;
      if (r >= 0.5 && r <= 1000) return 0.8;
      if (r <= 1e5) return 0.5; // „≈ 12 000 nových Škod Fabia“ je pořád dobře uchopitelné
      if (r <= 1e8) return 0.35; // „≈ 380 mil. lahvových piv“ – živé, ale méně přesné v představě
      return 0.15;
    case 'share': {
      const p = r * 100;
      if (p >= 1 && p <= 50) return 1;
      if (p >= 0.1 && p <= 100) return 0.8;
      if (p >= 0.01) return 0.3;
      return 0.05;
    }
    case 'time': {
      const sec = s.shownValue;
      if (sec >= 3600 && sec <= 2 * 365 * 86400) return 1; // hodina až 2 roky
      if (sec >= 60 && sec <= 50 * 365 * 86400) return 0.6;
      return 0.2;
    }
    case 'per_capita':
      // samotné „Kč na obyvatele“ 0,8; řetězené „… – to je ≈ 35 piv na hlavu“ podle počtu věcí
      return s.ratio === 1 ? 0.8 : s.ratio <= 100 ? 0.95 : 0.6;
    case 'conversion':
      // samotný přepočet („za ≈ 450 000 km jízdy“) je vždy srozumitelný;
      // řetězený přepočet se hodnotí jako násobek a o kousek níž (dva koeficienty za sebou)
      if (s.ratio === 1) return 0.85;
      return 0.9 * ratioScore({ ...s, type: 'multiple' });
    case 'locality':
      // poměr k nejbližší lokalitě: 1,00 → 1; ±15 % → 0,5
      return 1 - Math.min(1, Math.abs(Math.log(r)) / Math.log(1.15)) * 0.5;
  }
}

/**
 * Kulatost: jak blízko je zobrazené číslo „hezkému“ číslu s jednou platnou
 * číslicí (nebo s pětkou na druhém místě: 1,5; 25; 150). 0 % odchylka → 1, ≥ 10 % → 0.
 */
export function roundnessScore(value: number): number {
  if (!(value > 0) || !Number.isFinite(value)) return 0;
  const exp = Math.floor(Math.log10(value));
  const m = value / 10 ** exp; // 1 ≤ m < 10
  const nice = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 7.5, 8, 9, 10];
  const err = Math.min(...nice.map((n) => Math.abs(m - n) / n));
  return Math.max(0, 1 - err / 0.1);
}

export function familiarityScore(f: number): number {
  return Math.max(0, Math.min(1, (f - 1) / 2));
}

export function freshnessScore(year: number, currentYear: number): number {
  const age = currentYear - year;
  if (age <= 1) return 1;
  if (age === 2) return 0.8;
  if (age <= 4) return 0.6;
  return 0.3;
}

export function score(s: Suggestion, currentYear: number): ScoreBreakdown {
  const fam = Math.max(...s.refs.map((r) => r.familiarity));
  const year = Math.min(...s.refs.map((r) => r.year));
  const parts = {
    // hypotetické návrhy („při plném výkonu“) jsou srozumitelné, ale realitu zkreslují
    ratio: ratioScore(s) * (s.hypothetical ? 0.5 : 1),
    familiarity: familiarityScore(fam),
    roundness: roundnessScore(s.shownValue),
    freshness: freshnessScore(year, currentYear),
  };
  const total =
    WEIGHTS.ratio * parts.ratio +
    WEIGHTS.familiarity * parts.familiarity +
    WEIGHTS.roundness * parts.roundness +
    WEIGHTS.freshness * parts.freshness;
  return { ...parts, total };
}

export interface Ranked extends Suggestion {
  score: ScoreBreakdown;
}

export interface SelectOptions {
  categories?: Category[] | null;
  /** Nejvýš kolik návrhů na stránku (8). Limit 2 na typ může stránku zkrátit. */
  pageSize?: number;
  /** Nejvýš kolik návrhů jednoho typu na stránce (kvůli pokrytí všech kategorií výjimečně o 1 víc). */
  perType?: number;
  /** Nejvýš kolik návrhů jedné kategorie na stránce (pestrost; při filtru kategorie se neuplatní). */
  perCategory?: number;
  currentYear: number;
}

/** Ohodnotí, odfiltruje a rozdělí návrhy na stránky („další návrhy“ = další stránka). */
export function rankPages(all: Suggestion[], opts: SelectOptions): Ranked[][] {
  const pageSize = opts.pageSize ?? 8;
  const perType = opts.perType ?? 2;
  const perCategory = opts.categories?.length ? Infinity : opts.perCategory ?? 3;
  const minUseful = 0.35; // pod tím je návrh spíš na škodu
  let pool: Ranked[] = all
    .filter((s) => !opts.categories?.length || opts.categories.includes(s.category))
    .map((s) => ({ ...s, score: score(s, opts.currentYear) }))
    .filter((s) => s.score.total >= minUseful && s.score.ratio > 0.1)
    .sort((a, b) => b.score.total - a.score.total || a.id.localeCompare(b.id));

  // stejná reference jen jednou (nejlépe hodnocený typ vyhrává)
  const seenRef = new Set<string>();
  pool = pool.filter((s) => {
    // přepočet přes stejný koeficient jen jednou (nejlepší varianta), jinak stejná reference jen jednou
    const key =
      s.type === 'conversion' ? `conv:${s.refs[0].id}` : s.refs[s.refs.length - 1].id + (s.type === 'per_capita' ? ':pc' : '');
    if (seenRef.has(key)) return false;
    seenRef.add(key);
    return true;
  });

  const pages: Ranked[][] = [];
  while (pool.length) {
    const page: Ranked[] = [];
    const count: Partial<Record<SuggestionType, number>> = {};
    const catCount: Partial<Record<Category, number>> = {};
    const groups = new Set<string>();
    const tryAdd = (s: Ranked, catLimit: number, typeLimit: number): boolean => {
      if (page.includes(s)) return false;
      if ((count[s.type] ?? 0) >= typeLimit) return false;
      if ((catCount[s.category] ?? 0) >= catLimit) return false;
      // pestrost: z jedné skupiny dat (HDP států, ceny potravin …) nejvýš jeden návrh na stránku
      const sGroups = s.refs.map((r) => r.group).filter((g): g is string => !!g);
      if (sGroups.some((g) => groups.has(g))) return false;
      // u řetězených návrhů nejvýš jeden na stránku od stejného výchozího koeficientu / jmenovatele
      const anchor = s.type === 'conversion' || s.type === 'per_capita' ? `anchor:${s.refs[0].id}` : null;
      if (anchor && groups.has(anchor)) return false;
      sGroups.forEach((g) => groups.add(g));
      if (anchor) groups.add(anchor);
      page.push(s);
      count[s.type] = (count[s.type] ?? 0) + 1;
      catCount[s.category] = (catCount[s.category] ?? 0) + 1;
      return true;
    };
    // 1. pokrytí: nejlepší návrh z každé kategorie (když typ už má 2 návrhy, výjimečně 3.)
    if (!opts.categories?.length) {
      for (const typeLimit of [perType, perType + 1]) {
        for (const s of pool) if (page.length < pageSize) tryAdd(s, 1, typeLimit);
      }
    }
    // 2. doplnění podle skóre s limitem na kategorii; 3. bez něj, když by stránka měla méně než 5 návrhů
    for (const s of pool) if (page.length < pageSize) tryAdd(s, perCategory, perType);
    for (const s of pool) if (page.length < Math.min(5, pageSize)) tryAdd(s, Infinity, perType);
    page.sort((x, y) => y.score.total - x.score.total);
    pages.push(page);
    pool = pool.filter((s) => !page.includes(s));
  }
  return pages;
}
