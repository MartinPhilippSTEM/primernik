import { describe, expect, it } from 'vitest';
import { parse } from '../src/core/parser';

const rates = { date: '2026-11-02', rates: { EUR: 24.3, USD: 21.0, GBP: 28.0 } };

/** [vstup, dimenze, hodnota v základních jednotkách, tok] */
const OK: [string, string, number, 'year' | null][] = [
  ['5 mld. Kč', 'money', 5e9, null],
  ['5 miliard Kč', 'money', 5e9, null],
  ['5 mld Kč', 'money', 5e9, null],
  ['5mld.Kč', 'money', 5e9, null],
  ['5 miliard korun', 'money', 5e9, null],
  ['1,5 miliardy Kč', 'money', 1.5e9, null],
  ['5,5 mil. Kč', 'money', 5.5e6, null],
  ['2 miliony korun', 'money', 2e6, null],
  ['300 tis. Kč', 'money', 3e5, null],
  ['1 bil. Kč', 'money', 1e12, null],
  ['milion Kč', 'money', 1e6, null],
  ['10 000 Kč/rok', 'money', 1e4, 'year'],
  ['10 000 Kč ročně', 'money', 1e4, 'year'],
  ['2 000 Kč/měsíc', 'money', 24000, 'year'],
  ['1 mil. EUR', 'money', 24.3e6, null],
  ['3 MW', 'power', 3e6, null],
  ['3MW', 'power', 3e6, null],
  ['3 mw', 'power', 3e6, null],
  ['3,5 GW', 'power', 3.5e9, null],
  ['500 kW', 'power', 5e5, null],
  ['10 kWp', 'power', 1e4, null],
  ['1 TWh', 'energy', 1e12, null],
  ['120 MWh/rok', 'energy', 1.2e8, 'year'],
  ['3 600 kJ', 'energy', 1000, null],
  ['1 GJ', 'energy', 1e9 / 3600, null],
  ['50 000 t CO2', 'co2', 5e7, null],
  ['50 000 tun CO2', 'co2', 5e7, null],
  ['1 200 000 t CO2e', 'co2e', 1.2e9, null],
  ['1,2 Mt CO2e', 'co2e', 1.2e9, null],
  ['5 kt CO₂-ekv.', 'co2e', 5e6, null],
  ['20 t', 'mass', 2e4, null],
  ['300 ha', 'area', 3e6, null],
  ['300 hektarů', 'area', 3e6, null],
  ['2,5 km²', 'area', 2.5e6, null],
  ['2,5 km2', 'area', 2.5e6, null],
  ['120 m2', 'area', 120, null],
  ['42 km', 'length', 42000, null],
  ['1 000 m3', 'volume', 1000, null],
  ['5 000 litrů', 'volume', 5, null],
  ['200 tisíc domácností', 'households', 2e5, null],
  ['200 tis. domácností', 'households', 2e5, null],
  ['10 000 obyvatel', 'persons', 1e4, null],
  ['10 000 lidí', 'persons', 1e4, null],
  ['5 000 bytů', 'dwellings', 5000, null],
  ['3 dny', 'time', 3 * 86400, null],
  ['1.234,5 Kč', 'money', 1234.5, null],
  ['5e9 Kč', 'money', 5e9, null],
];

describe('parser – platné vstupy', () => {
  it.each(OK)('%s', (input, dim, value, per) => {
    const r = parse(input, rates);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    const q = r.interpretations[0].quantity;
    expect(q.dim).toBe(dim);
    expect(q.value).toBeCloseTo(value, 6);
    expect(q.per).toBe(per);
  });
});

describe('parser – chyby a okraje', () => {
  it('nula', () => {
    const r = parse('0 Kč');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Nulu/);
  });
  it('záporné číslo', () => {
    const r = parse('-5 mld. Kč');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/kladné/);
  });
  it('nesmysl', () => {
    expect(parse('ahoj světe').ok).toBe(false);
    expect(parse('').ok).toBe(false);
    expect(parse('5 žirafích krků').ok).toBe(false);
  });
  it('chybí jednotka → nabídne možnosti („5,5 mil“)', () => {
    const r = parse('5,5 mil');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/jednotka/);
      expect(r.suggestions).toContain('5,5 mil. Kč');
    }
  });
  it('CO2 bez hmotnosti', () => {
    expect(parse('50 000 CO2').ok).toBe(false);
  });
  it('MW/rok je chyba – výkon už je tok', () => {
    const r = parse('3 MW/rok');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/MWh\/rok/);
  });
  it('cizí měna bez kurzu', () => {
    expect(parse('5 EUR').ok).toBe(false);
  });
  it('tečka v „1.200 MW“ je nejednoznačná → dva výklady', () => {
    const r = parse('1.200 MW');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.interpretations.map((i) => i.quantity.value)).toEqual([1.2e9, 1.2e6]);
  });
  it('„milimetr“ se nezaměňuje s „mil.“', () => {
    const r = parse('5 milimetrů');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.interpretations[0].quantity).toMatchObject({ dim: 'length', value: 0.005 });
  });
});

describe('parser – výklad „Rozumím“', () => {
  it('5 miliard Kč → 5 × 10⁹ Kč', () => {
    const r = parse('5 miliard Kč');
    expect(r.ok && r.interpretations[0].explain).toBe('5 × 10⁹ Kč');
  });
  it('200 tisíc domácností', () => {
    const r = parse('200 tisíc domácností');
    expect(r.ok && r.interpretations[0].explain).toBe('200 000 domácností');
  });
  it('EUR uvádí kurz ČNB', () => {
    const r = parse('1 mil. EUR', rates);
    expect(r.ok && r.interpretations[0].notes.join(' ')).toMatch(/kurzem ČNB/);
  });
});
