import { useState } from 'react';
import { View, Pressable, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Screen, T, Card, Chip, Btn, Row, Field, Bar, tap, st } from '../../src/ui';
import { C, F } from '../../src/theme';
import { getFood, addLog, saveFood, MEALS, Meal, today, useDbVersion, getProfile, Serving } from '../../src/db';
import { servingsFor } from '../../src/search';
import { scale, fmt, idx, KEYS, META, computeTargets, NKey } from '../../src/nutrients';

const defaultMeal = (): Meal => { const h = new Date().getHours(); return h < 11 ? 'Breakfast' : h < 16 ? 'Lunch' : h < 19 ? 'Snacks' : 'Dinner'; };

export default function FoodScreen() {
  useDbVersion();
  const router = useRouter();
  const { id, meal: m0, day: d0 } = useLocalSearchParams<{ id: string; meal?: Meal; day?: string }>();
  const food = getFood(id);
  const servs = food ? servingsFor(food) : [];
  const [si, setSi] = useState(0);
  const [qty, setQty] = useState(servs[0]?.[1] === 1 ? 100 : 1);
  const [grams, setGrams] = useState('');
  const [meal, setMeal] = useState<Meal>(m0 ?? defaultMeal());
  const [newPortion, setNewPortion] = useState<{ label: string; g: string } | null>(null);
  const p = getProfile();
  if (!food || !p) return <Screen title="Food not found"><Btn title="Back" onPress={() => router.back()} /></Screen>;
  const t = computeTargets(p);

  const customG = parseFloat(grams);
  const totalG = grams ? (customG > 0 ? customG : 0) : servs[si][1] * qty;
  const n = scale(food.n, totalG);
  const label = grams ? `${Math.round(totalG)} g` : servs[si][0];
  const highlights = KEYS.filter(k => META[k].group === 'Minerals' || META[k].group === 'Vitamins')
    .map(k => ({ k, pct: n[idx(k)] / t.n[idx(k)] })).filter(x => x.pct >= 0.05).sort((a, b) => b.pct - a.pct).slice(0, 6);

  function log() {
    if (totalG <= 0) return;
    addLog(d0 ?? today(), meal, food!, totalG, grams ? `${Math.round(totalG)} g` : servs[si][0], grams ? 1 : qty);
    router.dismissTo('/');
  }
  function savePortion() {
    const g = parseFloat(newPortion?.g ?? '');
    const l = newPortion?.label.trim();
    if (!l || !(g > 0)) return Alert.alert('Portion needs a name and grams', 'e.g. "1 big katori" = 200 g');
    const serv: Serving[] = [[l.match(/^\d/) ? l : `1 ${l}`, Math.round(g)], ...food!.serv];
    saveFood({ ...food!, serv });
    setSi(0); setQty(1); setGrams(''); setNewPortion(null);
  }

  return (
    <Screen kicker={food.custom ? 'Your food' : food.src === 'INDB' ? 'Indian recipe · INDB' : food.src === 'IFCT' ? 'Raw ingredient · IFCT 2017' : food.src} title={food.name}
      right={<Pressable accessibilityLabel="Close" hitSlop={10} onPress={() => router.back()} style={{ padding: 6 }}><Feather name="x" size={24} color={C.ink} /></Pressable>}>
      {food.alt ? <T v="small" style={{ marginTop: -10, marginBottom: 14 }} numberOfLines={2}>Also: {food.alt}</T> : null}

      <Card>
        <T v="label" style={{ marginBottom: 8 }}>Portion</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {servs.map((s, i) => <Chip key={s[0] + i} label={`${s[0]}${s[1] !== 1 ? ` · ${s[1]} g` : ''}`} on={!grams && i === si} onPress={() => { setSi(i); setGrams(''); setQty(s[1] === 1 ? 100 : 1); }} />)}
        </View>
        {!grams && (
          <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
            <T v="body">How many?</T>
            <Row style={{ gap: 6 }}>
              <Step icon="minus" label="Less" onPress={() => setQty(q => Math.max(servs[si][1] === 1 ? 5 : 0.25, q - (servs[si][1] === 1 ? 10 : q > 1 ? 0.5 : 0.25)))} />
              <T v="num" style={{ minWidth: 56, textAlign: 'center' }}>{+qty.toFixed(2)}</T>
              <Step icon="plus" label="More" onPress={() => setQty(q => q + (servs[si][1] === 1 ? 10 : q >= 1 ? 0.5 : 0.25))} />
            </Row>
          </Row>
        )}
        <View style={st.hr} />
        <Field label="Or exact grams" value={grams} onChangeText={setGrams} keyboardType="decimal-pad" placeholder={`${Math.round(totalG)} g`} />
        {newPortion ? (
          <View>
            <Row style={{ gap: 8 }}>
              <View style={{ flex: 2 }}><Field label="Portion name" value={newPortion.label} onChangeText={l => setNewPortion({ ...newPortion, label: l })} placeholder="big katori" /></View>
              <View style={{ flex: 1 }}><Field label="Grams" value={newPortion.g} onChangeText={g => setNewPortion({ ...newPortion, g })} keyboardType="decimal-pad" placeholder="200" /></View>
            </Row>
            <Row style={{ gap: 8 }}><Btn small kind="ghost" title="Cancel" onPress={() => setNewPortion(null)} /><Btn small title="Save portion" onPress={savePortion} /></Row>
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setNewPortion({ label: '', g: grams })}><T v="small" style={{ color: C.indigo, fontFamily: F.bold }}>+ Save a portion size of your own (remembered next time)</T></Pressable>
        )}
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View><T v="label">{label} · {Math.round(totalG)} g</T><T v="display">{fmt(n[0])}<T v="small"> kcal</T></T></View>
          <T v="small">{Math.round((n[0] / t.n[0]) * 100)}% of your day</T>
        </Row>
        <Row style={{ marginTop: 12, gap: 10 }}>
          {(['protein', 'carbs', 'fat', 'fiber'] as NKey[]).map((k, i) => (
            <View key={k} style={{ flex: 1 }}>
              <T v="label">{META[k].label.slice(0, 7)}</T>
              <T v="num">{fmt(n[idx(k)])}<T v="small"> g</T></T>
              <View style={{ marginTop: 4 }}><Bar pct={n[idx(k)] / t.n[idx(k)]} color={[C.leaf, C.turmeric, C.chili, C.plum][i]} height={4} /></View>
            </View>
          ))}
        </Row>
        {highlights.length > 0 && <>
          <View style={st.hr} />
          <T v="label" style={{ marginBottom: 6 }}>Good source of</T>
          <T v="small">{highlights.map(h => `${META[h.k].label} ${Math.round(h.pct * 100)}%`).join(' · ')}</T>
        </>}
        <View style={st.hr} />
        <T v="small">Sugar {fmt(n[idx('sugar')])} g · Sat. fat {fmt(n[idx('satfat')])} g · Sodium {fmt(n[idx('sodium')])} mg</T>
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
        {MEALS.map(x => <Chip key={x} label={x} on={x === meal} onPress={() => setMeal(x)} />)}
      </View>
      <Btn title={`Add to ${meal}`} onPress={log} disabled={totalG <= 0} />
      <Btn title="Fix nutrition values" kind="ghost" style={{ marginTop: 10 }} onPress={() => { tap(); router.push({ pathname: '/custom-food', params: { id: food.id } }); }} />
      <T v="small" style={{ marginTop: 14, textAlign: 'center' }}>Values per 100 g: {fmt(food.n[0])} kcal · P {fmt(food.n[1])} · C {fmt(food.n[2])} · F {fmt(food.n[3])}</T>
    </Screen>
  );
}

function Step({ icon, label, onPress }: { icon: 'plus' | 'minus'; label: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={label} onPress={() => { tap(); onPress(); }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.track, alignItems: 'center', justifyContent: 'center' }}><Feather name={icon} size={18} color={C.ink} /></Pressable>;
}
