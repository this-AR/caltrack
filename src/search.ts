import type { Food, Serving } from './db';

/** Hinglish-tolerant normalisation: "Rajmah" ~ "rajma", "chaawal" ~ "chawal", "paneer" ~ "panir". */
export function norm(s: string): string {
  return s.toLowerCase()
    .replace(/[^a-z0-9ऀ-ॿ ]+/g, ' ')
    .replace(/aa+/g, 'a').replace(/ee+/g, 'i').replace(/oo+/g, 'u').replace(/w/g, 'v').replace(/ph/g, 'f')
    .replace(/([bcdfgjklmnprstvz])h/g, '$1').replace(/h\b/g, '')
    .replace(/(.)\1+/g, '$1')
    .replace(/\s+/g, ' ').trim();
}

// Common Hinglish / Hindi words → names used in INDB/IFCT
const SYN: Record<string, string> = {
  chaval: 'rice', chawal: 'rice', bhat: 'rice', roti: 'chapati', fulka: 'chapati', phulka: 'chapati', dahi: 'curd',
  anda: 'egg', ande: 'egg', aloo: 'potato', alu: 'potato', gobi: 'cauliflower', palak: 'spinach', bhindi: 'okra',
  chai: 'tea', doodh: 'milk', dudh: 'milk', murgh: 'chicken', machli: 'fish', macchi: 'fish', kela: 'banana',
  seb: 'apple', chana: 'chickpea', chole: 'chickpea', moong: 'moong', mung: 'moong', sabzi: 'vegetable', sabji: 'vegetable',
  'राजमा': 'rajma', 'चावल': 'rice', 'रोटी': 'chapati', 'दाल': 'dal', 'दही': 'curd', 'पनीर': 'paneer', 'अंडा': 'egg', 'चाय': 'tea', 'दूध': 'milk',
};

const nameCache = new WeakMap<Food, string>();
const nameNorm = (f: Food) => { let n = nameCache.get(f); if (n === undefined) { n = norm(f.name); nameCache.set(f, n); } return n; };

export function searchFoods(foods: Food[], q: string, limit = 40): Food[] {
  const nq = norm(q);
  if (!nq) return [];
  const tokens = nq.split(' ');
  const scored: [number, Food][] = [];
  for (const f of foods) {
    let s = 0, hit = 0;
    for (const t of tokens) {
      const syn = SYN[t] ? norm(SYN[t]) : null;
      const at = f.norm.indexOf(t);
      const as = syn ? f.norm.indexOf(syn) : -1;
      const p = at >= 0 ? at : as;
      if (p < 0) continue;
      hit++;
      s += 10 - Math.min(p, 40) / 5; // earlier in name = better
      if (f.norm.startsWith(t) || (syn && f.norm.startsWith(syn))) s += 6;
      if (new RegExp(`\\b${t}\\b`).test(f.norm)) s += 4;
    }
    if (hit < tokens.length) continue;
    if (f.src === 'IFCT' && !tokens.includes('raw')) s -= 22; // prefer cooked dishes over raw ingredients
    if (f.custom) s += 5;
    if (f.src === 'Common') s += 6; // curated everyday staples (plain rice, egg, milk)
    const nn = nameNorm(f);
    if (nn === nq || nn.startsWith(nq + ' ')) s += 6; // exact name match
    s += Math.min(f.uses, 20) * 0.8 - nn.length / 12;
    scored.push([s, f]);
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, limit).map(x => x[1]);
}

// ---------- servings ----------
export const GENERIC: Serving[] = [['1 g', 1], ['100 g', 100], ['1 tbsp', 15], ['1 tsp', 5], ['1 cup', 240]];
export function servingsFor(f: Food): Serving[] {
  const seen = new Set<string>();
  return [...f.serv, ...GENERIC].filter(([l]) => (seen.has(l) ? false : (seen.add(l), true)));
}

// ---------- offline free-text meal parser: "2 roti, 1 katori rajma aur thoda chawal" ----------
const WORDNUM: Record<string, number> = { ek: 1, one: 1, a: 1, an: 1, do: 2, two: 2, teen: 3, three: 3, char: 4, four: 4, panch: 5, five: 5, half: 0.5, aadha: 0.5, adha: 0.5, dedh: 1.5, dhai: 2.5, thoda: 0.5, thodi: 0.5 };
const UNITS: Record<string, Serving> = {
  katori: ['1 katori', 150], bowl: ['1 katori', 150], plate: ['1 plate', 250], glass: ['1 glass', 250], cup: ['1 cup', 240],
  tbsp: ['1 tbsp', 15], chammach: ['1 tbsp', 15], spoon: ['1 tbsp', 15], tsp: ['1 tsp', 5], g: ['1 g', 1], gm: ['1 g', 1], gram: ['1 g', 1], grams: ['1 g', 1], ml: ['1 g', 1],
  piece: ['', 0], pcs: ['', 0], slice: ['', 0], scoop: ['', 0],
};
export type Parsed = { text: string; qty: number; unit?: Serving; food?: Food };

export function parseMeal(foods: Food[], text: string): Parsed[] {
  return text.split(/,|\+|\band\b|\baur\b|\bwith\b|\bke saath\b|\n/i).map(s => s.trim()).filter(Boolean).map(part => {
    let words = part.toLowerCase().split(/\s+/);
    let qty = 1, unit: Serving | undefined;
    const m = words[0]?.match(/^(\d+(?:\.\d+)?)(g|gm|ml)?$/);
    if (m) { qty = parseFloat(m[1]); if (m[2]) unit = UNITS[m[2]]; words = words.slice(1); }
    else if (WORDNUM[words[0]] !== undefined) { qty = WORDNUM[words[0]]; words = words.slice(1); }
    const u = UNITS[words[0]?.replace(/s$/, '')] ?? UNITS[words[0]];
    if (u) { if (u[1]) unit = u; words = words.slice(1); }
    const name = words.filter(w => !['ki', 'ka', 'ke', 'of', 'khaya', 'khayi', 'khaye', 'piya', 'li', 'liya'].includes(w)).join(' ');
    const food = searchFoods(foods, name, 1)[0];
    return { text: part, qty, unit, food };
  });
}
