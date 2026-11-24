import { useState, useRef } from 'react';
import { View, TextInput, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { T, Btn, Chip, Card, tap } from '../../src/ui';
import { C, F, R } from '../../src/theme';
import { useDbVersion, getJson, setJson } from '../../src/db';
import { hasAi, chat, ChatMsg, QUICK_PROMPTS } from '../../src/ai';

/** Minimal markdown: **bold**, bullet lines and headings, the parts Gemini actually uses. */
function Md({ text, color }: { text: string; color: string }) {
  return <>{text.split('\n').map((line, i) => {
    const bullet = /^\s*[-*•]\s+/.test(line);
    const head = /^#{1,4}\s+/.test(line);
    const clean = line.replace(/^\s*[-*•]\s+/, '').replace(/^#{1,4}\s+/, '');
    const parts = clean.split(/\*\*(.+?)\*\*/g);
    if (!clean.trim()) return <View key={i} style={{ height: 6 }} />;
    return (
      <T key={i} v="body" style={{ color, marginLeft: bullet ? 12 : 0, fontFamily: head ? F.bold : F.body }}>
        {bullet ? '•  ' : ''}{parts.map((s, j) => <T key={j} v="body" style={{ color, fontFamily: j % 2 || head ? F.bold : F.body }}>{s}</T>)}
      </T>
    );
  })}</>;
}

export default function Coach() {
  useDbVersion();
  const ins = useSafeAreaInsets();
  const router = useRouter();
  const [msgs, setMsgs] = useState<ChatMsg[]>(() => getJson<ChatMsg[]>('chat', []));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scroll = useRef<any>(null);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const next: ChatMsg[] = [...msgs, { role: 'user', text: text.trim() }];
    setMsgs(next); setInput(''); setBusy(true); setErr(null);
    try {
      const reply = await chat(next.slice(-16)); // keep the request small; older turns stay on screen only
      const all: ChatMsg[] = [...next, { role: 'model', text: reply }];
      setMsgs(all); setJson('chat', all.slice(-60));
    } catch (e: any) { setErr(e.message); setMsgs(msgs); setInput(text); }
    finally { setBusy(false); setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 100); }
  }

  if (!hasAi()) return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: ins.top + 12, paddingHorizontal: 18 }}>
      <T v="label">AI coach</T><T v="h1" style={{ marginBottom: 16 }}>Coach</T>
      <Card>
        <T v="h2">Add a Gemini key to use the coach</T>
        <T v="small" style={{ marginTop: 6 }}>• Chat with a coach that can see your food log, targets and weight trend{'\n'}• “Plan the rest of my day” using Indian dishes{'\n'}• Weekly review and grocery lists{'\n'}• Photograph a meal to log it{'\n'}• Fill in nutrition for missing foods, or scan a pack label</T>
        <T v="small" style={{ marginTop: 10 }}>Get a free key at aistudio.google.com → Get API key. It stays on your phone.</T>
        <Btn title="Add key in Profile" style={{ marginTop: 14 }} onPress={() => router.push('/profile')} />
      </Card>
      <T v="small">The rest of the app (logging, targets, suggestions, charts) works fully offline without a key.</T>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: ins.top + 12, paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View><T v="label">Knows your log & goals</T><T v="h1">Coach</T></View>
        {msgs.length > 0 && <Pressable accessibilityLabel="Clear chat" onPress={() => { tap(); setMsgs([]); setJson('chat', []); }} style={{ padding: 6 }}><Feather name="refresh-ccw" size={19} color={C.ink2} /></Pressable>}
      </View>
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingBottom: 12 }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
        {msgs.length === 0 && <>
          <T v="small" style={{ marginBottom: 12 }}>Ask anything in English, Hindi or Hinglish, e.g. “aaj dinner mein kya khaun?”</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{QUICK_PROMPTS.map(q => <Chip key={q.label} label={q.label} onPress={() => send(q.text)} />)}</View>
        </>}
        {msgs.map((m, i) => (
          <View key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', backgroundColor: m.role === 'user' ? C.accent : C.card, borderWidth: m.role === 'user' ? 0 : 1, borderColor: C.line, borderRadius: R.md, padding: 12, marginBottom: 10 }}>
            {m.role === 'user' ? <T v="body" style={{ color: C.onAccent }}>{QUICK_PROMPTS.find(q => q.text === m.text)?.label ?? m.text}</T> : <Md text={m.text} color={C.ink} />}
          </View>
        ))}
        {busy && <ActivityIndicator color={C.ink} style={{ alignSelf: 'flex-start', margin: 8 }} />}
        {err && <T v="small" style={{ color: C.chili }}>{err}</T>}
        {msgs.length > 0 && !busy && <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>{QUICK_PROMPTS.slice(0, 3).map(q => <Chip key={q.label} label={q.label} onPress={() => send(q.text)} />)}</View>}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', padding: 10, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.card }}>
        <TextInput value={input} onChangeText={setInput} placeholder="Ask your coach…" placeholderTextColor={C.ink3} multiline accessibilityLabel="Message to coach"
          style={{ flex: 1, maxHeight: 120, paddingHorizontal: 12, paddingVertical: 10, fontFamily: F.body, fontSize: 15, color: C.ink }} />
        <Pressable accessibilityLabel="Send" disabled={busy || !input.trim()} onPress={() => send(input)} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: input.trim() ? C.accent : C.track, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="arrow-up" size={19} color={input.trim() ? C.onAccent : C.ink3} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
