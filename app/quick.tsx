import { useEffect, useState } from 'react';
import { View, Pressable, Alert, Image, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Screen, T, Card, Btn, Row, Chip, Field } from '../src/ui';
import { C, F } from '../src/theme';
import { allFoods, addLog, saveFood, MEALS, Meal, today, Food, getFood } from '../src/db';
import { parseMeal, searchFoods } from '../src/search';
import { idx, fmt, zero } from '../src/nutrients';
import { hasAi, mealFromInput } from '../src/ai';
import { pending } from '../src/pending';

type Item = { key: string; text: string; grams: number; label: string; food?: Food; ai?: { kcal: number; protein: number; carbs: number; fat: number; fiber: number } };
const defaultMeal = (): Meal => { const h = new Date().getHours(); return h < 11 ? 'Breakfast' : h < 16 ? 'Lunch' : h < 19 ? 'Snacks' : 'Dinner'; };

export default function Quick() {
  const router = useRouter();
  const p = useLocalSearchParams<{ text?: string; meal?: Meal; day?: string; photo?: string }>();
  const [meal, setMeal] = useState<Meal>(p.meal ?? defaultMeal());
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [photo] = useState(p.photo ? pending.image : undefined);
  const [fixing, setFixing] = useState<string | null>(null);
  const [fixQ, setFixQ] = useState('');

  useEffect(() => {
    if (photo) runAi();
    else if (p.text) {
      setItems(parseMeal(allFoods(), p.text).map((x, i) => {
        if (x.unit?.[1] === 1) return { key: String(i), text: x.text, food: x.food, grams: x.qty, label: `${x.qty} g` };
        const s = x.unit ?? x.food?.serv[0] ?? ['100 g', 100];
        return { key: String(i), text: x.text, food: x.food, grams: Math.round(s[1] * x.qty), label: `${x.qty} × ${s[0].replace(/^1 /, '')}` };
      }));
    }
    return () => { pending.image = undefined; };
  }, []);

  async function runAi() {
    if (!hasAi()) return Alert.alert('Add a Gemini key', 'Profile → AI features');
    setBusy(true);
    try {
      const out = await mealFromInput({ text: p.text, imageBase64: photo?.base64, mime: photo?.mime });
      if (!out.length) Alert.alert('No food found', 'Try a clearer photo or describe the meal in words.');
      setItems(out.map((x, i) => ({ key: 'ai' + i, text: x.name, grams: x.grams, label: x.portion || `${x.grams} g`, food: x.match, ai: scaleAi(x, 100 / x.grams) })));  // ai values kept per 100 g so editing grams never loses them
    } catch (e: any) { Alert.alert('AI error', e.message); }
    finally { setBusy(false); }
  }

  const kcalOf = (it: Item) => it.food ? (it.food.n[0] * it.grams) / 100 : (it.ai?.kcal ?? 0) * it.grams / 100;
  const total = items.reduce((a, it) => a + kcalOf(it), 0);

  function logAll() {
    const day = p.day ?? today();
    for (const it of items) {
      let food = it.food;
      if (!food && it.ai && it.grams > 0) {
        // unknown to the DB: save the AI estimate as your own food so next time it's searchable
        const n = zero(); const per = 1;
        n[idx('kcal')] = it.ai.kcal * per; n[idx('protein')] = it.ai.protein * per; n[idx('carbs')] = it.ai.carbs * per; n[idx('fat')] = it.ai.fat * per; n[idx('fiber')] = it.ai.fiber * per;
        food = getFood(saveFood({ name: it.text, serv: [[`1 ${it.label.replace(/^1 /, '')}`, it.grams]], n, src: 'AI estimate' }));
      }
      if (food && it.grams > 0) addLog(day, meal, food, it.grams, it.label, 1);
    }
    router.dismissTo('/');
  }

  const update = (key: string, patch: Partial<Item>) => setItems(items.map(i => (i.key === key ? { ...i, ...patch } : i)));

  return (
    <Screen kicker={photo ? 'From your photo' : 'From your words'} title="Check & log"
      right={<Pressable accessibilityLabel="Close" hitSlop={10} onPress={() => router.back()} style={{ padding: 6 }}><Feather name="x" size={24} color={C.ink} /></Pressable>}>
      {photo && <Image source={{ uri: `data:${photo.mime};base64,${photo.base64}` }} style={{ width: '100%', height: 200, borderRadius: 16, marginBottom: 12 }} accessibilityLabel="Your meal photo" />}
      {p.text ? <T v="small" style={{ marginBottom: 12 }}>“{p.text}”</T> : null}
      {busy && <Row style={{ marginBottom: 12 }}><ActivityIndicator color={C.ink} /><T v="small" style={{ marginLeft: 10 }}>Gemini is looking at your meal…</T></Row>}

      {items.map(it => (
        <Card key={it.key}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <T v="label">{it.text}</T>
              <T v="h2" style={{ marginTop: 2, color: it.food || it.ai ? C.ink : C.chili }} numberOfLines={2}>{it.food?.name ?? (it.ai ? `${it.text} (AI estimate)` : 'No match found')}</T>
            </View>
            <Pressable accessibilityLabel={`Remove ${it.text}`} hitSlop={8} onPress={() => setItems(items.filter(i => i.key !== it.key))}><Feather name="trash-2" size={18} color={C.ink3} /></Pressable>
          </Row>
          <Row style={{ marginTop: 10, gap: 10 }}>
            <View style={{ flex: 1 }}><Field label="Grams" keyboardType="decimal-pad" value={String(it.grams)} onChangeText={g => update(it.key, { grams: parseFloat(g) || 0, label: `${parseFloat(g) || 0} g`})} /></View>
            <View style={{ flex: 1, paddingTop: 22 }}><T v="num">{fmt(kcalOf(it))} <T v="small">kcal · {it.label}</T></T></View>
          </Row>
          {fixing === it.key ? (
            <View>
              <Field label="Search the right food" value={fixQ} onChangeText={setFixQ} autoFocus placeholder="e.g. rajma" />
              {searchFoods(allFoods(), fixQ, 5).map(f => (
                <Pressable key={f.id} onPress={() => { update(it.key, { food: f }); setFixing(null); setFixQ(''); }} style={{ paddingVertical: 8 }} accessibilityRole="button">
                  <T v="body">{f.name}</T>
                </Pressable>
              ))}
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => { setFixing(it.key); setFixQ(it.text.split(' ').slice(-2).join(' ')); }}><T v="small" style={{ color: C.indigo, fontFamily: F.bold }}>{it.food ? 'Wrong food? Change match' : 'Pick the food from the database'}</T></Pressable>
          )}
        </Card>
      ))}

      {!busy && !photo && hasAi() && <Btn kind="soft" title="✦ Re-read with AI" onPress={runAi} style={{ marginBottom: 12 }} />}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{MEALS.map(m => <Chip key={m} label={m} on={m === meal} onPress={() => setMeal(m)} />)}</View>
      <Btn title={`Log ${items.length} item${items.length === 1 ? '' : 's'} · ${fmt(total)} kcal`} disabled={!items.some(i => (i.food || i.ai) && i.grams > 0) || busy} onPress={logAll} />
      <T v="small" style={{ marginTop: 12 }}>Tip: name portions in words, like “2 roti”, “1 katori dal”, “200g paneer” or “1 glass milk”.</T>
    </Screen>
  );
}

const scaleAi = (a: NonNullable<Item['ai']>, f: number) => ({ kcal: a.kcal * f, protein: a.protein * f, carbs: a.carbs * f, fat: a.fat * f, fiber: a.fiber * f });
