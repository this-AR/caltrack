// Run: npx tsx tools/selftest.ts   (pure logic only, no React Native)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeTargets, DEFAULT_PROFILE, idx, KEYS } from '../src/nutrients';
import { norm, searchFoods, parseMeal } from '../src/search';
import { cleanFood, vec, okProfile } from '../src/validate';

const data = JSON.parse(readFileSync(new URL('../assets/foods.json', import.meta.url), 'utf8'));
assert.deepEqual(data.nutrients, [...KEYS], 'foods.json nutrient order must match src/nutrients.ts');
const foods = data.foods.map((f: any) => ({ ...f, custom: 0, uses: 0, norm: norm(f.name + ' ' + f.alt) }));

// targets: 70 kg, 170 cm, 25 y male, light activity → BMR 1642.5, TDEE ≈ 2258
const t = computeTargets(DEFAULT_PROFILE);
assert.equal(Math.round(t.bmr), 1643);
assert.ok(Math.abs(t.n[0] - 2258) < 2, 'maintain kcal');
const lose = computeTargets({ ...DEFAULT_PROFILE, goal: 'lose', rate: 0.5 });
assert.equal(Math.round(t.n[0] - lose.n[0]), 550, '0.5 kg/week = 550 kcal deficit');
assert.ok(Math.abs(lose.n[idx('protein')] - 126) < 0.01, '1.8 g/kg protein when cutting');
const macroKcal = lose.n[1] * 4 + lose.n[2] * 4 + lose.n[3] * 9;
assert.ok(Math.abs(macroKcal - lose.n[0]) < 1, 'macros add up to kcal');
assert.ok(computeTargets({ ...DEFAULT_PROFILE, sex: 'female', weightKg: 45, heightCm: 150, goal: 'lose', rate: 1 }).n[0] >= 1200, 'kcal floor');

// Hinglish normalisation
assert.equal(norm('Rajmah'), norm('rajma'));
assert.equal(norm('Chaawal'), norm('chawal'));

// search: the obvious food comes first
const top = (q: string) => searchFoods(foods, q, 3).map((f: any) => f.name);
const expect = (q: string, re: RegExp) => assert.ok(re.test(top(q)[0] ?? ''), `"${q}" → ${JSON.stringify(top(q))}`);
expect('rajma', /rajma.*curry|curry.*rajma/i);
expect('rajma raw', /raw/i);
assert.ok(!top('rajma').slice(0, 2).some((n: string) => /raw/i.test(n)), 'cooked rajma dishes before raw');
expect('roti', /chapati|roti/i);
expect('chawal', /rice|chawal/i);
expect('paneer', /paneer/i);
expect('rice', /^rice/i);
expect('egg', /^egg/i);
expect('chole', /chole|chickpea/i);
expect('milk', /^milk/i);
expect('राजमा', /rajma/i);

// parser
const p = parseMeal(foods, '2 roti, 1 katori rajma aur 200g paneer');
assert.equal(p.length, 3);
assert.equal(p[0].qty, 2); assert.match(p[0].food!.name, /chapati|roti/i);
assert.deepEqual(p[1].unit, ['1 katori', 150]); assert.match(p[1].food!.name, /rajma/i);
assert.equal(p[2].qty, 200); assert.equal(p[2].unit?.[1], 1); assert.match(p[2].food!.name, /paneer/i);

// import validation (backup restore / shared foods files)
const N = JSON.stringify(Array(30).fill(1));
assert.ok(cleanFood({ id: 'user:1', name: 'X', serv: '[["1 bowl",150]]', n: N }));
assert.equal(cleanFood({ id: 'user:1', name: 'X', serv: '[["1 bowl",150]]', n: 'null' }), null);
assert.equal(cleanFood({ id: 'user:1', name: 'X', serv: '[["1 bowl",150]]', n: '[1,-5]' }), null);
assert.equal(cleanFood({ id: 'user:1', name: 'X', serv: '[["1 bowl",0]]', n: N }), null);
assert.equal(cleanFood({ id: 7, name: 'X', serv: '[]', n: N }), null);
assert.equal(cleanFood({ id: 'a', name: 'X', serv: '[]', n: N, custom: 0 })!.custom, 1); // can't pose as built-in
assert.ok(!vec('[1,"2"]') && !vec('{}') && vec('[0,1.5]'));
assert.ok(okProfile('{"age":30,"heightCm":170,"weightKg":70}') && !okProfile('{"age":"x"}') && !okProfile('nope'));

console.log('selftest OK:', foods.length, 'foods; rajma →', top('rajma')[0], '; dal →', top('dal').join(' | '));
