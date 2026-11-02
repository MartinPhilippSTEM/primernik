import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../src/core/catalog';
import { validateItem } from '../src/core/data';
import type { RefItem } from '../src/core/types';

const root = resolve(__dirname, '..');
const read = (p: string) => JSON.parse(readFileSync(resolve(root, p), 'utf-8'));
const curated: RefItem[] = read('data/curated.json');
const generatedFiles = readdirSync(resolve(root, 'data/generated'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => read(`data/generated/${f}`));

describe('kurátorovaná data', () => {
  it('aspoň 50 položek', () => expect(curated.length).toBeGreaterThanOrEqual(50));
  it.each(curated.map((c) => [c.id, c] as const))('%s je validní a má citaci', (_id, item) => {
    expect(validateItem(item)).toEqual([]);
    expect(item.evidence, 'chybí doslovná citace ze zdroje').toBeTruthy();
  });
});

describe('generovaná data', () => {
  const items = generatedFiles.flatMap((f) => f.items ?? []) as RefItem[];
  it('několik set položek', () => expect(items.length).toBeGreaterThan(300));
  it('každá položka je validní (zdroj, rok, dimenze, rozsah)', () => {
    const bad = items.map((i) => [i.id, validateItem(i)] as const).filter(([, e]) => e.length);
    expect(bad).toEqual([]);
  });
  it('každá položka z Wikidat nese QID', () => {
    for (const i of items.filter((x) => x.source_name === 'Wikidata')) expect(i.source_id).toMatch(/^Q\d+/);
  });
});

describe('katalog', () => {
  const cat = buildCatalog(curated, generatedFiles);
  it('id jsou unikátní a vše se převede', () => {
    expect(new Set(cat.refs.map((r) => r.id)).size).toBe(cat.refs.length);
  });
  it('obsahuje jmenovatele pro „na obyvatele“ a „na domácnost“', () => {
    expect(cat.refs.find((r) => r.tags?.includes('population-cz'))).toBeTruthy();
    expect(cat.refs.find((r) => r.tags?.includes('households-cz'))).toBeTruthy();
  });
  it('domácnosti mají uvedenou definici a nemíchají se', () => {
    const hh = cat.refs.filter((r) => r.dimension === 'households');
    expect(hh.length).toBeGreaterThan(0);
    expect(new Set(hh.map((r) => r.household_definition)).size).toBe(1);
  });
  it('kurzy ČNB a CPI jsou načtené', () => {
    expect(cat.rates?.rates.EUR).toBeGreaterThan(15);
    expect(cat.cpiYear).toBeGreaterThanOrEqual(2024);
  });
});

describe('validátor odmítá', () => {
  const good = curated[0];
  it.each([
    ['bez zdroje', { ...good, source_url: '' }],
    ['bez roku', { ...good, year: undefined }],
    ['bez dimenze', { ...good, dimension: undefined }],
    ['nevěrohodná hodnota', { ...good, value: 1e20 }],
    ['jednotka nesedí na dimenzi', { ...good, unit: 'MW' }],
    ['záporná hodnota', { ...good, value: -1 }],
  ])('%s', (_name, item) => {
    expect(validateItem(item as Partial<RefItem>).length).toBeGreaterThan(0);
  });
});
