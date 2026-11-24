import { useState } from 'react';
import { View, Pressable, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Screen, T, Card, Btn, Row, Field, Segmented } from '../src/ui';
import { C, F } from '../src/theme';
import { getFood, saveFood, deleteFood, Serving } from '../src/db';
import { KEYS, META, NKey, idx } from '../src/nutrients';
import { hasAi, nutritionFor } from '../src/ai';

const MAIN: NKey[] = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'satfat', 'sodium'];
const toStr = (v: number) => (v ? String(+v.toFixed(3)) : '');

export default function CustomFood() {
  const router = useRouter();
  const { id, name: n0, meal, day } = useLocalSearchParams<{ id?: string; name?: string; meal?: string; day?: string }>();
  const existing = id ? getFood(id) : undefined;
  const [name, setName] = useState(existing?.name ?? n0 ?? '');
  const [sLabel, setSLabel] = useState(existing?.serv[0]?.[0]?.replace(/^1 /, '') ?? '');
  const [sGrams, setSGrams] = useState(existing?.serv[0] ? String(existing.serv[0][1]) : '');
  const [basis, setBasis] = useState<'100g' | 'serving'>(existing ? '100g' : 'serving');
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(KEYS.map(k => [k, existing ? toStr(existing.n[idx(k)]) : ''])));
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);

  async function ai(withPhoto: boolean) {
    if (!hasAi()) return Alert.alert('Add a Gemini key', 'Profile → AI features. Or type the values from the pack label yourself.');
    let img: string | undefined;
    if (withPhoto) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return;
      const r = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6, mediaTypes: ['images'] });
      if (r.canceled || !r.assets[0]?.base64) return;
      img = r.assets[0].base64;
    } else if (!name.trim()) return Alert.alert('Type the food name first');
    setBusy(true);
    try {
      const o = await nutritionFor(name || 'food in photo', img);
      if (!name.trim() || withPhoto) setName(o.name);
      setSLabel(o.serving[0].replace(/^1 /, '')); setSGrams(String(Math.round(o.serving[1])));
      setBasis('100g');
      setVals(Object.fromEntries(KEYS.map((k, i) => [k, toStr(o.n[i])])));
      setMore(true);
    } catch (e: any) { Alert.alert('AI could not fill this', e.message); }
    finally { setBusy(false); }
  }

  function save() {
    const g = parseFloat(sGrams);
    if (!name.trim()) return Alert.alert('Give the food a name');
    if (basis === 'serving' && !(g > 0)) return Alert.alert('Serving grams needed', 'Values are per serving, so tell me how many grams one serving weighs (a pack label lists this).');
    const factor = basis === 'serving' ? 100 / g : 1;
    const n = KEYS.map(k => Math.max(0, (parseFloat(vals[k]) || 0) * factor));
    if (!n[0]) return Alert.alert('Calories needed', 'Enter at least the energy (kcal).');
    const serv: Serving[] = g > 0 ? [[`1 ${sLabel.trim() || 'serving'}`, Math.round(g)], ...(existing?.serv.slice(1) ?? [])] : existing?.serv ?? [];
    const newId = saveFood({ id: existing?.id, name: name.trim(), alt: existing?.alt, serv, n });
    if (existing) router.back();
    else router.replace({ pathname: '/food/[id]', params: { id: newId, meal, day } });
  }

  const field = (k: NKey) => (
    <View key={k} style={{ width: '48%' }}>
      <Field label={`${META[k].label} (${META[k].unit})`} value={vals[k]} onChangeText={v => setVals({ ...vals, [k]: v })} keyboardType="decimal-pad" placeholder="0" />
    </View>
  );

  return (
    <Screen kicker={existing ? (existing.custom ? 'Edit your food' : 'Correct built-in values') : 'Missing food? Add it once'} title={existing ? 'Edit food' : 'New food'}
      right={<Pressable accessibilityLabel="Close" hitSlop={10} onPress={() => router.back()} style={{ padding: 6 }}><Feather name="x" size={24} color={C.ink} /></Pressable>}>
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Mom's aloo paratha" />
      <Row style={{ gap: 8, marginBottom: 12 }}>
        <Btn small kind="soft" title="✦ Fill with AI" loading={busy} onPress={() => ai(false)} style={{ flex: 1 }} />
        <Btn small kind="soft" title="Scan label" disabled={busy} onPress={() => ai(true)} style={{ flex: 1 }} />
      </Row>
      <Row style={{ gap: 8 }}>
        <View style={{ flex: 2 }}><Field label="Serving name" value={sLabel} onChangeText={setSLabel} placeholder="katori / piece / packet" /></View>
        <View style={{ flex: 1 }}><Field label="Grams" value={sGrams} onChangeText={setSGrams} keyboardType="decimal-pad" placeholder="150" /></View>
      </Row>
      <T v="label" style={{ marginBottom: 6 }}>Values below are per</T>
      <Segmented options={[{ v: 'serving', label: '1 serving' }, { v: '100g', label: '100 g' }]} value={basis} onChange={setBasis} />
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>{MAIN.map(field)}</View>
        <Pressable accessibilityRole="button" onPress={() => setMore(!more)}><T v="small" style={{ color: C.indigo, fontFamily: F.bold }}>{more ? '− Hide' : '+ Show'} vitamins & minerals (optional)</T></Pressable>
        {more && <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 12 }}>{KEYS.filter(k => !MAIN.includes(k)).map(field)}</View>}
      </Card>
      <Btn title={existing ? 'Save changes' : 'Save food'} onPress={save} />
      {existing?.custom === 1 && <Btn title="Delete this food" kind="ghost" style={{ marginTop: 10 }} onPress={() => Alert.alert('Delete food?', 'Past logs keep their values.', [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { deleteFood(existing.id); router.dismissTo('/'); } }])} />}
      <T v="small" style={{ marginTop: 14 }}>Saved foods stay on this phone and show up first in search. AI values are estimates, so check them against the pack label when you have one.</T>
    </Screen>
  );
}
