// Checks for data coming from files (backup restore, shared foods). Pure, so tools/selftest.ts can test it.
import { KEYS } from './nutrients';

/** A nutrient vector stored as JSON text: array of finite, non-negative numbers. */
export const vec = (t: any) => { try { const a = JSON.parse(t); return Array.isArray(a) && a.length <= KEYS.length && a.every(x => typeof x === 'number' && isFinite(x) && x >= 0 && x < 1e6); } catch { return false; } };
export const okProfile = (t: string) => { try { const p = JSON.parse(t); return [p.age, p.heightCm, p.weightKg].every(x => typeof x === 'number' && x > 0 && x < 400); } catch { return false; } };
export function cleanFood(f: any) {
  if (typeof f?.id !== 'string' || typeof f.name !== 'string' || !f.name.trim() || !vec(f.n)) return null;
  let serv: any;
  try { serv = JSON.parse(f.serv); } catch { return null; }
  if (!Array.isArray(serv) || !serv.every(s => Array.isArray(s) && typeof s[0] === 'string' && typeof s[1] === 'number' && s[1] > 0 && s[1] <= 5000)) return null;
  return { id: f.id.slice(0, 80), name: f.name.slice(0, 120), alt: String(f.alt ?? '').slice(0, 200), src: String(f.src ?? 'Shared').slice(0, 40), grp: String(f.grp ?? 'My foods').slice(0, 40),
    serv: f.serv, n: f.n, custom: f.custom === 2 ? 2 : 1, uses: Math.max(0, Number(f.uses) || 0) };
}
