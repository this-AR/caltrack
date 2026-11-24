import { useState } from 'react';
import { View } from 'react-native';
import { T, Field, Segmented, Chip, Card, Row, Btn, st } from './ui';
import { C } from './theme';
import { Profile, ACTIVITY, computeTargets, fmt, idx, Goal, Diet } from './nutrients';

export function ProfileForm({ initial, onSave, cta }: { initial: Profile; onSave: (p: Profile) => void; cta: string }) {
  const [p, setP] = useState(initial);
  const [txt, setTxt] = useState({ age: String(initial.age), h: String(initial.heightCm), w: String(initial.weightKg), tw: initial.targetKg ? String(initial.targetKg) : '' });
  const num = (s: string) => parseFloat(s.replace(',', '.'));
  const valid = num(txt.age) >= 13 && num(txt.age) <= 100 && num(txt.h) >= 100 && num(txt.h) <= 250 && num(txt.w) >= 25 && num(txt.w) <= 350;
  const cur: Profile = { ...p, age: num(txt.age) || p.age, heightCm: num(txt.h) || p.heightCm, weightKg: num(txt.w) || p.weightKg, targetKg: num(txt.tw) > 0 ? num(txt.tw) : undefined };
  const t = computeTargets(cur);
  const bmi = cur.weightKg / (cur.heightCm / 100) ** 2;

  return (
    <View>
      <Field label="Your name (optional)" value={p.name} onChangeText={name => setP({ ...p, name })} placeholder="Aditya" />
      <T v="label" style={{ marginBottom: 6 }}>Sex (used in the BMR formula)</T>
      <Segmented options={[{ v: 'male', label: 'Male' }, { v: 'female', label: 'Female' }]} value={p.sex} onChange={sex => setP({ ...p, sex })} />
      <Row style={{ gap: 10 }}>
        <View style={{ flex: 1 }}><Field label="Age" value={txt.age} onChangeText={age => setTxt({ ...txt, age })} keyboardType="number-pad" /></View>
        <View style={{ flex: 1 }}><Field label="Height cm" value={txt.h} onChangeText={h => setTxt({ ...txt, h })} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Field label="Weight kg" value={txt.w} onChangeText={w => setTxt({ ...txt, w })} keyboardType="decimal-pad" /></View>
      </Row>
      <T v="label" style={{ marginBottom: 6 }}>Activity</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{ACTIVITY.map(a => <Chip key={a.v} label={a.label} on={p.activity === a.v} onPress={() => setP({ ...p, activity: a.v })} />)}</View>
      <T v="small" style={{ marginBottom: 12, marginTop: -2 }}>{ACTIVITY.find(a => a.v === p.activity)?.hint}</T>
      <T v="label" style={{ marginBottom: 6 }}>Goal</T>
      <Segmented options={[{ v: 'lose', label: 'Lose fat' }, { v: 'maintain', label: 'Maintain' }, { v: 'gain', label: 'Gain muscle' }]} value={p.goal} onChange={(goal: Goal) => setP({ ...p, goal, rate: goal === 'gain' ? 0.25 : 0.5 })} />
      {p.goal !== 'maintain' && <>
        <T v="label" style={{ marginBottom: 6 }}>Pace per week</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {(p.goal === 'lose' ? [0.25, 0.5, 0.75, 1] : [0.1, 0.25, 0.5]).map(r => <Chip key={r} label={`${r} kg`} on={p.rate === r} onPress={() => setP({ ...p, rate: r })} />)}
        </View>
        <Field label="Target weight kg (optional)" value={txt.tw} onChangeText={tw => setTxt({ ...txt, tw })} keyboardType="decimal-pad" placeholder={p.goal === 'lose' ? 'e.g. 68' : 'e.g. 75'} />
      </>}
      <T v="label" style={{ marginBottom: 6 }}>Diet</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
        {([['veg', 'Vegetarian'], ['egg', 'Eggetarian'], ['nonveg', 'Non-veg'], ['vegan', 'Vegan']] as [Diet, string][]).map(([v, l]) => <Chip key={v} label={l} on={p.diet === v} onPress={() => setP({ ...p, diet: v })} />)}
      </View>

      <Card style={{ marginTop: 6 }}>
        <T v="label">Your daily plan</T>
        <T v="display" style={{ marginTop: 4 }}>{fmt(t.n[0])}<T v="small"> kcal/day</T></T>
        <T v="small">BMR {fmt(t.bmr)} · maintenance {fmt(t.tdee)} kcal · BMI {bmi.toFixed(1)}</T>
        <View style={st.hr} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Mini label="Protein" v={`${fmt(t.n[idx('protein')])} g`} color={C.leaf} />
          <Mini label="Carbs" v={`${fmt(t.n[idx('carbs')])} g`} color={C.turmeric} />
          <Mini label="Fat" v={`${fmt(t.n[idx('fat')])} g`} color={C.chili} />
          <Mini label="Fiber" v={`${fmt(t.n[idx('fiber')])} g`} color={C.plum} />
          <Mini label="Water" v={`${(t.waterMl / 1000).toFixed(1)} L`} color={C.indigo} />
        </Row>
        <T v="small" style={{ marginTop: 10 }}>
          Protein {p.goal === 'maintain' ? '1.2' : '1.8'} g/kg{p.goal === 'gain' ? ' for muscle gain' : p.goal === 'lose' ? ' to hold on to muscle while losing fat' : ''}. Fat {p.goal === 'lose' ? 25 : 27}% of calories, the rest from carbs. Uses the Mifflin-St Jeor formula; 1 kg of fat ≈ 7700 kcal.
          {p.goal === 'lose' && p.rate >= 1 ? ' 1 kg/week is aggressive, so keep protein high and check in often.' : ''}
        </T>
      </Card>
      <Btn title={cta} disabled={!valid} onPress={() => onSave(cur)} />
      {!valid && <T v="small" style={{ marginTop: 8, color: C.chili }}>Please check age (13–100), height (100–250 cm) and weight (25–350 kg).</T>}
    </View>
  );
}

function Mini({ label, v, color }: { label: string; v: string; color: string }) {
  return <View><Row><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginRight: 5 }} /><T v="label">{label}</T></Row><T v="h2" style={{ marginTop: 2 }}>{v}</T></View>;
}
