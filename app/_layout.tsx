import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { FONTS } from '../src/fonts';
import { initDb, getProfile, getKv, useDbVersion } from '../src/db';
import { C, applyTheme, isDark } from '../src/theme';

export default function Root() {
  const [fonts] = useFonts(FONTS);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const seg = useSegments();
  useDbVersion(); // re-render on theme change
  if (ready) applyTheme(getKv('theme')); // cheap; keeps tokens in sync after a theme change

  useEffect(() => { try { initDb(); applyTheme(getKv('theme')); setReady(true); } catch (e: any) { setErr(String(e?.message ?? e)); } }, []);
  useEffect(() => {
    if (ready && fonts && !getProfile() && seg[0] !== 'onboarding' && seg[0] !== 'demo') router.replace('/onboarding');
  }, [ready, fonts, seg]);

  if (err) return <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: C.bg }}><Text>Could not open the database: {err}</Text></View>;
  if (!ready || !fonts) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack key={getKv('theme') ?? 'night'} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}
