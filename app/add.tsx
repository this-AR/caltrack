import { useState, useMemo, useEffect } from 'react';
import { View, TextInput, FlatList, Pressable, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { T, Chip, Row, tap } from '../src/ui';
import { C, F, R } from '../src/theme';
import { allFoods, recentFoods, MEALS, Meal, today, useDbVersion, Food } from '../src/db';
import { searchFoods } from '../src/search';
import { fmt } from '../src/nutrients';
import { hasAi } from '../src/ai';
import { pending } from '../src/pending';

const defaultMeal = (): Meal => { const h = new Date().getHours(); return h < 11 ? 'Breakfast' : h < 16 ? 'Lunch' : h < 19 ? 'Snacks' : 'Dinner'; };

export default function Add() {
  useDbVersion();
  const ins = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ meal?: Meal; day?: string; snap?: string }>();
  const [meal, setMeal] = useState<Meal>(params.meal ?? defaultMeal());
  const day = params.day ?? today();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'recent' | 'frequent' | 'mine'>('recent');

  const results = useMemo(() => {
    if (q.trim()) return searchFoods(allFoods(), q);
    if (tab === 'recent') return recentFoods(30);
    if (tab === 'frequent') return [...allFoods()].filter(f => f.uses > 0).sort((a, b) => b.uses - a.uses).slice(0, 30);
    return allFoods().filter(f => f.custom > 0);
  }, [q, tab, allFoods().length]);

  async function snap(camera: boolean) {
    if (!hasAi()) return Alert.alert('Add a Gemini key', 'Meal photos need a Gemini API key. Add one in Profile → AI features (Google gives free keys).', [{ text: 'Later' }, { text: 'Open Profile', onPress: () => router.push('/profile') }]);
    // the gallery uses Android's photo picker, which needs no storage permission (blocked in app.json)
    if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) return Alert.alert('Permission needed', 'Allow camera access to photograph your meal.');
    const opts: ImagePicker.ImagePickerOptions = { base64: true, quality: 0.5, mediaTypes: ['images'] };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled || !r.assets[0]?.base64) return;
    pending.image = { base64: r.assets[0].base64, mime: r.assets[0].mimeType ?? 'image/jpeg' };
    router.push({ pathname: '/quick', params: { meal, day, photo: '1' } });
  }

  useEffect(() => { if (params.snap) snap(true); }, []); // opened from the camera button on Today

  const open = (f: Food) => router.push({ pathname: '/food/[id]', params: { id: f.id, meal, day } });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: ins.top + 8 }}>
      <View style={{ paddingHorizontal: 18 }}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <T v="h1">Add food</T>
          <Pressable accessibilityLabel="Close" hitSlop={10} onPress={() => router.back()} style={{ padding: 6 }}><Feather name="x" size={24} color={C.ink} /></Pressable>
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {MEALS.map(m => <Chip key={m} label={m} on={m === meal} onPress={() => setMeal(m)} />)}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: R.sm, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, marginTop: 4 }}>
          <Feather name="search" size={18} color={C.ink3} />
          <TextInput autoFocus value={q} onChangeText={setQ} placeholder="Search rajma, roti, dal makhani, paneer…" placeholderTextColor={C.ink3} accessibilityLabel="Search foods"
            style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 10, fontFamily: F.body, fontSize: 16, color: C.ink }} />
          {q ? <Pressable accessibilityLabel="Clear search" onPress={() => setQ('')}><Feather name="x-circle" size={18} color={C.ink3} /></Pressable> : null}
        </View>
        <Row style={{ gap: 8, marginTop: 10 }}>
          <Action icon="camera" label="Snap meal" onPress={() => snap(true)} />
          <Action icon="image" label="From gallery" onPress={() => snap(false)} />
          <Action icon="plus-square" label="New food" onPress={() => router.push({ pathname: '/custom-food', params: { name: q, meal, day } })} />
        </Row>
        {!q && <Row style={{ marginTop: 12 }}>
          {(['recent', 'frequent', 'mine'] as const).map(k => <Chip key={k} label={k === 'recent' ? 'Recent' : k === 'frequent' ? 'Frequent' : 'My foods'} on={tab === k} onPress={() => setTab(k)} />)}
        </Row>}
      </View>
      <FlatList data={results} keyExtractor={f => f.id} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}
        ListEmptyComponent={<View style={{ paddingVertical: 30 }}>
          <T v="small" style={{ textAlign: 'center' }}>{q ? `No match for “${q}”.` : tab === 'mine' ? 'Foods you create or edit will show up here.' : 'Foods you log will show up here.'}</T>
          {q ? <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/custom-food', params: { name: q, meal, day } })}><T v="body" style={{ textAlign: 'center', marginTop: 10, color: C.indigo, fontFamily: F.bold }}>Add “{q}” as a new food →</T></Pressable> : null}
        </View>}
        renderItem={({ item: f }) => {
          const s = f.serv[0];
          return (
            <Pressable onPress={() => { tap(); open(f); }} accessibilityRole="button" style={({ pressed }) => ({ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line, opacity: pressed ? 0.6 : 1 })}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <T v="body" numberOfLines={2}>{f.name}</T>
                  <T v="small" numberOfLines={1}>{s ? `${s[0]} · ${fmt((f.n[0] * s[1]) / 100)} kcal` : `100 g · ${fmt(f.n[0])} kcal`} · {f.custom ? 'Yours' : f.src === 'IFCT' ? 'Raw ingredient' : f.src === 'INDB' ? 'Indian recipe' : f.src === 'Common' ? 'Everyday food' : f.src}</T>
                </View>
                <Feather name="chevron-right" size={18} color={C.ink3} />
              </Row>
            </Pressable>
          );
        }} />
    </View>
  );
}

function Action({ icon, label, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => { tap(); onPress(); }} style={({ pressed }) => ({ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: R.sm, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, opacity: pressed ? 0.7 : 1 })}>
      <Feather name={icon} size={18} color={C.ink} />
      <T v="small" style={{ marginTop: 4, color: C.ink, fontFamily: F.medium }}>{label}</T>
    </Pressable>
  );
}
