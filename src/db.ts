import * as SQLite from 'expo-sqlite';
import { useSyncExternalStore } from 'react';
import { NVec, zero, add, scale, Profile, DEFAULT_PROFILE, KEYS } from './nutrients';
import { norm } from './search';
import { vec, okProfile, cleanFood } from './validate';

export type Serving = [label: string, grams: number];
export type Food = {
  id: string; name: string; alt: string; src: string; grp: string; serv: Serving[]; n: NVec;
  custom: number; uses: number; norm: string;
};
export type Meal = 'Breakfast' | 'Lunch' | 'Snacks' | 'Dinner';
export const MEALS: Meal[] = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];
export type LogRow = { id: number; day: string; meal: Meal; food_id: string; name: string; grams: number; label: string; qty: number; n: NVec; ts: number };

const DATA_VERSION = '2'; // bump whenever assets/foods.json changes
const db = SQLite.openDatabaseSync('caltrack.db');

// ---------- tiny change-notification so screens re-read after writes ----------
let version = 0;
const subs = new Set<() => void>();
const bump = () => { version++; subs.forEach(f => f()); };
export const useDbVersion = () =>
  useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, () => version);

// ---------- schema + seed ----------
let foodCache: Food[] = [];
export function initDb() {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS foods (id TEXT PRIMARY KEY, name TEXT, alt TEXT, src TEXT, grp TEXT, serv TEXT, n TEXT, custom INTEGER DEFAULT 0, uses INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT, meal TEXT, food_id TEXT, name TEXT, grams REAL, label TEXT, qty REAL, n TEXT, ts INTEGER);
    CREATE INDEX IF NOT EXISTS logs_day ON logs(day);
    CREATE TABLE IF NOT EXISTS water (day TEXT PRIMARY KEY, ml INTEGER);
    CREATE TABLE IF NOT EXISTS weights (day TEXT PRIMARY KEY, kg REAL);
    CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
  `);
  if (getKv('data_version') !== DATA_VERSION) {
    const data = require('../assets/foods.json') as { foods: Omit<Food, 'custom' | 'uses' | 'norm'>[] };
    // Refresh built-in rows on a data-version bump, but never touch foods the user created or edited (custom > 0).
    db.withTransactionSync(() => {
      const st = db.prepareSync(`INSERT INTO foods (id,name,alt,src,grp,serv,n) VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, alt=excluded.alt, src=excluded.src, grp=excluded.grp, serv=excluded.serv, n=excluded.n WHERE foods.custom = 0`);
      try { for (const f of data.foods) st.executeSync([f.id, f.name, f.alt, f.src, f.grp, JSON.stringify(f.serv), JSON.stringify(f.n)]); }
      finally { st.finalizeSync(); }
    });
    setKv('data_version', DATA_VERSION);
  }
  loadFoods();
}

function loadFoods() {
  foodCache = db.getAllSync<any>('SELECT * FROM foods').flatMap(r => {
    try { // one bad row (e.g. from an imported file) must not stop the app from opening
      const n: NVec = JSON.parse(r.n).map((x: any) => Number(x) || 0);
      while (n.length < KEYS.length) n.push(0);
      return [{ ...r, serv: JSON.parse(r.serv), n, norm: norm(r.name + ' ' + (r.alt || '')) }];
    } catch { return []; }
  });
}
export const allFoods = () => foodCache;
export const getFood = (id: string) => foodCache.find(f => f.id === id);

export function saveFood(f: { id?: string; name: string; alt?: string; serv: Serving[]; n: NVec; grp?: string; src?: string }) {
  const id = f.id ?? `user:${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const old = getFood(id);
  db.runSync('INSERT OR REPLACE INTO foods (id,name,alt,src,grp,serv,n,custom,uses) VALUES (?,?,?,?,?,?,?,?,?)',
    [id, f.name, f.alt ?? '', f.src ?? old?.src ?? 'You', f.grp ?? old?.grp ?? 'My foods', JSON.stringify(f.serv),
      JSON.stringify(f.n), old ? old.custom || (id.startsWith('user:') ? 1 : 2) : 1, old?.uses ?? 0]);
  loadFoods(); bump();
  return id;
}
export function deleteFood(id: string) { db.runSync('DELETE FROM foods WHERE id=?', [id]); loadFoods(); bump(); }

// ---------- logs ----------
export const today = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
export const shiftDay = (day: string, by: number) => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + by); return today(d); };

export function addLog(day: string, meal: Meal, food: Food, grams: number, label: string, qty: number) {
  db.runSync('INSERT INTO logs (day,meal,food_id,name,grams,label,qty,n,ts) VALUES (?,?,?,?,?,?,?,?,?)',
    [day, meal, food.id, food.name, grams, label, qty, JSON.stringify(scale(food.n, grams)), Date.now()]);
  db.runSync('UPDATE foods SET uses = uses + 1 WHERE id=?', [food.id]);
  const f = getFood(food.id); if (f) f.uses++;
  bump();
}
export function deleteLog(id: number) { db.runSync('DELETE FROM logs WHERE id=?', [id]); bump(); }
export function getLogs(day: string): LogRow[] {
  return db.getAllSync<any>('SELECT * FROM logs WHERE day=? ORDER BY ts', [day]).map(r => ({ ...r, n: JSON.parse(r.n) }));
}
export const totalOf = (rows: LogRow[]) => rows.reduce((a, r) => add(a, r.n), zero());

/** Per-day totals for the last `days` days (oldest first), including empty days. */
export function dailyTotals(days: number, end = today()) {
  const start = shiftDay(end, -(days - 1));
  const rows = db.getAllSync<any>('SELECT day, n FROM logs WHERE day BETWEEN ? AND ?', [start, end]);
  const map = new Map<string, NVec>();
  for (const r of rows) map.set(r.day, add(map.get(r.day) ?? zero(), JSON.parse(r.n)));
  return Array.from({ length: days }, (_, i) => { const d = shiftDay(start, i); return { day: d, n: map.get(d) ?? zero(), logged: map.has(d) }; });
}
export function recentFoods(limit = 12): Food[] {
  const ids = db.getAllSync<{ food_id: string }>('SELECT food_id, MAX(ts) t FROM logs GROUP BY food_id ORDER BY t DESC LIMIT ?', [limit]);
  return ids.map(r => getFood(r.food_id)).filter(Boolean) as Food[];
}
/** Copy one meal from a previous day into a target day. */
export function copyMeal(fromDay: string, meal: Meal, toDay: string) {
  for (const r of getLogs(fromDay).filter(r => r.meal === meal))
    db.runSync('INSERT INTO logs (day,meal,food_id,name,grams,label,qty,n,ts) VALUES (?,?,?,?,?,?,?,?,?)',
      [toDay, meal, r.food_id, r.name, r.grams, r.label, r.qty, JSON.stringify(r.n), Date.now()]);
  bump();
}

// ---------- water & weight ----------
export const getWater = (day: string) => db.getFirstSync<{ ml: number }>('SELECT ml FROM water WHERE day=?', [day])?.ml ?? 0;
export function addWater(day: string, ml: number) {
  db.runSync('INSERT INTO water (day,ml) VALUES (?,?) ON CONFLICT(day) DO UPDATE SET ml=MAX(0, ml+excluded.ml)', [day, ml]); bump();
}
export const waterHistory = (days: number) => {
  const start = shiftDay(today(), -(days - 1));
  const m = new Map(db.getAllSync<{ day: string; ml: number }>('SELECT * FROM water WHERE day>=?', [start]).map(r => [r.day, r.ml]));
  return Array.from({ length: days }, (_, i) => { const d = shiftDay(start, i); return { day: d, ml: m.get(d) ?? 0 }; });
};
export function setWeight(day: string, kg: number) {
  db.runSync('INSERT OR REPLACE INTO weights (day,kg) VALUES (?,?)', [day, kg]);
  const p = getProfile(); if (p && day >= (latestWeight()?.day ?? '')) setProfile({ ...p, weightKg: kg });
  bump();
}
export const weights = () => db.getAllSync<{ day: string; kg: number }>('SELECT * FROM weights ORDER BY day');
export const latestWeight = () => db.getFirstSync<{ day: string; kg: number }>('SELECT * FROM weights ORDER BY day DESC LIMIT 1');
export function deleteWeight(day: string) { db.runSync('DELETE FROM weights WHERE day=?', [day]); bump(); }

// ---------- key/value: profile, settings ----------
export const getKv = (k: string) => db.getFirstSync<{ v: string }>('SELECT v FROM kv WHERE k=?', [k])?.v ?? null;
export function setKv(k: string, v: string | null) {
  if (v === null) db.runSync('DELETE FROM kv WHERE k=?', [k]); else db.runSync('INSERT OR REPLACE INTO kv (k,v) VALUES (?,?)', [k, v]);
  bump();
}
export const getJson = <T,>(k: string, d: T): T => { const v = getKv(k); try { return v ? JSON.parse(v) : d; } catch { return d; } };
export const setJson = (k: string, v: unknown) => setKv(k, JSON.stringify(v));
export const getProfile = (): Profile | null => { const p = getJson<Profile | null>('profile', null); return p ? { ...DEFAULT_PROFILE, ...p } : null; };
export const setProfile = (p: Profile) => setJson('profile', p);

// ---------- backup ----------
export function exportAll() {
  return {
    app: 'caltrack', v: 1, at: new Date().toISOString(),
    logs: db.getAllSync('SELECT * FROM logs'), water: db.getAllSync('SELECT * FROM water'),
    weights: db.getAllSync('SELECT * FROM weights'),
    foods: db.getAllSync('SELECT * FROM foods WHERE custom > 0'),
    kv: db.getAllSync<any>('SELECT * FROM kv').filter(r => r.k !== 'gemini_key'), // never put the API key in a shareable file
  };
}
const KV_IMPORT = ['profile', 'theme', 'chat', 'gemini_model', 'reminders'];
export function importAll(data: any, onlyFoods = false) {
  if (data?.app !== 'caltrack' && data?.app !== 'thali') throw new Error('Not a Caltrack backup file'); // 'thali' = files from the earlier build
  const foods = (Array.isArray(data.foods) ? data.foods : []).map(cleanFood).filter(Boolean) as any[];
  const logs = (Array.isArray(data.logs) ? data.logs : []).filter((r: any) => /^\d{4}-\d\d-\d\d$/.test(r?.day) && MEALS.includes(r.meal) && vec(r.n) && Number(r.grams) >= 0);
  db.withTransactionSync(() => {
    for (const f of foods) {
      // a shared foods file adds foods; it never replaces ones you already have (built-in or your own)
      if (onlyFoods && getFood(f.id)) continue;
      db.runSync('INSERT OR REPLACE INTO foods (id,name,alt,src,grp,serv,n,custom,uses) VALUES (?,?,?,?,?,?,?,?,?)',
        [f.id, f.name, f.alt, f.src, f.grp, f.serv, f.n, onlyFoods ? 1 : f.custom, onlyFoods ? 0 : f.uses]);
    }
    if (onlyFoods) return;
    db.runSync('DELETE FROM logs');
    for (const r of logs)
      db.runSync('INSERT INTO logs (day,meal,food_id,name,grams,label,qty,n,ts) VALUES (?,?,?,?,?,?,?,?,?)',
        [r.day, r.meal, String(r.food_id ?? ''), String(r.name ?? '').slice(0, 200), Number(r.grams), String(r.label ?? ''), Number(r.qty) || 1, r.n, Number(r.ts) || Date.now()]);
    const day = (d: any) => /^\d{4}-\d\d-\d\d$/.test(d);
    for (const r of data.water ?? []) if (day(r?.day) && Number(r.ml) >= 0 && Number(r.ml) < 20000) db.runSync('INSERT OR REPLACE INTO water (day,ml) VALUES (?,?)', [r.day, Number(r.ml)]);
    for (const r of data.weights ?? []) if (day(r?.day) && Number(r.kg) >= 20 && Number(r.kg) <= 350) db.runSync('INSERT OR REPLACE INTO weights (day,kg) VALUES (?,?)', [r.day, Number(r.kg)]);
    // only known settings; never a gemini_key from a file (it could route your AI calls through someone else's key)
    for (const r of data.kv ?? []) if (KV_IMPORT.includes(r?.k) && typeof r.v === 'string' && (r.k !== 'profile' || okProfile(r.v))) db.runSync('INSERT OR REPLACE INTO kv (k,v) VALUES (?,?)', [r.k, r.v]);
  });
  loadFoods(); bump();
}
