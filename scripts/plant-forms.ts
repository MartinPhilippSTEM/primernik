/**
 * Skloňování názvu typu „Jaderná elektrárna Temelín“, „vodní elektrárna Orlík“.
 * Vrací null, pokud název tomuto vzoru neodpovídá (pak se položka vynechá).
 */
export function plantForms(label: string) {
  const m = label.match(/^((?:\S+(?:á|í)\s+)*)(elektrárna)\s+(.+)$/i);
  if (!m) return null;
  const adjs = m[1].trim() ? m[1].trim().split(/\s+/) : [];
  const name = m[3];
  const adj = (a: string, c: 'few' | 'many' | 'gen') => {
    const l = a.toLowerCase();
    if (l.endsWith('í')) return c === 'many' ? l + 'ch' : l; // vodní → vodních
    const stem = l.slice(0, -1); // jaderná → jadern
    return c === 'many' ? stem + 'ých' : stem + 'é';
  };
  const noun = { few: 'elektrárny', many: 'elektráren', gen: 'elektrárny' };
  const build = (c: 'few' | 'many' | 'gen') => [...adjs.map((a) => adj(a, c)), noun[c], name].join(' ');
  const one = [...adjs.map((a) => a.toLowerCase()), 'elektrárna', name].join(' ');
  return { one, few: build('few'), many: build('many'), dec: build('gen'), gen: build('gen') };
}
