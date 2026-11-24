import { useState } from 'react';
import { View, Pressable, Alert, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Screen, T, Card, Ring, Bar, Row, Btn, tap, st } from '../../src/ui';
import { C, F, R } from '../../src/theme';
import { useDbVersion, getLogs, totalOf, today, shiftDay, MEALS, deleteLog, getWater, addWater, getProfile, latestWeight, copyMeal, Meal } from '../../src/db';
import { computeTargets, idx, fmt } from '../../src/nutrients';
import { suggestions } from '../../src/suggest';
import { WeightModal } from '../../src/WeightModal';

const MEAL_ICON: Record<Meal, keyof typeof Feather.glyphMap> = { Breakfast: 'sunrise', Lunch: 'sun', Snacks: 'coffee', Dinner: 'moon' };

export default function Today() {
  useDbVersion();
  const router = useRouter();
  const [day, setDay] = useState(today());
  const [weightOpen, setWeightOpen] = useState(false);
  const [quick, setQuick] = useState('');
  const p = getProfile();
  if (!p) return null;
  const t = computeTargets(p);
  const logs = getLogs(day);
  const tot = totalOf(logs);
  const water = getWater(day);
  const lw = latestWeight();
  const weighDue = !lw || shiftDay(lw.day, 7) <= today();
  const sugg = day === today() ? suggestions(tot, t, p.diet, water, logs.length > 0) : [];

  const kcal = tot[0], kT = t.n[0];
  const left = kT - kcal;
  const isToday = day === today();
  const dayLabel = isToday ? 'Today' : day === shiftDay(today(), -1) ? 'Yesterday' : new Date(day + 'T12:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const hello = (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; })();

  const macros = [
    { k: 'protein', label: 'Protein', color: C.leaf },
    { k: 'carbs', label: 'Carbs', color: C.turmeric },
    { k: 'fat', label: 'Fat', color: C.chili },
    { k: 'fiber', label: 'Fiber', color: C.plum },
  ] as const;

  return (
    <Screen kicker={isToday ? `${hello}${p.name ? ', ' + p.name : ''}` : 'Looking back'} title={dayLabel}
      right={<Row>
        <Pressable accessibilityLabel="Previous day" hitSlop={10} onPress={() => { tap(); setDay(shiftDay(day, -1)); }} style={{ padding: 8 }}><Feather name="chevron-left" size={22} color={C.ink} /></Pressable>
        <Pressable accessibilityLabel="Next day" hitSlop={10} disabled={isToday} onPress={() => { tap(); setDay(shiftDay(day, 1)); }} style={{ padding: 8, opacity: isToday ? 0.25 : 1 }}><Feather name="chevron-right" size={22} color={C.ink} /></Pressable>
      </Row>}>

      {/* Energy */}
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Ring pct={kcal / kT} size={148} stroke={11}>
            <T v="display" style={{ fontSize: 34 }}>{fmt(Math.abs(left))}</T>
            <T v="small">{left >= 0 ? 'kcal left' : 'kcal over'}</T>
          </Ring>
          <View style={{ flex: 1, marginLeft: 18 }}>
            <Stat label="Eaten" value={`${fmt(kcal)}`} />
            <Stat label="Target" value={`${fmt(kT)}`} />
            <Stat label={p.goal === 'lose' ? 'Deficit plan' : p.goal === 'gain' ? 'Surplus plan' : 'Maintain'} value={p.goal === 'maintain' ? '±0' : `${p.goal === 'lose' ? '−' : '+'}${p.rate} kg/wk`} />
          </View>
        </Row>
        <View style={st.hr} />
        {macros.map(m => {
          const v = tot[idx(m.k)], tg = t.n[idx(m.k)];
          return (
            <View key={m.k} style={{ marginBottom: 10 }}>
              <Row style={{ justifyContent: 'space-between', marginBottom: 5 }}>
                <Row><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.color, marginRight: 8 }} /><T v="body" style={{ fontFamily: F.medium }}>{m.label}</T></Row>
                <T v="small"><T v="small" style={{ color: C.ink, fontFamily: F.bold }}>{fmt(v)}</T> / {fmt(tg)} g</T>
              </Row>
              <Bar pct={v / tg} color={m.color} />
            </View>
          );
        })}
        <Pressable onPress={() => router.push({ pathname: '/nutrients', params: { day } })} accessibilityRole="button" style={{ paddingTop: 4 }}>
          <Row style={{ justifyContent: 'space-between' }}><T v="small" style={{ color: C.ink, fontFamily: F.bold }}>All 30 nutrients, vitamins & minerals</T><Feather name="arrow-right" size={16} color={C.ink} /></Row>
        </Pressable>
      </Card>

      {/* Quick log */}
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 999, borderWidth: 1, borderColor: C.line, paddingLeft: 16, marginBottom: 12 }}>
        <Feather name="edit-3" size={16} color={C.ink3} />
        <TextInput value={quick} onChangeText={setQuick} placeholder="2 roti, 1 katori rajma, chawal…" placeholderTextColor={C.ink3} accessibilityLabel="Quick log what you ate"
          style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 10, fontFamily: F.body, fontSize: 15, color: C.ink }} returnKeyType="go"
          onSubmitEditing={() => { if (quick.trim()) { router.push({ pathname: '/quick', params: { text: quick, day } }); setQuick(''); } }} />
        {/* empty box: the button photographs the meal for Gemini instead */}
        <Pressable accessibilityLabel={quick.trim() ? 'Log it' : 'Photograph your meal'} onPress={() => { tap(); if (quick.trim()) { router.push({ pathname: '/quick', params: { text: quick, day } }); setQuick(''); } else router.push({ pathname: '/add', params: { day, snap: '1' } }); }}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', margin: 4 }}>
          <Feather name={quick.trim() ? 'arrow-up' : 'camera'} size={18} color={C.onAccent} />
        </Pressable>
      </View>

      {/* Weekly weight check-in */}
      {isToday && weighDue && (
        <Card onPress={() => setWeightOpen(true)} style={{ backgroundColor: C.ink, borderColor: C.ink }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <T v="label" style={{ color: C.ink3 }}>Weekly check-in</T>
              <T v="h2" style={{ color: C.bg, marginTop: 4 }}>{lw ? `Last weighed ${lw.kg} kg on ${lw.day}. Time to step on the scale.` : 'Log your starting weight'}</T>
            </View>
            <Feather name="plus-circle" size={26} color={C.bg} />
          </Row>
        </Card>
      )}

      {/* Water */}
      <Card>
        <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <View><T v="label">Water</T><T v="num" style={{ marginTop: 2 }}>{+(water / 1000).toFixed(2)} <T v="small">/ {(t.waterMl / 1000).toFixed(1)} L</T></T></View>
          <Row style={{ gap: 8 }}>
            <Btn small kind="ghost" title="−250" accessibilityLabel="Remove 250 ml water" onPress={() => addWater(day, -250)} />
            <Btn small kind="soft" title="+250" accessibilityLabel="Add a glass, 250 ml" onPress={() => addWater(day, 250)} />
            <Btn small title="+500" accessibilityLabel="Add a bottle, 500 ml" onPress={() => addWater(day, 500)} />
          </Row>
        </Row>
        <Row style={{ gap: 4 }}>
          {Array.from({ length: Math.ceil(t.waterMl / 250) }, (_, i) => (
            <View key={i} style={{ flex: 1, height: 22, borderRadius: 5, backgroundColor: i < water / 250 ? C.indigo : C.track }} />
          ))}
        </Row>
      </Card>

      {/* Meals */}
      {MEALS.map(meal => {
        const items = logs.filter(l => l.meal === meal);
        const mk = items.reduce((a, l) => a + l.n[0], 0);
        const yesterday = getLogs(shiftDay(day, -1)).some(l => l.meal === meal);
        return (
          <Card key={meal}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row><Feather name={MEAL_ICON[meal]} size={17} color={C.ink2} /><T v="h2" style={{ marginLeft: 10 }}>{meal}</T></Row>
              <Row style={{ gap: 6 }}>
                {mk > 0 && <T v="small" style={{ marginRight: 4 }}>{fmt(mk)} kcal</T>}
                <Pressable accessibilityLabel={`Add food to ${meal}`} hitSlop={8} onPress={() => router.push({ pathname: '/add', params: { meal, day } })}
                  style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.track, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="plus" size={18} color={C.ink} />
                </Pressable>
              </Row>
            </Row>
            {items.map(l => (
              <Pressable key={l.id} accessibilityHint="Long press to remove"
                onPress={() => router.push({ pathname: '/food/[id]', params: { id: l.food_id, meal, day } })}
                onLongPress={() => Alert.alert('Remove item?', l.name, [{ text: 'Cancel' }, { text: 'Remove', style: 'destructive', onPress: () => deleteLog(l.id) }])}
                style={{ paddingVertical: 9, borderTopWidth: 1, borderTopColor: C.line, marginTop: 9 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <T v="body" numberOfLines={1}>{l.name}</T>
                    <T v="small">{l.qty !== 1 ? `${+l.qty.toFixed(2)} × ` : ''}{l.label} · {Math.round(l.grams)} g · P {fmt(l.n[1])} C {fmt(l.n[2])} F {fmt(l.n[3])}</T>
                  </View>
                  <T v="body" style={{ fontFamily: F.bold }}>{fmt(l.n[0])}</T>
                </Row>
              </Pressable>
            ))}
            {!items.length && yesterday && (
              <Pressable onPress={() => { tap(); copyMeal(shiftDay(day, -1), meal, day); }} accessibilityRole="button" style={{ marginTop: 10 }}>
                <T v="small" style={{ color: C.indigo, fontFamily: F.bold }}>↻ Same as yesterday</T>
              </Pressable>
            )}
          </Card>
        );
      })}

      {/* Suggestions */}
      {sugg.length > 0 && <T v="label" style={{ marginTop: 10, marginBottom: 8 }}>For you, right now</T>}
      {sugg.map(s => (
        <Card key={s.key} style={{ borderLeftWidth: 3, borderLeftColor: s.tone === 'good' ? C.leaf : s.tone === 'warn' ? C.turmeric : C.indigo }}>
          <T v="h2">{s.title}</T>
          <T v="small" style={{ marginTop: 4 }}>{s.body}</T>
          {s.foods?.map(f => (
            <Pressable key={f.food.id} onPress={() => router.push({ pathname: '/food/[id]', params: { id: f.food.id, day } })} accessibilityRole="button"
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.bg, borderRadius: R.sm, padding: 10, marginTop: 8 }}>
              <View style={{ flex: 1 }}><T v="body" numberOfLines={1}>{f.food.name}</T><T v="small">{f.label} gives {f.gives}</T></View>
              <Feather name="plus" size={18} color={C.ink2} />
            </Pressable>
          ))}
        </Card>
      ))}
      <WeightModal visible={weightOpen} onClose={() => setWeightOpen(false)} />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={{ marginBottom: 10 }}><T v="label">{label}</T><T v="num">{value}</T></View>;
}
