import { describe, expect, it } from 'vitest';
import { parse } from '../src/core/parser';

const rates = { date: '2026-11-02', rates: { EUR: 24.3, USD: 21.0, GBP: 28.0, CHF: 26.0, JPY: 0.14 } };

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
  ['3 mil. švýcarských franků', 'money', 78e6, null],
  ['1 000 jenů', 'money', 140, null],
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
  it('chybí jednotka → počítá s korunami a nabídne další výklady („5,5 mil“)', () => {
    const r = parse('5,5 mil');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.interpretations.map((i) => i.unit)).toEqual(['Kč', 'osoba', 'domácnost', 'kWh', 't']);
    expect(r.interpretations[0].quantity.value).toBe(5.5e6);
    expect(r.interpretations[0].notes[0]).toMatch(/Jednotka chybí/);
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

/** Čísla a jednotky slovy, s diakritikou i bez ní. */
const WORDS: [string, string, number][] = [
  ['deset milionů', 'money', 1e7],
  ['deset milionů korun', 'money', 1e7],
  ['deset milionu korun', 'money', 1e7],
  ['Deset Milionů Kč', 'money', 1e7],
  ['pět miliard korun českých', 'money', 5e9],
  ['půl miliardy eur', 'money', 0.5e9 * 24.3],
  ['pul miliardy eur', 'money', 0.5e9 * 24.3],
  ['jeden a půl milionu korun', 'money', 1.5e6],
  ['dva a půl tisíce korun', 'money', 2500],
  ['jedna celá pět milionu korun', 'money', 1.5e6],
  ['dvě stě padesát tisíc lidí', 'persons', 250000],
  ['dvěstě padesát tisíc obyvatel', 'persons', 250000],
  ['pět set tisíc domácností', 'households', 500000],
  ['tři sta tisíc tun', 'mass', 3e8],
  ['milion Kč', 'money', 1e6],
  ['tisíc korun', 'money', 1000],
  ['sto metrů', 'length', 100],
  ['sto dvacet kilometrů', 'length', 120000],
  ['pětadvacet megawattů', 'power', 25e6],
  ['dvacet pět megawattů', 'power', 25e6],
  ['dvacetpět megawattů', 'power', 25e6],
  ['tři terawatthodiny', 'energy', 3e12],
  ['dvanáct gigawatthodin ročně', 'energy', 12e9],
  ['padesát tisíc tun CO2', 'co2', 5e7],
  ['padesát tisíc tun oxidu uhličitého', 'co2', 5e7],
  ['milion tun CO2 ekvivalentu', 'co2e', 1e9],
  ['dva miliony tři sta tisíc obyvatel', 'persons', 2.3e6],
  ['osmnáct hektarů', 'area', 180000],
  ['tři sta hektaru', 'area', 3e6],
  ['čtyřicet kilometrů čtverečních', 'area', 4e7],
  ['deset arů', 'area', 1000],
  ['pět metrů krychlových', 'volume', 5],
  ['pět krychlových metrů', 'volume', 5],
  ['sedm set litrů', 'volume', 0.7],
  ['dvě stě mililitrů', 'volume', 0.0002],
  ['deset tisíc studentů', 'persons', 10000],
  ['tisíc návštěvníků', 'persons', 1000],
  ['osm hodin', 'time', 8 * 3600],
  ['tři měsíce', 'time', 3 * 8760 * 3600 / 12],
  ['devadesát devět kil', 'mass', 99],
  ['€5 mil.', 'money', 5e6 * 24.3],
  ['$ 3 mld', 'money', 3e9 * 21.0],
  ['5 milionu korun', 'money', 5e6],
  ['10 000 domacnosti', 'households', 10000],
  ['120 MWh rocne', 'energy', 1.2e8],
];

describe('parser – čísla a jednotky slovy', () => {
  it.each(WORDS)('%s', (input, dim, value) => {
    const r = parse(input, rates);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    const q = r.interpretations[0].quantity;
    expect(q.dim).toBe(dim);
    expect(q.value).toBeCloseTo(value, 6);
  });
  it('poznámka ukazuje, jak bylo číslo přečteno', () => {
    const r = parse('deset milionů korun');
    expect(r.ok && r.interpretations[0].notes).toContain('Číslo slovy: „deset milionů“ = 10\u00a0000\u00a0000.');
  });
  it('slovo, které není číslo, číslo neudělá', () => {
    expect(parse('hodně korun').ok).toBe(false);
    expect(parse('a korun').ok).toBe(false);
  });
});
