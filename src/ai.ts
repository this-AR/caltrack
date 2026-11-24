import { getKv, getProfile, dailyTotals, getLogs, today, weights, allFoods, Food } from './db';
import { KEYS, META, NVec, computeTargets, fmt, idx } from './nutrients';
import { searchFoods } from './search';

export const DEFAULT_MODEL = 'gemini-flash-latest';
export const hasAi = () => !!getKv('gemini_key');

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };
export type ChatMsg = { role: 'user' | 'model'; text: string };

async function gemini(contents: { role: string; parts: Part[] }[], opts: { json?: boolean; system?: string } = {}) {
  const key = getKv('gemini_key');
  if (!key) throw new Error('Add your Gemini API key in Profile → AI to use this.');
  const chosen = getKv('gemini_model') || DEFAULT_MODEL;
  // Google often answers "high demand" (503) on one model while others work: retry once, then fall back.
  const models = [chosen, chosen, ...FALLBACK_MODELS.filter(m => m !== chosen)];
  const payload = JSON.stringify({
    contents,
    ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
    generationConfig: { temperature: 0.4, ...(opts.json ? { responseMimeType: 'application/json' } : {}) },
  });
  let lastErr = '';
  for (let i = 0; i < models.length; i++) {
    if (i === 1) await new Promise(r => setTimeout(r, 1500));
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 60000);
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(models[i])}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: payload, signal: ctl.signal,
      });
    } catch (e: any) {
      lastErr = e?.name === 'AbortError' ? 'Gemini took too long to answer.' : 'No internet connection.';
      continue;
    } finally { clearTimeout(timer); }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      lastErr = body?.error?.message || `Gemini error ${res.status}`;
      if (res.status === 503 || res.status === 500 || res.status === 429 || res.status === 404) continue; // busy, quota or unknown model: try the next one
      throw new Error(lastErr); // bad key, bad request: no point retrying
    }
    const text: string = body?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
    if (text) return text;
    lastErr = 'Gemini returned an empty answer.';
  }
  throw new Error(`${lastErr} Please try again in a minute.`);
}
export const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-flash-lite-latest'];
const parseJson = (s: string) => JSON.parse(s.replace(/^```(?:json)?|```$/gm, '').trim());

// ---------- 1. meal from photo or text ----------
export type AiItem = { name: string; grams: number; portion: string; kcal: number; protein: number; carbs: number; fat: number; fiber: number; match?: Food };
const MEAL_PROMPT = `You are an Indian nutrition expert. Identify every food item and estimate the portion.
Use Indian household measures (katori ≈150 g cooked dal/sabzi, roti ≈40 g, cooked rice katori ≈150 g, glass 250 ml).
Return ONLY JSON: {"items":[{"name":"common English name with Hindi name in brackets e.g. Kidney bean curry (Rajma)","grams":number,"portion":"e.g. 1 katori","kcal":number,"protein":g,"carbs":g,"fat":g,"fiber":g}]}
All nutrient numbers are for the full estimated portion, not per 100 g.`;

export async function mealFromInput(input: { text?: string; imageBase64?: string; mime?: string }): Promise<AiItem[]> {
  const parts: Part[] = [{ text: MEAL_PROMPT }];
  if (input.imageBase64) parts.push({ inline_data: { mime_type: input.mime || 'image/jpeg', data: input.imageBase64 } });
  if (input.text) parts.push({ text: `Meal description: ${input.text}` });
  const out = parseJson(await gemini([{ role: 'user', parts }], { json: true }));
  const foods = allFoods();
  // model output is untrusted: clamp every number (a photo can carry text that steers the model)
  const num = (x: any, max: number) => Math.min(max, Math.max(0, Number(x) || 0));
  return (Array.isArray(out.items) ? out.items : []).filter((i: any) => typeof i?.name === 'string' && num(i.grams, 3000) > 0).map((i: any) => {
    i = { name: i.name.slice(0, 120), portion: String(i.portion ?? '').slice(0, 40), grams: num(i.grams, 3000), kcal: num(i.kcal, 5000), protein: num(i.protein, 300), carbs: num(i.carbs, 600), fat: num(i.fat, 300), fiber: num(i.fiber, 150) };
    const bracket = /\(([^)]+)\)/.exec(i.name)?.[1];
    const match = searchFoods(foods, i.name.replace(/\(.*\)/, ''), 1)[0] ?? (bracket ? searchFoods(foods, bracket, 1)[0] : undefined);
    return { ...i, grams: Math.max(1, Math.round(i.grams)), match } as AiItem;
  });
}

// ---------- 2. fill nutrition for a missing food (name and/or label photo) ----------
export async function nutritionFor(name: string, imageBase64?: string): Promise<{ name: string; n: NVec; serving: [string, number] }> {
  const keys = KEYS.map(k => `"${k}" (${META[k].unit})`).join(', ');
  const parts: Part[] = [{ text: `Give typical nutrition PER 100 g for the food${imageBase64 ? ' in this nutrition label/photo' : ''}: "${name}". If it is an Indian dish, assume a typical home-cooked Indian recipe.
Return ONLY JSON: {"name": "clean food name", "serving_label": "e.g. 1 katori / 1 piece / 1 packet", "serving_grams": number, "per100g": {${keys}}}. Use 0 when a nutrient is truly absent. Use your best estimate rather than leaving a field out.` }];
  if (imageBase64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: imageBase64 } });
  const o = parseJson(await gemini([{ role: 'user', parts }], { json: true }));
  const n = KEYS.map(k => Math.max(0, Number(o.per100g?.[k]) || 0));
  return { name: o.name || name, n, serving: [o.serving_label ? `1 ${String(o.serving_label).replace(/^1\s+/, '')}` : '1 serving', Math.max(1, Number(o.serving_grams) || 100)] };
}

// ---------- 3. coach: context-aware chat, day plan, weekly review ----------
export function coachContext(): string {
  const p = getProfile();
  if (!p) return 'User has not set up a profile yet.';
  const t = computeTargets(p);
  const week = dailyTotals(7);
  const logged = week.filter(d => d.logged);
  const avg = (k: (typeof KEYS)[number]) => logged.length ? logged.reduce((a, d) => a + d.n[idx(k)], 0) / logged.length : 0;
  const todayLogs = getLogs(today());
  const tot = week[week.length - 1].n;
  const w = weights().slice(-6).map(x => `${x.day}: ${x.kg} kg`).join(', ');
  const line = (k: (typeof KEYS)[number]) => `${META[k].label} ${fmt(tot[idx(k)])}/${fmt(t.n[idx(k)])} ${META[k].unit}`;
  return [
    `Profile: ${p.sex}, ${p.age} y, ${p.heightCm} cm, ${p.weightKg} kg, goal=${p.goal}${p.goal !== 'maintain' ? ` ${p.rate} kg/week` : ''}${p.targetKg ? `, target ${p.targetKg} kg` : ''}, diet=${p.diet}, activity factor ${p.activity}.`,
    `Daily targets: ${fmt(t.n[0])} kcal, protein ${fmt(t.n[1])} g, carbs ${fmt(t.n[2])} g, fat ${fmt(t.n[3])} g, fiber ${fmt(t.n[4])} g, water ${t.waterMl} ml.`,
    `Today (${today()}, time ${new Date().toTimeString().slice(0, 5)}) eaten: ${todayLogs.map(l => `${l.meal}: ${l.name} ${Math.round(l.grams)} g`).join('; ') || 'nothing yet'}.`,
    `Today totals: ${KEYS.map(line).join(', ')}.`,
    `Last 7 days: ${logged.length} days logged; avg ${fmt(avg('kcal'))} kcal, protein ${fmt(avg('protein'))} g, fiber ${fmt(avg('fiber'))} g, iron ${fmt(avg('iron'))} mg, calcium ${fmt(avg('calcium'))} mg.`,
    `Recent weights: ${w || 'none'}.`,
  ].join('\n');
}

const COACH_SYSTEM = `You are "Caltrack Coach", a friendly, practical Indian nutrition and fitness coach inside a calorie-tracking app.
Prefer Indian home foods, Indian portion words (katori, roti, glass) and affordable options. Respect the user's diet type strictly.
Be concise: short paragraphs or bullets, real numbers (grams, kcal, protein). Reply in the user's language (Hindi, Hinglish or English).
You are not a doctor: for medical conditions, advise seeing one. User data:
`;

export async function chat(history: ChatMsg[]): Promise<string> {
  return gemini(history.map(m => ({ role: m.role, parts: [{ text: m.text }] })), { system: COACH_SYSTEM + coachContext() });
}

export const QUICK_PROMPTS = [
  { label: 'Plan the rest of my day', text: 'Based on what I have eaten so far, plan my remaining meals today to hit my calories, protein and fiber, and fix my lowest micronutrients. Give exact Indian dishes and portions.' },
  { label: 'Weekly review', text: 'Review my last 7 days: what went well, my 3 biggest nutrition gaps, and 3 specific changes for next week. Comment on my weight trend.' },
  { label: 'High-protein Indian ideas', text: 'Give me 8 high-protein Indian meal or snack ideas that fit my diet type and goal, with protein and kcal per portion.' },
  { label: 'Grocery list for the week', text: 'Make a weekly grocery list (Indian market) for my goal and diet, grouped by category with approximate quantities.' },
  { label: 'Is my plan realistic?', text: 'Is my calorie target and weight-change rate realistic and safe for me? Estimate when I could reach my target weight.' },
];
