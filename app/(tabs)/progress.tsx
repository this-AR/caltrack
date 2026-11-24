import { useState } from 'react';
import { View, Pressable, Alert } from 'react-native';
import { Screen, T, Card, Btn, Row, Segmented, st } from '../../src/ui';
import { LineChart, BarChart } from '../../src/charts';
import { C, F } from '../../src/theme';
import { useDbVersion, dailyTotals, weights, waterHistory, getProfile, deleteWeight, today, shiftDay } from '../../src/db';
import { computeTargets, idx, fmt } from '../../src/nutrients';
import { WeightModal } from '../../src/WeightModal';

export default function Progress() {
  useDbVersion();
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [wOpen, setWOpen] = useState(false);
  const p = getProfile();
  if (!p) return null;
  const t = computeTargets(p);
  const days = dailyTotals(range);
  const logged = days.filter(d => d.logged);
  const avg = (i: number) => (logged.length ? logged.reduce((a, d) => a + d.n[i], 0) / logged.length : 0);
  const ws = weights();
  const start = shiftDay(today(), -(range - 1));
  const wIn = ws.filter(w => w.day >= start);
  const water = waterHistory(range);

  // weight trend: linear fit over the last 4+ weeks of entries
  const recent = ws.filter(w => w.day >= shiftDay(today(), -42));
  let perWeek: number | null = null;
  if (recent.length >= 2) {
    const xs = recent.map(w => (new Date(w.day).getTime() - new Date(recent[0].day).getTime()) / 864e5), ys = recent.map(w => w.kg);
    const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
    const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    if (den > 0) perWeek = (xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / den) * 7;
  }
  const last = ws[ws.length - 1];
  const eta = p.targetKg && last && perWeek && Math.sign(p.targetKg - last.kg) === Math.sign(perWeek) && Math.abs(perWeek) > 0.02
    ? Math.ceil(Math.abs(p.targetKg - last.kg) / Math.abs(perWeek)) : null;
  // streak of consecutive logged days ending today/yesterday
  const all = dailyTotals(120);
  let streak = 0;
  for (let i = all.length - 1; i >= 0; i--) { if (all[i].logged) streak++; else if (i < all.length - 1) break; }
  const onTarget = logged.filter(d => Math.abs(d.n[0] - t.n[0]) <= t.n[0] * 0.1).length;

  return (
    <Screen kicker="Your trends" title="Progress">
      <Segmented options={[{ v: 7, label: '7 days' }, { v: 30, label: '30 days' }, { v: 90, label: '90 days' }]} value={range} onChange={setRange} />

      <Row style={{ gap: 10, marginBottom: 12 }}>
        <Tile label="Streak" value={`${streak}`} unit={streak === 1 ? 'day' : 'days'} />
        <Tile label="Days logged" value={`${logged.length}`} unit={`/ ${range}`} />
        <Tile label="On target" value={`${onTarget}`} unit="days" />
      </Row>

      <Card>
        <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <View>
            <T v="label">Weight</T>
            <T v="num">{last ? `${last.kg} kg` : '—'}{perWeek != null ? <T v="small">  {perWeek >= 0 ? '+' : ''}{perWeek.toFixed(2)} kg/week</T> : null}</T>
          </View>
          <Btn small title="Log weight" onPress={() => setWOpen(true)} />
        </Row>
        <LineChart data={wIn.map(w => ({ x: w.day, y: w.kg }))} color={C.accent} unit="kg" target={p.targetKg} fmtY={v => v.toFixed(1)} />
        {p.targetKg ? <T v="small" style={{ marginTop: 6 }}>Target {p.targetKg} kg (dashed line). {eta ? `At this pace you'd reach it in about ${eta} weeks.` : ws.length < 2 ? 'Log weekly to see your trend.' : 'The trend is not moving toward the target yet.'}</T> : null}
      </Card>

      <Card>
        <T v="label">Calories</T>
        <T v="num">{fmt(avg(0))} <T v="small">avg/day · target {fmt(t.n[0])}</T></T>
        <BarChart data={days.map(d => ({ x: d.day, y: d.n[0] }))} color={C.accent} unit="kcal" target={t.n[0]} />
        <T v="small">Red bars are more than 8% over target.</T>
      </Card>

      <Card>
        <T v="label">Protein</T>
        <T v="num">{fmt(avg(idx('protein')))} g <T v="small">avg · target {fmt(t.n[idx('protein')])} g</T></T>
        <BarChart data={days.map(d => ({ x: d.day, y: d.n[idx('protein')] }))} color={C.leaf} unit="g" target={t.n[idx('protein')]} />
      </Card>

      <Card>
        <T v="label">Water</T>
        <T v="num">{(water.reduce((a, w) => a + w.ml, 0) / Math.max(1, water.filter(w => w.ml > 0).length) / 1000).toFixed(1)} L <T v="small">avg · target {(t.waterMl / 1000).toFixed(1)} L</T></T>
        <BarChart data={water.map(w => ({ x: w.day, y: w.ml / 1000 }))} color={C.indigo} unit="L" target={t.waterMl / 1000} fmtY={v => v.toFixed(1)} />
      </Card>

      <Card>
        <T v="label" style={{ marginBottom: 6 }}>Averages on logged days</T>
        {([['Carbs', 'carbs', 'g'], ['Fat', 'fat', 'g'], ['Fiber', 'fiber', 'g'], ['Iron', 'iron', 'mg'], ['Calcium', 'calcium', 'mg'], ['Sodium', 'sodium', 'mg']] as const).map(([l, k, u]) => (
          <Row key={k} style={{ justifyContent: 'space-between', paddingVertical: 5 }}>
            <T v="body">{l}</T><T v="small"><T v="small" style={{ color: C.ink, fontFamily: F.bold }}>{fmt(avg(idx(k)))}</T> / {fmt(t.n[idx(k)])} {u}</T>
          </Row>
        ))}
      </Card>

      {ws.length > 0 && (
        <Card>
          <T v="label" style={{ marginBottom: 4 }}>Weight log</T>
          {[...ws].reverse().slice(0, 12).map((w, i, arr) => (
            <Pressable key={w.day} onLongPress={() => Alert.alert('Delete entry?', `${w.day}: ${w.kg} kg`, [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteWeight(w.day) }])} accessibilityHint="Long press to delete">
              <Row style={{ justifyContent: 'space-between', paddingVertical: 7 }}>
                <T v="body">{w.day}</T>
                <T v="body" style={{ fontFamily: F.bold }}>{w.kg} kg {arr[i + 1] ? <T v="small">({(w.kg - arr[i + 1].kg >= 0 ? '+' : '') + (w.kg - arr[i + 1].kg).toFixed(1)})</T> : null}</T>
              </Row>
              {i < arr.length - 1 && <View style={[st.hr, { marginVertical: 0 }]} />}
            </Pressable>
          ))}
        </Card>
      )}
      <WeightModal visible={wOpen} onClose={() => setWOpen(false)} />
    </Screen>
  );
}

function Tile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12 }}>
      <T v="label" numberOfLines={1}>{label}</T>
      <T v="num" style={{ fontSize: 24, marginTop: 2 }}>{value}<T v="small"> {unit}</T></T>
    </View>
  );
}
