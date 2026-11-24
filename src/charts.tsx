import React, { useState } from 'react';
import { View, Text, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Line, Rect, Circle, Text as SvgText } from 'react-native-svg';
import { C, F } from './theme';

type Pt = { x: string; y: number | null };
const H = 170, PAD_L = 36, PAD_B = 22, PAD_T = 12;
const short = (d: string) => { const [, m, day] = d.split('-'); return `${+day}/${+m}`; };

function niceRange(vals: number[], extra: number[] = [], zeroBase = false): [number, number] {
  const all = [...vals, ...extra];
  let lo = zeroBase ? 0 : Math.min(...all), hi = Math.max(...all);
  if (!isFinite(lo)) return [0, 1];
  if (hi === lo) { hi += 1; lo = zeroBase ? 0 : lo - 1; }
  const pad = (hi - lo) * 0.12;
  return [zeroBase ? 0 : lo - pad, hi + pad];
}

function useWidth() {
  const [w, setW] = useState(0);
  return [w, (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)] as const;
}

/** Tooltip readout above the chart: tap/drag across the plot to scrub. */
function Readout({ text }: { text: string | null }) {
  return <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.ink2, height: 18, marginBottom: 4 }}>{text ?? 'Tap or drag the chart to see values'}</Text>;
}

/** Round tick values (1, 2, 2.5, 5 × 10^n) inside [lo, hi]. */
function niceTicks(lo: number, hi: number) {
  const raw = (hi - lo) / 3, mag = 10 ** Math.floor(Math.log10(raw)), r = raw / mag;
  const step = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

function Axis({ w, lo, hi, fmtY }: { w: number; lo: number; hi: number; fmtY: (v: number) => string }) {
  const ticks = niceTicks(lo, hi);
  const y = (v: number) => PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B);
  return <>{ticks.map((t, i) => (
    <React.Fragment key={i}>
      <Line x1={PAD_L} x2={w} y1={y(t)} y2={y(t)} stroke={C.line} strokeWidth={1} />
      <SvgText x={PAD_L - 6} y={y(t) + 4} fontSize={10} fill={C.ink3} textAnchor="end" fontFamily={F.body}>{fmtY(t)}</SvgText>
    </React.Fragment>
  ))}</>;
}

export function LineChart({ data, color = C.ink, unit = '', target, fmtY = v => v.toFixed(0) }: { data: Pt[]; color?: string; unit?: string; target?: number; fmtY?: (v: number) => string }) {
  const [w, onLayout] = useWidth();
  const [sel, setSel] = useState<number | null>(null);
  const vals = data.map(d => d.y).filter((v): v is number => v != null);
  if (!vals.length) return <Empty />;
  const [lo, hi] = niceRange(vals, target ? [target] : []);
  const X = (i: number) => PAD_L + 6 + (i / Math.max(1, data.length - 1)) * (w - PAD_L - 12);
  const Y = (v: number) => PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B);
  let d = '', pen = false;
  data.forEach((p, i) => { if (p.y == null) return; d += `${pen ? 'L' : 'M'}${X(i)},${Y(p.y)}`; pen = true; });
  const pick = (x: number) => { const i = Math.round(((x - PAD_L - 6) / (w - PAD_L - 12)) * (data.length - 1)); setSel(Math.max(0, Math.min(data.length - 1, i))); };
  const s = sel != null ? data[sel] : null;
  return (
    <View onLayout={onLayout}>
      <Readout text={s ? `${short(s.x)} · ${s.y != null ? `${fmtY(s.y)} ${unit}` : 'no entry'}` : null} />
      {w > 0 && (
        <View onStartShouldSetResponder={() => true} onResponderGrant={e => pick(e.nativeEvent.locationX)} onResponderMove={e => pick(e.nativeEvent.locationX)} onResponderRelease={() => setTimeout(() => setSel(null), 1800)}>
          <Svg width={w} height={H}>
            <Axis w={w} lo={lo} hi={hi} fmtY={fmtY} />
            {target ? <Line x1={PAD_L} x2={w} y1={Y(target)} y2={Y(target)} stroke={C.ink2} strokeDasharray="4 4" strokeWidth={1} /> : null}
            <Path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {data.map((p, i) => p.y != null && (data.length <= 16 || i === sel) ? <Circle key={i} cx={X(i)} cy={Y(p.y)} r={i === sel ? 5 : 4} fill={color} stroke={C.card} strokeWidth={2} /> : null)}
            {sel != null && <Line x1={X(sel)} x2={X(sel)} y1={PAD_T} y2={H - PAD_B} stroke={C.ink3} strokeWidth={1} />}
            <XLabels data={data} X={X} />
          </Svg>
        </View>
      )}
    </View>
  );
}

export function BarChart({ data, color = C.ink, unit = '', target, fmtY = v => v.toFixed(0) }: { data: Pt[]; color?: string; unit?: string; target?: number; fmtY?: (v: number) => string }) {
  const [w, onLayout] = useWidth();
  const [sel, setSel] = useState<number | null>(null);
  const vals = data.map(d => d.y ?? 0);
  if (!vals.some(v => v > 0)) return <Empty />;
  const [lo, hi] = niceRange(vals, target ? [target] : [], true);
  const slot = (w - PAD_L) / data.length;
  const bw = Math.max(3, Math.min(22, slot - 2)); // ≥2px gap between bars
  const X = (i: number) => PAD_L + slot * i + slot / 2;
  const Y = (v: number) => PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B);
  const pick = (x: number) => setSel(Math.max(0, Math.min(data.length - 1, Math.floor((x - PAD_L) / slot))));
  const s = sel != null ? data[sel] : null;
  return (
    <View onLayout={onLayout}>
      <Readout text={s ? `${short(s.x)} · ${fmtY(s.y ?? 0)} ${unit}${target ? ` (target ${fmtY(target)})` : ''}` : null} />
      {w > 0 && (
        <View onStartShouldSetResponder={() => true} onResponderGrant={e => pick(e.nativeEvent.locationX)} onResponderMove={e => pick(e.nativeEvent.locationX)} onResponderRelease={() => setTimeout(() => setSel(null), 1800)}>
          <Svg width={w} height={H}>
            <Axis w={w} lo={lo} hi={hi} fmtY={fmtY} />
            {data.map((p, i) => {
              const v = p.y ?? 0; if (v <= 0) return null;
              const top = Y(v), base = Y(0), r = Math.min(4, bw / 2);
              // rounded top only, flat on the baseline
              const x0 = X(i) - bw / 2, x1 = X(i) + bw / 2;
              const path = `M${x0},${base}L${x0},${top + r}Q${x0},${top} ${x0 + r},${top}L${x1 - r},${top}Q${x1},${top} ${x1},${top + r}L${x1},${base}Z`;
              return <Path key={i} d={path} fill={target && v > target * 1.08 ? C.chili : color} opacity={sel == null || sel === i ? 1 : 0.45} />;
            })}
            {target ? <Line x1={PAD_L} x2={w} y1={Y(target)} y2={Y(target)} stroke={C.ink2} strokeDasharray="4 4" strokeWidth={1} /> : null}
            <XLabels data={data} X={X} />
          </Svg>
        </View>
      )}
    </View>
  );
}

function XLabels({ data, X }: { data: Pt[]; X: (i: number) => number }) {
  const every = Math.ceil(data.length / 6);
  return <>{data.map((p, i) => (i % every === 0 || i === data.length - 1) && (i === data.length - 1 || data.length - 1 - i >= every / 2)
    ? <SvgText key={i} x={X(i)} y={H - 6} fontSize={10} fill={C.ink3} textAnchor={i === data.length - 1 ? 'end' : 'middle'} fontFamily={F.body}>{short(p.x)}</SvgText> : null)}</>;
}

function Empty() {
  return <View style={{ height: H, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: F.body, color: C.ink3 }}>No data yet</Text></View>;
}

/** Stacked horizontal bar for macro split (energy share), with 2px gaps. */
export function SplitBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <View>
      <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
        {parts.filter(p => p.value > 0).map(p => <View key={p.label} style={{ flex: p.value / total, backgroundColor: p.color }} />)}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 8, flexWrap: 'wrap' }}>
        {parts.map(p => (
          <View key={p.label} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.color, marginRight: 6 }} />
            <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.ink2 }}>{p.label} {Math.round((p.value / total) * 100)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
