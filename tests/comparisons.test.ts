import { describe, expect, it } from 'vitest';
import { compare, copyText, refValue } from '../src/core/comparisons';
import { toRefs } from '../src/core/data';
import { familiarityScore, freshnessScore, rankPages, ratioScore, roundnessScore, score } from '../src/core/ranker';
import type { RefItem } from '../src/core/types';
import { toBase } from '../src/core/units';

const base = {
  per: null,
  basis: 'test',
  source_name: 'Test',
  source_url: 'https://example.org',
  source_id: null,
  retrieved_at: '2026-11-02',
  note: '',
  familiarity: 3,
  evidence: 'x',
} as const;

const items: RefItem[] = [
  {
    ...base,
    id: 'fabia',
    label: 'Fabia',
    forms: { one: 'nová Škoda Fabia', few: 'nové Škody Fabia', many: 'nových Škod Fabia', dec: 'nové Škody Fabia', gen: 'nové Škody Fabia' },
    value: 400000,
    unit: 'Kč',
    dimension: 'money',
    kind: 'unit',
    category: 'kazdodenni',
    year: 2026,
  },
  {
    ...base,
    id: 'rozpocet',
    label: 'výdaje SR',
    forms: { one: 'výdaje', few: 'výdaje', many: 'výdajů', dec: 'výdajů', gen: 'výdajů státního rozpočtu 2026' },
    value: 2e12,
    unit: 'Kč',
    dimension: 'money',
    per: 'year',
    kind: 'aggregate',
    category: 'verejne-finance',
    year: 2026,
    time_phrase: 'stát tolik vydá za {t}',
  },
  {
    ...base,
    id: 'obyvatele-cr',
    label: 'obyvatelé ČR',
    forms: { one: 'x', few: 'x', many: 'x', dec: 'x', gen: 'obyvatel ČR' },
    value: 1e7,
    unit: 'osoba',
    dimension: 'persons',
    kind: 'aggregate',
    category: 'geografie',
    year: 2026,
    tags: ['population-cz'],
    level: 'stat',
  },
  {
    ...base,
    id: 'olomouc',
    label: 'Olomouc',
    forms: { one: 'x', few: 'x', many: 'x', dec: 'x', gen: 'x' },
    value: 100000,
    unit: 'osoba',
    dimension: 'persons',
    kind: 'aggregate',
    category: 'geografie',
    year: 2026,
    level: 'obec',
    place: 'Olomouc',
  },
  {
    ...base,
    id: 'temelin',
    label: 'Temelín',
    forms: { one: 'Temelín', few: 'Temelíny', many: 'Temelínů', dec: 'Temelína', gen: 'Temelína' },
    value: 2000,
    unit: 'MW',
    dimension: 'power',
    kind: 'unit',
    category: 'energetika',
    year: 2026,
    time_phrase: 'Temelín by to při plném výkonu vyrobil za {t}',
  },
  {
    ...base,
    id: 'emise',
    label: 'emise ČR',
    forms: { one: 'x', few: 'x', many: 'x', dec: 'x', gen: 'emisí ČR' },
    value: 1e8,
    unit: 't CO2e',
    dimension: 'co2e',
    per: 'year',
    kind: 'aggregate',
    category: 'energetika',
    year: 2024,
  },
  {
    ...base,
    id: 'spotreba',
    label: 'spotřeba ČR',
    forms: { one: 'x', few: 'x', many: 'x', dec: 'x', gen: 'roční spotřeby elektřiny ČR' },
    value: 60,
    unit: 'TWh',
    dimension: 'energy',
    per: 'year',
    kind: 'aggregate',
    category: 'energetika',
    year: 2025,
  },
];
const refs = toRefs(items);

describe('typy přirovnání', () => {
  const money = compare(toBase(5e9, 'Kč'), '5 mld. Kč', refs);
  it('násobek', () => {
    expect(money.find((s) => s.id === 'multiple:fabia')?.sentence).toBe('≈ 13 000 nových Škod Fabia');
  });
  it('podíl', () => {
    expect(money.find((s) => s.id === 'share:rozpocet')?.sentence).toBe('≈ 0,25 % výdajů státního rozpočtu 2026');
  });
  it('na obyvatele', () => {
    expect(money.find((s) => s.type === 'per_capita')?.sentence).toBe('≈ 500 Kč na každého obyvatele ČR');
  });
  it('časový ekvivalent', () => {
    expect(money.find((s) => s.id === 'time:rozpocet')?.sentence).toBe('stát tolik vydá za ≈ 22 hodin');
  });
  it('lokalita', () => {
    const p = compare(toBase(98000, 'osoba'), '98 000 obyvatel', refs);
    expect(p.find((s) => s.type === 'locality')?.sentence).toMatch(/^≈ tolik obyvatel má Olomouc/);
    expect(p.find((s) => s.type === 'share')?.sentence).toBe('≈ 0,98 % obyvatel ČR');
  });
  it('kopírovací text obsahuje větu i zdroj', () => {
    const s = money.find((x) => x.id === 'multiple:fabia')!;
    expect(copyText('5 mld. Kč', s)).toBe('5 mld. Kč ≈ 13 000 nových Škod Fabia (zdroj: Test, 2026, https://example.org)');
  });
});

describe('výkon a energie', () => {
  it('bez předpokladu se výkon s energií neporovná', () => {
    const s = compare(toBase(3, 'MW'), '3 MW', refs);
    expect(s.every((x) => x.refs.every((r) => r.dimension === 'power'))).toBe(true);
  });
  it('s předpokladem ano a předpoklad je u výsledku', () => {
    const s = compare(toBase(3000, 'MW'), '3 GW', refs, { power: { hoursPerYear: 8760, label: 'nepřetržitý provoz' } });
    const e = s.find((x) => x.id === 'share:spotreba:e')!;
    expect(e.sentence).toBe('≈ 44 % roční spotřeby elektřiny ČR (při 8 760 h provozu ročně)');
    expect(e.assumptions.join(' ')).toMatch(/nepřetržitý provoz \(8 760 h\/rok\)/);
  });
  it('energie vs. výkon zdroje → doba při plném výkonu', () => {
    const s = compare(toBase(1, 'TWh'), '1 TWh', refs);
    expect(s.find((x) => x.id === 'time:temelin')?.sentence).toBe('Temelín by to při plném výkonu vyrobil za ≈ 21 dní');
  });
});

describe('CO2 a CO2e', () => {
  it('CO2 lze porovnat s CO2e a poznámka to vysvětlí', () => {
    const s = compare(toBase(50000, 't CO2'), '50 000 t CO2', refs).find((x) => x.id === 'share:emise')!;
    expect(s.sentence).toBe('≈ 0,05 % emisí ČR');
    expect(s.assumptions.join(' ')).toMatch(/GWP/);
  });
  it('CO2e se se samotným CO2 neporovná', () => {
    const co2Ref = toRefs([{ ...items[5], id: 'co2only', unit: 't CO2', dimension: 'co2' }]);
    expect(compare(toBase(1, 't CO2e'), '1 t CO2e', co2Ref)).toEqual([]);
  });
});

describe('inflace', () => {
  it('přepočet ceny na ceny jiného roku', () => {
    const old = toRefs([{ ...items[0], id: 'old', year: 2020 }])[0];
    const r = refValue(old, { cpi: { index: { 2020: 100, 2025: 150 }, source_name: 'ČSÚ', source_url: 'https://x' }, cpiYear: 2025 });
    expect(r.value).toBe(600000);
    expect(r.note).toMatch(/v cenách roku 2025/);
  });
});

describe('bodování', () => {
  it('poměr', () => {
    expect(ratioScore({ type: 'multiple', ratio: 12, shownValue: 12 })).toBe(1);
    expect(ratioScore({ type: 'multiple', ratio: 200000, shownValue: 200000 })).toBeLessThan(0.5);
    expect(ratioScore({ type: 'share', ratio: 0.05, shownValue: 5 })).toBe(1);
    expect(ratioScore({ type: 'share', ratio: 0.00001, shownValue: 0.001 })).toBeLessThan(0.1);
  });
  it('kulatost', () => {
    expect(roundnessScore(3)).toBe(1);
    expect(roundnessScore(250)).toBe(1);
    expect(roundnessScore(3.45)).toBeLessThan(0.1);
    expect(roundnessScore(2.05)).toBeGreaterThan(0.7);
  });
  it('známost a čerstvost', () => {
    expect(familiarityScore(3)).toBe(1);
    expect(familiarityScore(1)).toBe(0);
    expect(freshnessScore(2026, 2026)).toBe(1);
    expect(freshnessScore(2015, 2026)).toBe(0.3);
  });
  it('výběr: nejvýš 2 návrhy jednoho typu na stránku', () => {
    const pages = rankPages(compare(toBase(5e9, 'Kč'), '5 mld. Kč', refs), { currentYear: 2026 });
    for (const page of pages) {
      const counts: Record<string, number> = {};
      page.forEach((s) => (counts[s.type] = (counts[s.type] ?? 0) + 1));
      expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(2);
      expect(page.length).toBeLessThanOrEqual(8);
    }
  });
  it('hypotetický návrh („při plném výkonu“) má nižší skóre poměru', () => {
    const s = compare(toBase(1, 'TWh'), '1 TWh', refs).find((x) => x.id === 'time:temelin')!;
    expect(s.hypothetical).toBe(true);
    expect(score(s, 2026).ratio).toBe(0.5);
  });
  it('filtr kategorie', () => {
    const pages = rankPages(compare(toBase(5e9, 'Kč'), '5 mld. Kč', refs), { currentYear: 2026, categories: ['kazdodenni'] });
    expect(pages.flat().every((s) => s.category === 'kazdodenni')).toBe(true);
  });
});
