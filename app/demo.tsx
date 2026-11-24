import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { allFoods, addLog, addWater, setProfile, setWeight, today, shiftDay, getProfile, getLogs, setKv, Meal, dailyTotals } from '../src/db';
import { THEMES } from '../src/theme';
import { searchFoods } from '../src/search';
import { DEFAULT_PROFILE } from '../src/nutrients';

// Opened via caltrack://demo (adb) to fill an empty install with two weeks of sample data, for screenshots and trying the app.
// Only seeds a fresh install (no profile, no logs); never touches real data.
const PLAN: [Meal, string, number][] = [
  ['Breakfast', 'poha', 1], ['Breakfast', 'tea garam chai', 1],
  ['Lunch', 'chapati roti', 3], ['Lunch', 'rajma curry', 1], ['Lunch', 'boiled rice uble chawal', 1],
  ['Snacks', 'banana', 1], ['Snacks', 'roasted peanuts', 1],
  ['Dinner', 'dal moong', 1], ['Dinner', 'chapati roti', 2], ['Dinner', 'matar paneer', 1],
];

export default function Demo() {
  const router = useRouter();
  const { theme } = useLocalSearchParams<{ theme?: string }>();
  useEffect(() => {
    // any app or web link can open this route: accept only known themes, and seed only a brand-new install
    if (theme && THEMES.some(t => t.id === theme)) setKv('theme', theme);
    if (!getProfile() && !dailyTotals(3650, today()).some(d => d.logged)) {
      setProfile({ ...DEFAULT_PROFILE, name: 'Demo', weightKg: 78, goal: 'lose', rate: 0.5, targetKg: 72, activity: 1.375 });
      if (!getLogs(today()).length) {
        const foods = allFoods();
        for (let d = 13; d >= 0; d--) {
          const day = shiftDay(today(), -d);
          setWeight(day, +(78 + d * 0.09 + Math.sin(d) * 0.25).toFixed(1));
          addWater(day, d === 0 ? 1250 : 2000 + (d % 3) * 500);
          PLAN.forEach(([meal, q, qty], i) => {
            if (d === 0 && meal === 'Dinner') return; // today: dinner not eaten yet
            if ((d + i) % 7 === 0) return; // some variety
            const f = searchFoods(foods, q, 1)[0];
            const s = f?.serv[0] ?? ['100 g', 100];
            if (f) addLog(day, meal, f, s[1] * qty, s[0], qty);
          });
        }
      }
    }
    router.replace('/');
  }, []);
  return null;
}
