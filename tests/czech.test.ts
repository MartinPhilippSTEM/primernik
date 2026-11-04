import { describe, expect, it } from 'vitest';
import { approx, countPhrase, fmtDuration, fmtPercent, fmtQuantity, pluralKey, roundSig } from '../src/core/czech';
import { plantForms } from '../scripts/plant-forms';

const NB = ' ';
const fabia = {
  one: 'nová Škoda Fabia',
  few: 'nové Škody Fabia',
  many: 'nových Škod Fabia',
  dec: 'nové Škody Fabia',
};

describe('skloňování podle čísla', () => {
  it.each([
    [1, 'one'],
    [2, 'few'],
    [4, 'few'],
    [5, 'many'],
    [11, 'many'],
    [21, 'many'],
    [22, 'many'],
    [1.5, 'dec'],
    [0.3, 'dec'],
    [0, 'many'],
  ])('%s → %s', (n, key) => {
    expect(pluralKey(n)).toBe(key);
  });
  it('s „mil./mld.“ vždy 2. pád množného čísla', () => {
    expect(pluralKey(2, true)).toBe('many');
  });
  it('celé věty', () => {
    expect(countPhrase(1, fabia)).toBe('1 nová Škoda Fabia');
    expect(countPhrase(2, fabia)).toBe('2 nové Škody Fabia');
    expect(countPhrase(4, fabia)).toBe('4 nové Škody Fabia');
    expect(countPhrase(5, fabia)).toBe('5 nových Škod Fabia');
    expect(countPhrase(11, fabia)).toBe('11 nových Škod Fabia');
    expect(countPhrase(21, fabia)).toBe('21 nových Škod Fabia');
    expect(countPhrase(22, fabia)).toBe('22 nových Škod Fabia');
    expect(countPhrase(1.5, fabia)).toBe('1,5 nové Škody Fabia');
    expect(countPhrase(0.3, fabia)).toBe('0,3 nové Škody Fabia');
    expect(countPhrase(12503, fabia)).toBe(`13${NB}000 nových Škod Fabia`);
    expect(countPhrase(3_400_000, fabia)).toBe(`3,4${NB}mil. nových Škod Fabia`);
  });
  it('zaokrouhlení, které skončí na 1, dá jednotné číslo', () => {
    expect(countPhrase(1.04, fabia)).toBe('1 nová Škoda Fabia');
  });
});

describe('čísla', () => {
  it('2 platné číslice', () => {
    expect(roundSig(12345)).toBe(12000);
    expect(roundSig(0.2534)).toBe(0.25);
    expect(roundSig(0.29999999)).toBe(0.3);
    expect(roundSig(987)).toBe(990);
  });
  it('formát cs-CZ', () => {
    expect(approx(12345).text).toBe(`12${NB}000`);
    expect(approx(0.00134).text).toBe('0,0013');
    expect(approx(2.1e9).text).toBe(`2,1${NB}mld.`);
  });
  it('procenta', () => {
    expect(fmtPercent(0.002534)).toBe(`0,25${NB}%`);
    expect(fmtPercent(0.123)).toBe(`12${NB}%`);
  });
});

describe('doby', () => {
  it('ve 4. pádě („za …“)', () => {
    expect(fmtDuration(3600, 'acc')).toBe('1 hodinu');
    expect(fmtDuration(3 * 86400, 'acc')).toBe('3 dny');
    expect(fmtDuration(1.5 * 86400, 'acc')).toBe('36 hodin');
    expect(fmtDuration(10 * 86400, 'acc')).toBe('10 dní');
    expect(fmtDuration(86400 * 365 * 5, 'acc')).toBe('5 let');
    expect(fmtDuration(86400 * 365 * 2.5, 'acc')).toBe('2,5 roku');
    expect(fmtDuration(120, 'acc')).toBe('2 minuty');
    expect(fmtDuration(0.000334, 'acc')).toBe('330 mikrosekund');
    expect(fmtDuration(0.001, 'acc')).toBe('1 milisekundu');
    expect(fmtDuration(0.0000033, 'acc')).toBe('3,3 mikrosekundy');
  });
});

describe('veličiny', () => {
  it('výpis', () => {
    expect(fmtQuantity({ value: 5e9, dim: 'money', per: null })).toBe(`5${NB}mld.${NB}Kč`);
    expect(fmtQuantity({ value: 3e6, dim: 'power', per: null })).toBe(`3${NB}MW`);
    expect(fmtQuantity({ value: 3e6, dim: 'area', per: null })).toBe(`300${NB}ha`);
    expect(fmtQuantity({ value: 2e5, dim: 'households', per: null })).toBe(`200${NB}000 domácností`);
    expect(fmtQuantity({ value: 1.2e8, dim: 'energy', per: 'year' })).toBe(`120${NB}MWh/rok`);
  });
});

describe('názvy elektráren', () => {
  it('jaderná elektrárna Temelín', () => {
    expect(plantForms('Jaderná elektrárna Temelín')).toEqual({
      one: 'jaderná elektrárna Temelín',
      few: 'jaderné elektrárny Temelín',
      many: 'jaderných elektráren Temelín',
      dec: 'jaderné elektrárny Temelín',
      gen: 'jaderné elektrárny Temelín',
    });
  });
  it('přečerpávací vodní elektrárna', () => {
    expect(plantForms('přečerpávací vodní elektrárna Dlouhé stráně')?.many).toBe(
      'přečerpávacích vodních elektráren Dlouhé stráně',
    );
  });
  it('jiné názvy odmítne', () => {
    expect(plantForms('Paroplynový cyklus Počerady')).toBeNull();
  });
});
