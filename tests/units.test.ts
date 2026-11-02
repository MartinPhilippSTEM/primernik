import { describe, expect, it } from 'vitest';
import {
  compatible,
  fromBase,
  powerToAnnualEnergy,
  ratio,
  timeAtFullPower,
  toBase,
  UNITS,
  UnitError,
} from '../src/core/units';

describe('převody tam a zpět', () => {
  it.each(Object.keys(UNITS).filter((u) => !UNITS[u].currency))('%s', (u) => {
    const q = toBase(123.456, u);
    expect(fromBase(q, u)).toBeCloseTo(123.456, 9);
  });
  it('konkrétní hodnoty', () => {
    expect(toBase(1, 'TWh').value).toBe(1e12);
    expect(fromBase(toBase(1, 'TWh'), 'MWh')).toBeCloseTo(1e6);
    expect(fromBase(toBase(3600, 'J'), 'Wh')).toBeCloseTo(1);
    expect(fromBase(toBase(300, 'ha'), 'km2')).toBeCloseTo(3);
    expect(fromBase(toBase(1, 't CO2e'), 'kg CO2e')).toBe(1000);
    expect(fromBase(toBase(1, 'rok'), 'h')).toBe(8760);
  });
  it('cizí měna jen s kurzem', () => {
    expect(() => toBase(1, 'EUR')).toThrow(UnitError);
    expect(toBase(2, 'EUR', null, { date: 'x', rates: { EUR: 25 } }).value).toBe(50);
  });
  it('do jiné dimenze nepřevede', () => {
    expect(() => fromBase(toBase(1, 'MW'), 'MWh')).toThrow(UnitError);
  });
});

describe('kompatibilita dimenzí', () => {
  it('výkon a energie nejsou kompatibilní', () => {
    expect(compatible('power', 'energy').ok).toBe(false);
    expect(compatible('energy', 'power').ok).toBe(false);
    expect(() => ratio(toBase(3, 'MW'), toBase(1, 'MWh'))).toThrow(UnitError);
  });
  it('CO2 → CO2e ano (s poznámkou), CO2e → CO2 ne', () => {
    const c = compatible('co2', 'co2e');
    expect(c.ok).toBe(true);
    expect(c.note).toMatch(/GWP/);
    expect(compatible('co2e', 'co2').ok).toBe(false);
  });
  it('osoby, domácnosti a byty se nemíchají', () => {
    expect(compatible('persons', 'households').ok).toBe(false);
    expect(compatible('households', 'dwellings').ok).toBe(false);
  });
  it('hmotnost a emise se nemíchají', () => {
    expect(compatible('mass', 'co2').ok).toBe(false);
  });
  it('poměr ve stejné dimenzi', () => {
    expect(ratio(toBase(5, 'mm'), toBase(1, 'cm'))).toBeCloseTo(0.5);
  });
});

describe('výkon → energie jen s předpokladem', () => {
  it('3 MW × 8 760 h = 26,28 GWh/rok', () => {
    const e = powerToAnnualEnergy(toBase(3, 'MW'), { hoursPerYear: 8760, label: 'nepřetržitě' });
    expect(e).toMatchObject({ dim: 'energy', per: 'year' });
    expect(fromBase(e, 'GWh')).toBeCloseTo(26.28);
  });
  it('nesmyslný počet hodin odmítne', () => {
    expect(() => powerToAnnualEnergy(toBase(3, 'MW'), { hoursPerYear: 9000, label: 'x' })).toThrow(UnitError);
    expect(() => powerToAnnualEnergy(toBase(3, 'MW'), { hoursPerYear: 0, label: 'x' })).toThrow(UnitError);
  });
  it('z energie převod nedělá', () => {
    expect(() => powerToAnnualEnergy(toBase(3, 'MWh'), { hoursPerYear: 100, label: 'x' })).toThrow(UnitError);
  });
  it('doba výroby při plném výkonu', () => {
    // 1 TWh / 1 GW = 1 000 h
    expect(timeAtFullPower(toBase(1, 'TWh'), toBase(1, 'GW'))).toBeCloseTo(1000 * 3600);
  });
});
