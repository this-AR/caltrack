import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Screen, T, Card, Bar, Row, Segmented } from '../src/ui';
import { SplitBar } from '../src/charts';
import { C, F } from '../src/theme';
import { getLogs, totalOf, today, getProfile, dailyTotals, useDbVersion } from '../src/db';
import { KEYS, META, idx, fmt, computeTargets, Group, NKey, zero } from '../src/nutrients';

const GROUPS: Group[] = ['Macros', 'Limits', 'Minerals', 'Vitamins'];

export default function Nutrients() {
  useDbVersion();
  const router = useRouter();
  const { day = today() } = useLocalSearchParams<{ day?: string }>();
  const [range, setRange] = useState<1 | 7>(1);
  const [open, setOpen] = useState<NKey | null>(null);
  const p = getProfile()!;
  const t = computeTargets(p);
  const logs = getLogs(day);
  let tot = totalOf(logs);
  if (range === 7) {
    const days = dailyTotals(7, day).filter(d => d.logged);
    tot = days.length ? days.reduce((a, d) => a.map((v, i) => v + d.n[i] / days.length), zero()) : zero();
  }

  return (
    <Screen kicker={range === 1 ? day : `7-day average to ${day}`} title="Nutrients"
      right={<Pressable accessibilityLabel="Close" hitSlop={10} onPress={() => router.back()} style={{ padding: 6 }}><Feather name="x" size={24} color={C.ink} /></Pressable>}>
      <Segmented options={[{ v: 1, label: 'This day' }, { v: 7, label: '7-day average' }]} value={range} onChange={setRange} />
      <Card>
        <T v="label" style={{ marginBottom: 8 }}>Where your {fmt(tot[0])} kcal came from</T>
        <SplitBar parts={[
          { label: 'Protein', value: tot[idx('protein')] * 4, color: C.leaf },
          { label: 'Carbs', value: tot[idx('carbs')] * 4, color: C.turmeric },
          { label: 'Fat', value: tot[idx('fat')] * 9, color: C.chili },
        ]} />
      </Card>
      {GROUPS.map(g => (
        <Card key={g}>
          <T v="label" style={{ marginBottom: 6 }}>{g === 'Limits' ? 'Keep under' : g}</T>
          {KEYS.filter(k => META[k].group === g).map(k => {
            const v = tot[idx(k)], tg = t.n[idx(k)], pct = v / tg, m = META[k];
            const MAC: Partial<Record<NKey, string>> = { protein: C.leaf, carbs: C.turmeric, fat: C.chili, fiber: C.plum };
            // red only for going over a limit; low-so-far is normal early in the day
            const color = m.limit ? (pct > 1 ? C.chili : C.ink2) : MAC[k] ?? (pct >= 1 ? C.leaf : C.ink2);
            const contributors = open === k && range === 1 ? [...logs].sort((a, b) => b.n[idx(k)] - a.n[idx(k)]).filter(l => l.n[idx(k)] > 0).slice(0, 4) : [];
            return (
              <Pressable key={k} onPress={() => setOpen(open === k ? null : k)} accessibilityRole="button" accessibilityHint="Show which foods gave this" style={{ paddingVertical: 8 }}>
                <Row style={{ justifyContent: 'space-between', marginBottom: 5 }}>
                  <T v="body" style={{ fontFamily: F.medium }}>{m.label}</T>
                  <T v="small"><T v="small" style={{ color: C.ink, fontFamily: F.bold }}>{fmt(v)}</T> / {fmt(tg)} {m.unit} · {Math.round(pct * 100)}%</T>
                </Row>
                <Bar pct={pct} color={color} limit={m.limit} />
                {contributors.map(l => <T key={l.id} v="small" style={{ marginTop: 4 }}>· {l.name}: {fmt(l.n[idx(k)])} {m.unit}</T>)}
              </Pressable>
            );
          })}
        </Card>
      ))}
      <T v="small">Targets: ICMR-NIN 2020 RDAs for Indian adults (approximate) and your calorie plan. Food values come from INDB 2024 and IFCT 2017. Vitamin B12 and iodine aren't in these tables. Tap a nutrient to see which foods gave it.</T>
    </Screen>
  );
}
