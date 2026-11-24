import React from 'react';
import { View, Text, Pressable, TextInput, ScrollView, TextProps, ViewStyle, TextInputProps, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { C, F, R } from './theme';

export const tap = () => Haptics.selectionAsync().catch(() => {});

type V = 'display' | 'h1' | 'h2' | 'body' | 'small' | 'label' | 'num';
const tv = (): Record<V, any> => ({
  display: { fontFamily: F.display, fontSize: 44, lineHeight: 52, color: C.ink, letterSpacing: -1.8, fontVariant: ['tabular-nums'] },
  h1: { fontFamily: F.display, fontSize: 30, lineHeight: 38, color: C.ink, letterSpacing: -1.1 },
  h2: { fontFamily: F.medium, fontSize: 17, lineHeight: 23, color: C.ink, letterSpacing: -0.2 },
  body: { fontFamily: F.body, fontSize: 15, color: C.ink, lineHeight: 21 },
  small: { fontFamily: F.body, fontSize: 13, color: C.ink2, lineHeight: 18 },
  label: { fontFamily: F.medium, fontSize: 13, lineHeight: 18, color: C.ink3 },
  num: { fontFamily: F.display, fontSize: 22, lineHeight: 30, color: C.ink, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
});
export function T({ v = 'body', style, ...p }: TextProps & { v?: V }) {
  return <Text {...p} style={[tv()[v], style]} />;
}

export function Screen({ children, title, kicker, right, scroll = true }: { children: React.ReactNode; title?: string; kicker?: string; right?: React.ReactNode; scroll?: boolean }) {
  const ins = useSafeAreaInsets();
  const head = title ? (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
      <View style={{ flex: 1 }}>{kicker ? <T v="label">{kicker}</T> : null}<T v="h1" style={{ marginTop: 2 }}>{title}</T></View>
      {right}
    </View>
  ) : null;
  if (!scroll) return <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: ins.top + 12, paddingHorizontal: 18 }}>{head}{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: ins.top + 12, paddingHorizontal: 18, paddingBottom: 40 + ins.bottom }} keyboardShouldPersistTaps="handled">
        {head}{children}
      </ScrollView>
      {/* solid strip under the status bar so scrolled content doesn't collide with the clock */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: ins.top, backgroundColor: C.bg }} />
    </View>
  );
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const s = [st.card, style];
  return onPress ? <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => [s, pressed && { opacity: 0.85 }]}>{children}</Pressable> : <View style={s}>{children}</View>;
}

export function Btn({ title, onPress, kind = 'primary', small, disabled, loading, style, accessibilityLabel }: { title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'soft' | 'danger'; small?: boolean; disabled?: boolean; loading?: boolean; style?: ViewStyle; accessibilityLabel?: string }) {
  const bg = kind === 'primary' ? C.accent : kind === 'soft' ? C.track : kind === 'danger' ? C.chili : 'transparent';
  const fg = kind === 'primary' ? C.onAccent : kind === 'danger' ? C.white : C.ink;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} disabled={disabled || loading} onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [{ backgroundColor: bg, borderRadius: 999, paddingVertical: small ? 8 : 14, paddingHorizontal: small ? 14 : 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', opacity: disabled ? 0.4 : pressed ? 0.8 : 1, borderWidth: kind === 'ghost' ? 1 : 0, borderColor: C.line, minHeight: 40 }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={{ fontFamily: F.medium, fontSize: small ? 13 : 15, color: fg }}>{title}</Text>}
    </Pressable>
  );
}

export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!on }} onPress={() => { tap(); onPress(); }}
      style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: on ? C.accent : C.card, borderWidth: 1, borderColor: on ? C.accent : C.line, marginRight: 8, marginBottom: 8, minHeight: 36, justifyContent: 'center' }}>
      <Text style={{ fontFamily: F.medium, fontSize: 13, color: on ? C.onAccent : C.ink }}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, style, ...p }: TextInputProps & { label?: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <T v="label" style={{ marginBottom: 6 }}>{label}</T> : null}
      <TextInput placeholderTextColor={C.ink3} accessibilityLabel={label} {...p}
        style={[{ backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: R.sm, paddingHorizontal: 14, paddingVertical: 12, fontFamily: F.body, fontSize: 15, color: C.ink }, style]} />
    </View>
  );
}

export function Ring({ size = 150, stroke = 12, pct, color = C.accent, children }: { size?: number; stroke?: number; pct: number; color?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.track} strokeWidth={stroke} fill="none" />
        {p > 0 && <Circle cx={size / 2} cy={size / 2} r={r} stroke={pct > 1.05 ? C.chili : color} strokeWidth={stroke} fill="none" strokeDasharray={`${c * p} ${c}`} strokeLinecap="round" />}
      </Svg>
      {children}
    </View>
  );
}

export function Bar({ pct, color = C.ink, height = 6, limit }: { pct: number; color?: string; height?: number; limit?: boolean }) {
  const over = pct > 1;
  return (
    <View style={{ height, backgroundColor: C.track, borderRadius: height, overflow: 'hidden' }}>
      <View style={{ width: `${Math.min(100, Math.max(pct > 0 ? 2 : 0, pct * 100))}%`, height, borderRadius: height, backgroundColor: over && limit ? C.chili : color }} />
    </View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;
}

export function Segmented<T extends string | number>({ options, value, onChange }: { options: { v: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: C.track, borderRadius: 999, padding: 3, marginBottom: 12 }}>
      {options.map(o => (
        <Pressable key={String(o.v)} accessibilityRole="button" accessibilityState={{ selected: o.v === value }} onPress={() => { tap(); onChange(o.v); }}
          style={{ flex: 1, paddingVertical: 9, borderRadius: 999, alignItems: 'center', backgroundColor: o.v === value ? C.card : 'transparent' }}>
          <Text style={{ fontFamily: F.medium, fontSize: 13, color: o.v === value ? C.ink : C.ink2 }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const st = {
  get card() { return { backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: C.line, padding: 18, marginBottom: 12 } as ViewStyle; },
  get hr() { return { height: 1, backgroundColor: C.line, marginVertical: 10 } as ViewStyle; },
};
