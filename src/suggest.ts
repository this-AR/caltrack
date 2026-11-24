import { Food, allFoods } from './db';
import { NVec, NKey, idx, META, Diet, Targets, fmt } from './nutrients';

const NONVEG = /chicken|mutton|fish|prawn|shrimp|crab|meat|keema|lamb|pork|beef|goat|liver|sardine|tuna|salmon|mackerel|lobster|squid|oyster|mussel|clam|duck|turkey|bacon|ham|sausage|salami|murgh|gosht|machli|rohu|hilsa|pomfret|seer/i;
const EGG = /\begg|anda|omelet|omelette|bhurji/i;
const DAIRY = /milk|curd|dahi|paneer|cheese|ghee|butter|cream|yogurt|yoghurt|khoa|khoya|lassi|raita|kheer|whey|malai/i;

export function fitsDiet(f: Food, diet: Diet) {
  const s = f.name + ' ' + f.alt;
  if (diet === 'nonveg') return true;
  if (NONVEG.test(s)) return false;
  if (diet === 'egg') return true;
  if (EGG.test(s)) return false;
  return diet === 'veg' || !DAIRY.test(s);
}

export type Suggestion = { key: string; tone: 'good' | 'warn' | 'info'; title: string; body: string; foods?: { food: Food; label: string; grams: number; gives: string }[] };

/** How much of the day has passed (food-wise): 0 before 7am, 1 after 10pm. */
const dayProgress = (h = new Date().getHours() + new Date().getMinutes() / 60) => Math.min(1, Math.max(0, (h - 7) / 15));

/** Foods richest in a nutrient per 100 kcal, reasonable to eat, matching diet. */
export function bestSources(k: NKey, diet: Diet, kcalLeft: number, n = 3) {
  const i = idx(k), ki = idx('kcal'), si = idx('sugar');
  return allFoods()
    .filter(f => f.src !== 'IFCT' && f.n[ki] > 20 && f.n[ki] < 400 && !/\bghee\b|butter|\boil\b|cream|vanaspati|lard/i.test(f.name) && f.n[i] > 0 && !/sauce|puree|purée|chutney|dip\b|syrup|stock|squash|pickle|achar|essence|powder/i.test(f.name) && (f.serv[0]?.[1] ?? 100) >= 25 && f.n[si] * 4 < f.n[ki] * 0.25 && !/cake|gateau|pastry|pudding|jelly|jelli|jam|swans|souffle|mousse|ice cream|halwa|barfi|ladoo|laddu|kheer|cookie|biscuit|consomme|^(garam|chaa?t|pav bhaji|samb(h)?ar|chana|chole|tea|kitchen king|biryani|rasam|meat|chai) masala$/i.test(f.name) && fitsDiet(f, diet)) // no desserts as "nutrition" tips
    .map(f => ({ f, d: f.n[i] / f.n[ki] }))
    .sort((a, b) => b.d - a.d)
    .slice(0, 12)
    // among the densest, prefer dishes you already eat
    .sort((a, b) => Math.min(b.f.uses, 5) - Math.min(a.f.uses, 5))
    .slice(0, n)
    .map(({ f }) => {
      const [label, g] = f.serv[0] ?? ['100 g', 100];
      const grams = Math.min(g, Math.max(50, (kcalLeft / f.n[ki]) * 100));
      const lab = grams === g ? label : `${Math.round(grams)} g`;
      return { food: f, label: lab, grams, gives: `${fmt((f.n[i] * grams) / 100)} ${META[k].unit} ${/^(Vitamin|B\d)/.test(META[k].label) ? META[k].label : META[k].label.toLowerCase()}` };
    });
}

export function suggestions(total: NVec, t: Targets, diet: Diet, waterMl: number, loggedToday: boolean): Suggestion[] {
  const out: Suggestion[] = [];
  const prog = dayProgress();
  const pct = (k: NKey) => total[idx(k)] / (t.n[idx(k)] || 1);
  const kcalLeft = Math.max(150, t.n[idx('kcal')] - total[idx('kcal')]);

  if (!loggedToday) {
    out.push({ key: 'start', tone: 'info', title: 'Nothing logged yet', body: 'Log your first meal. Typing "2 roti, 1 katori dal" in the quick box works too.' });
    return out;
  }
  if (pct('kcal') > 1.08) out.push({ key: 'over', tone: 'warn', title: `${fmt(total[0] - t.n[0])} kcal over target`, body: 'Keep the rest of the day light: salad, buttermilk (chaas), or clear soup. A 30-min brisk walk burns ~150 kcal.' });

  // Gaps: compare against what "should" be eaten by this time of day
  const expect = Math.max(0.35, prog);
  const gapKeys: NKey[] = ['protein', 'fiber', 'iron', 'calcium', 'vitC', 'folate', 'magnesium', 'potassium', 'zinc', 'vitA'];
  const gaps = gapKeys.map(k => ({ k, r: pct(k) / expect })).filter(g => g.r < 0.7).sort((a, b) => a.r - b.r).slice(0, 3);
  for (const g of gaps) {
    const m = META[g.k];
    const left = t.n[idx(g.k)] - total[idx(g.k)];
    out.push({
      key: 'gap-' + g.k, tone: 'warn', title: `Low on ${/^(Vitamin|B\d)/.test(m.label) ? m.label : m.label.toLowerCase()}`,
      body: `${Math.round(pct(g.k) * 100)}% of today's target. ${fmt(left)} ${m.unit} to go. These would help:`,
      foods: bestSources(g.k, diet, kcalLeft),
    });
  }
  for (const k of ['sodium', 'sugar', 'satfat'] as NKey[])
    if (pct(k) > 1) out.push({ key: 'lim-' + k, tone: 'warn', title: `${META[k].label} above limit`, body: `${fmt(total[idx(k)])} ${META[k].unit} vs a limit of ${fmt(t.n[idx(k)])}. ${k === 'sodium' ? 'Go easy on pickles, papad, namkeen and packaged snacks.' : k === 'sugar' ? 'Cut back on chai sugar, sweets and cold drinks.' : 'Use less ghee, butter, cream and fried snacks.'}` });

  if (waterMl < t.waterMl * prog * 0.7) out.push({ key: 'water', tone: 'info', title: 'Drink some water', body: `${(waterMl / 1000).toFixed(1)} L so far. By now aim for about ${((t.waterMl * prog) / 1000).toFixed(1)} L.` });
  if (diet !== 'nonveg') out.push({ key: 'b12', tone: 'info', title: 'Vitamin B12 is not tracked', body: 'Indian vegetarian diets are often low in B12. Milk and curd help, and you can ask a doctor about a supplement.' });
  if (!gaps.length && pct('kcal') <= 1.08) out.push({ key: 'ok', tone: 'good', title: 'On track', body: 'Your nutrients are in line for this time of day. Keep it up.' });
  return out;
}
