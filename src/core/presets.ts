/**
 * Předvolby pro převod výkon → energie (hodiny provozu na plný výkon za rok).
 *
 * Žádný oficiální zdroj neuvádí „typické využití“ přímo, proto se počítá
 * průhledně jako výroba ÷ instalovaný výkon ze dvou citovaných položek dat.
 * Výpočet se ukazuje u výsledku. Bez potřebných dat se předvolba nenabídne.
 */
import { fmtExact } from './czech';
import type { Ref } from './types';
import { HOURS_PER_YEAR, type PowerAssumption } from './units';

export interface PowerPreset extends PowerAssumption {
  id: string;
}

const DERIVED: { id: string; name: string; production: string; capacity: string; caveat?: string }[] = [
  {
    id: 'fve',
    name: 'fotovoltaika v ČR',
    production: 'cr-vyroba-fve-2025',
    capacity: 'cr-instalovany-vykon-fve-2025',
    caveat: 'výroba ERÚ nezahrnuje část licencovaných FVE, které nehlásí OTE – skutečné využití je o něco vyšší',
  },
  { id: 'vitr', name: 'větrné elektrárny v ČR', production: 'cr-vyroba-vte-2025', capacity: 'cr-instalovany-vykon-vte-2025' },
  { id: 'jadro', name: 'jaderná elektrárna Temelín', production: 'temelin-rocni-vyroba-2025', capacity: 'elektrarna-temelin-vykon' },
];

export function powerPresets(refs: Ref[]): PowerPreset[] {
  const byId = new Map(refs.map((r) => [r.id, r]));
  const out: PowerPreset[] = [
    { id: 'nepretrzite', hoursPerYear: HOURS_PER_YEAR, label: 'nepřetržitý provoz na plný výkon (8 760 h/rok)' },
  ];
  for (const d of DERIVED) {
    const prod = byId.get(d.production);
    const cap = byId.get(d.capacity);
    if (!prod || !cap || prod.q.dim !== 'energy' || cap.q.dim !== 'power') continue;
    const hours = prod.q.value / cap.q.value;
    if (!(hours > 0 && hours <= HOURS_PER_YEAR)) continue;
    out.push({
      id: d.id,
      hoursPerYear: Math.round(hours),
      label:
        `typické využití – ${d.name}: výroba ${fmtExact(prod.q.value / 1e9)} GWh (${prod.source_name}, ${prod.year}) ÷ ` +
        `instalovaný výkon ${fmtExact(cap.q.value / 1e6)} MW (${cap.source_name}, ${cap.year})` +
        (d.caveat ? `; pozor: ${d.caveat}` : ''),
      source_name: prod.source_name,
      source_url: prod.source_url,
    });
  }
  return out;
}
