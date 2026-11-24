// Order MUST match tools/build_foods.py NUTRIENTS. Values are per 100 g.
export const KEYS = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'satfat', 'chol', 'calcium', 'phosphorus',
  'magnesium', 'sodium', 'potassium', 'iron', 'zinc', 'copper', 'manganese', 'selenium', 'vitA', 'vitE',
  'vitD', 'vitK', 'b1', 'b2', 'b3', 'b5', 'b6', 'b7', 'folate', 'vitC'] as const;
export type NKey = typeof KEYS[number];
export type NVec = number[]; // indexed like KEYS
export const idx = (k: NKey) => KEYS.indexOf(k);

export type Group = 'Energy' | 'Macros' | 'Limits' | 'Minerals' | 'Vitamins';
export const META: Record<NKey, { label: string; unit: string; group: Group; limit?: boolean }> = {
  kcal: { label: 'Energy', unit: 'kcal', group: 'Energy' },
  protein: { label: 'Protein', unit: 'g', group: 'Macros' },
  carbs: { label: 'Carbohydrates', unit: 'g', group: 'Macros' },
  fat: { label: 'Fat', unit: 'g', group: 'Macros' },
  fiber: { label: 'Fiber', unit: 'g', group: 'Macros' },
  sugar: { label: 'Sugar', unit: 'g', group: 'Limits', limit: true },
  satfat: { label: 'Saturated fat', unit: 'g', group: 'Limits', limit: true },
  chol: { label: 'Cholesterol', unit: 'mg', group: 'Limits', limit: true },
  sodium: { label: 'Sodium', unit: 'mg', group: 'Limits', limit: true },
  calcium: { label: 'Calcium', unit: 'mg', group: 'Minerals' },
  phosphorus: { label: 'Phosphorus', unit: 'mg', group: 'Minerals' },
  magnesium: { label: 'Magnesium', unit: 'mg', group: 'Minerals' },
  potassium: { label: 'Potassium', unit: 'mg', group: 'Minerals' },
  iron: { label: 'Iron', unit: 'mg', group: 'Minerals' },
  zinc: { label: 'Zinc', unit: 'mg', group: 'Minerals' },
  copper: { label: 'Copper', unit: 'mg', group: 'Minerals' },
  manganese: { label: 'Manganese', unit: 'mg', group: 'Minerals' },
  selenium: { label: 'Selenium', unit: 'µg', group: 'Minerals' },
  vitA: { label: 'Vitamin A', unit: 'µg', group: 'Vitamins' },
  vitC: { label: 'Vitamin C', unit: 'mg', group: 'Vitamins' },
  vitD: { label: 'Vitamin D', unit: 'µg', group: 'Vitamins' },
  vitE: { label: 'Vitamin E', unit: 'mg', group: 'Vitamins' },
  vitK: { label: 'Vitamin K', unit: 'µg', group: 'Vitamins' },
  b1: { label: 'B1 Thiamine', unit: 'mg', group: 'Vitamins' },
  b2: { label: 'B2 Riboflavin', unit: 'mg', group: 'Vitamins' },
  b3: { label: 'B3 Niacin', unit: 'mg', group: 'Vitamins' },
  b5: { label: 'B5 Pantothenic', unit: 'mg', group: 'Vitamins' },
  b6: { label: 'B6', unit: 'mg', group: 'Vitamins' },
  b7: { label: 'B7 Biotin', unit: 'µg', group: 'Vitamins' },
  folate: { label: 'B9 Folate', unit: 'µg', group: 'Vitamins' },
};

export const zero = (): NVec => KEYS.map(() => 0);
export const scale = (n: NVec, grams: number): NVec => n.map(v => (v * grams) / 100);
export const add = (a: NVec, b: NVec): NVec => a.map((v, i) => v + (b[i] || 0));

export function fmt(v: number, unit = ''): string {
  if (!v || Math.abs(v) < 0.005) return unit ? `0 ${unit}` : '0';
  const s = v >= 100 ? Math.round(v).toString() : v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2);
  return unit ? `${s} ${unit}` : s;
}

// ---------- Profile & targets ----------
export type Goal = 'lose' | 'maintain' | 'gain';
export type Diet = 'veg' | 'egg' | 'nonveg' | 'vegan';
export type Profile = {
  name: string; sex: 'male' | 'female'; age: number; heightCm: number; weightKg: number;
  activity: number; goal: Goal; rate: number; diet: Diet; targetKg?: number;
};
export const ACTIVITY = [
  { v: 1.2, label: 'Sedentary', hint: 'Desk job, little exercise' },
  { v: 1.375, label: 'Light', hint: 'Exercise 1–3 days/week' },
  { v: 1.55, label: 'Moderate', hint: 'Exercise 3–5 days/week' },
  { v: 1.725, label: 'Active', hint: 'Hard exercise 6–7 days/week' },
  { v: 1.9, label: 'Athlete', hint: 'Physical job + training' },
];

// Micronutrient RDAs, approx. ICMR-NIN 2020 (adult, moderate activity). [male, female]
const RDA: Partial<Record<NKey, [number, number]>> = {
  calcium: [1000, 1000], phosphorus: [1000, 1000], magnesium: [440, 370], potassium: [3500, 3500],
  iron: [19, 29], zinc: [17, 13.2], copper: [2, 1.7], manganese: [4, 4], selenium: [40, 40],
  vitA: [1000, 840], vitC: [80, 65], vitD: [15, 15], vitE: [10, 7.5], vitK: [55, 55],
  b1: [1.4, 1.4], b2: [2.0, 1.9], b3: [14, 11], b5: [5, 5], b6: [1.9, 1.9], b7: [40, 40], folate: [300, 220],
};

export type Targets = { n: NVec; bmr: number; tdee: number; waterMl: number };

export function computeTargets(p: Profile): Targets {
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161); // Mifflin-St Jeor
  const tdee = bmr * p.activity;
  const delta = (p.rate * 7700) / 7; // 7700 kcal ≈ 1 kg body fat
  let kcal = p.goal === 'lose' ? tdee - delta : p.goal === 'gain' ? tdee + delta : tdee;
  kcal = Math.max(kcal, p.sex === 'male' ? 1500 : 1200);
  const proteinPerKg = p.goal === 'maintain' ? 1.2 : 1.8;
  const protein = proteinPerKg * p.weightKg;
  const fat = (kcal * (p.goal === 'lose' ? 0.25 : 0.27)) / 9;
  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);
  const n = zero();
  const set = (k: NKey, v: number) => (n[idx(k)] = v);
  set('kcal', kcal); set('protein', protein); set('fat', fat); set('carbs', carbs);
  set('fiber', Math.max(25, (kcal / 1000) * 14));
  set('sugar', (kcal * 0.1) / 4); set('satfat', (kcal * 0.1) / 9); set('chol', 300); set('sodium', 2000);
  const s = p.sex === 'male' ? 0 : 1;
  for (const [k, v] of Object.entries(RDA)) set(k as NKey, v![s]);
  const waterMl = Math.round((p.weightKg * 35 + (p.activity >= 1.55 ? 500 : 0)) / 50) * 50;
  return { n, bmr, tdee, waterMl };
}

export const DEFAULT_PROFILE: Profile = {
  name: '', sex: 'male', age: 25, heightCm: 170, weightKg: 70, activity: 1.375, goal: 'maintain', rate: 0.5, diet: 'veg',
};
