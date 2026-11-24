import { useState } from 'react';
import { View, Alert, Switch, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { Screen, T, Card, Btn, Row, Field, Chip, st } from '../../src/ui';
import { C, THEMES } from '../../src/theme';
import { useDbVersion, getProfile, setProfile, getKv, setKv, exportAll, importAll, allFoods, getJson, setJson } from '../../src/db';
import { ProfileForm } from '../../src/ProfileForm';
import { computeTargets, fmt, ACTIVITY } from '../../src/nutrients';
import { DEFAULT_MODEL, chat } from '../../src/ai';

export default function ProfileTab() {
  useDbVersion();
  const p = getProfile();
  const [edit, setEdit] = useState(false);
  const [key, setKey] = useState(getKv('gemini_key') ?? '');
  const [model, setModel] = useState(getKv('gemini_model') ?? DEFAULT_MODEL);
  const [testing, setTesting] = useState(false);
  const rem = getJson('reminders', { water: false, weight: false });
  if (!p) return null;
  const t = computeTargets(p);

  async function test() {
    setKv('gemini_key', key.trim() || null); setKv('gemini_model', model.trim() || null);
    if (!key.trim()) return;
    setTesting(true);
    try { const r = await chat([{ role: 'user', text: 'Reply with exactly: Namaste! Coach is ready.' }]); Alert.alert('Gemini works', r.slice(0, 120)); }
    catch (e: any) { Alert.alert('Key or model problem', e.message); }
    finally { setTesting(false); }
  }

  async function setReminder(kind: 'water' | 'weight', on: boolean) {
    if (on) {
      const perm = await Notifications.requestPermissionsAsync();
      if (!perm.granted) return Alert.alert('Notifications are off', 'Turn on notifications for Caltrack in Android settings.');
      await Notifications.setNotificationChannelAsync('reminders', { name: 'Reminders', importance: Notifications.AndroidImportance.DEFAULT });
    }
    const next = { ...rem, [kind]: on };
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (next.water) for (const hour of [10, 12, 14, 16, 18, 20])
      await Notifications.scheduleNotificationAsync({ content: { title: 'Water break 💧', body: 'Have a glass of water, then tap +250 in Thali.' }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute: 0, channelId: 'reminders' } });
    if (next.weight)
      await Notifications.scheduleNotificationAsync({ content: { title: 'Weekly weigh-in', body: 'Step on the scale before breakfast and log it in Thali.' }, trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 8, minute: 30, channelId: 'reminders' } });
    setJson('reminders', next);
  }

  async function backup(foodsOnly: boolean) {
    const data = exportAll();
    const out = foodsOnly ? { app: 'caltrack', v: 1, at: data.at, foods: data.foods } : data;
    const f = new File(Paths.cache, `caltrack-${foodsOnly ? 'my-foods' : 'backup'}-${data.at.slice(0, 10)}.json`);
    if (f.exists) f.delete();
    f.create(); f.write(JSON.stringify(out));
    await Sharing.shareAsync(f.uri, { mimeType: 'application/json', dialogTitle: foodsOnly ? 'Share your foods' : 'Save backup' });
  }
  async function restore() {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
    if (r.canceled) return;
    try {
      const data = JSON.parse(await new File(r.assets[0].uri).text());
      const foodsOnly = !data.logs;
      Alert.alert(foodsOnly ? 'Import foods?' : 'Restore backup?', foodsOnly ? `Adds ${data.foods?.length ?? 0} foods to your list.` : 'This REPLACES all logs on this phone with the backup.', [
        { text: 'Cancel' }, { text: foodsOnly ? 'Import' : 'Replace', style: foodsOnly ? 'default' : 'destructive', onPress: () => { try { importAll(data, foodsOnly); Alert.alert('Done'); } catch (e: any) { Alert.alert('Import failed', e.message); } } },
      ]);
    } catch { Alert.alert('Not a valid file', 'Choose a Caltrack .json backup.'); }
  }

  return (
    <Screen kicker="Settings" title={p.name ? p.name : 'Profile'}>
      {edit ? (
        <Card><ProfileForm initial={p} cta="Save" onSave={np => { setProfile(np); setEdit(false); }} /></Card>
      ) : (
        <Card onPress={() => setEdit(true)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <T v="label">Plan · {p.goal === 'lose' ? `lose ${p.rate} kg/wk` : p.goal === 'gain' ? `gain ${p.rate} kg/wk` : 'maintain'}</T>
              <T v="display" style={{ marginTop: 2 }}>{fmt(t.n[0])}<T v="small"> kcal</T></T>
            </View>
            <T v="small" style={{ color: C.indigo }}>Edit ›</T>
          </Row>
          <T v="small" style={{ marginTop: 6 }}>{p.sex}, {p.age} y · {p.heightCm} cm · {p.weightKg} kg · {ACTIVITY.find(a => a.v === p.activity)?.label} · {p.diet}</T>
          <T v="small">Protein {fmt(t.n[1])} g · Carbs {fmt(t.n[2])} g · Fat {fmt(t.n[3])} g · Water {(t.waterMl / 1000).toFixed(1)} L</T>
        </Card>
      )}

      {THEMES.length > 1 && <>
        <T v="label" style={{ marginTop: 10, marginBottom: 8 }}>Appearance</T>
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{THEMES.map(th => <Chip key={th.id} label={th.name} on={(getKv('theme') ?? THEMES[0].id) === th.id} onPress={() => setKv('theme', th.id)} />)}</View>
          <T v="small">{THEMES.find(th => th.id === (getKv('theme') ?? THEMES[0].id))?.description}</T>
        </Card>
      </>}
      <T v="label" style={{ marginTop: 10, marginBottom: 8 }}>AI features (optional)</T>
      <Card>
        <T v="small" style={{ marginBottom: 10 }}>Paste a Google Gemini API key to turn on meal photos, the coach, label scanning and AI fill for missing foods. Get a free one at aistudio.google.com. The key stays on this phone and goes only to Google.</T>
        <Field label="Gemini API key" value={key} onChangeText={setKey} secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder="AIza…" />
        <Field label="Model" value={model} onChangeText={setModel} autoCapitalize="none" autoCorrect={false} />
        <Row style={{ gap: 10 }}>
          <Btn small title={key.trim() ? 'Save & test' : 'Save'} loading={testing} onPress={test} />
          <Btn small kind="ghost" title="Get a key" onPress={() => Linking.openURL('https://aistudio.google.com/apikey')} />
        </Row>
      </Card>

      <T v="label" style={{ marginTop: 10, marginBottom: 8 }}>Reminders</T>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}><View style={{ flex: 1 }}><T v="body">Water every 2 hours</T><T v="small">10 am – 8 pm</T></View><Switch value={rem.water} onValueChange={v => setReminder('water', v)} trackColor={{ true: C.indigo }} accessibilityLabel="Water reminders" /></Row>
        <View style={st.hr} />
        <Row style={{ justifyContent: 'space-between' }}><View style={{ flex: 1 }}><T v="body">Weekly weigh-in</T><T v="small">Sundays 8:30 am</T></View><Switch value={rem.weight} onValueChange={v => setReminder('weight', v)} trackColor={{ true: C.indigo }} accessibilityLabel="Weekly weight reminder" /></Row>
      </Card>

      <T v="label" style={{ marginTop: 10, marginBottom: 8 }}>Your data</T>
      <Card>
        <T v="small" style={{ marginBottom: 10 }}>Everything lives only on this phone. Back up now and then (to Drive or WhatsApp) so a lost or reset phone doesn't lose your history.</T>
        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          <Btn small title="Back up" onPress={() => backup(false)} />
          <Btn small kind="soft" title="Restore / import" onPress={restore} />
          <Btn small kind="ghost" title={`Share my foods (${allFoods().filter(f => f.custom).length})`} onPress={() => backup(true)} />
        </Row>
        <T v="small" style={{ marginTop: 10 }}>“Share my foods” sends the foods you added or fixed to a friend. They import it and get them too. Your API key is never included.</T>
      </Card>

      <T v="label" style={{ marginTop: 10, marginBottom: 8 }}>About the numbers</T>
      <Card>
        <T v="small">{allFoods().length} foods: 1014 cooked Indian recipes from the Indian Nutrient Databank (INDB 2024), 542 raw foods from the Indian Food Composition Tables (IFCT 2017, NIN), plus everyday items and your own additions. Targets use Mifflin-St Jeor and approximate ICMR-NIN 2020 RDAs. This is guidance, not medical advice.</T>
      </Card>
    </Screen>
  );
}
