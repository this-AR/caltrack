import { Tabs, useRouter } from 'expo-router';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { C, F } from '../../src/theme';

export default function TabsLayout() {
  const router = useRouter();
  const icon = (name: keyof typeof Feather.glyphMap) => ({ color }: { color: any }) => <Feather name={name} size={21} color={color} />;
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: C.accent, tabBarInactiveTintColor: C.ink3,
      tabBarStyle: { backgroundColor: C.card, borderTopColor: C.line, paddingTop: 6 },
      tabBarLabelStyle: { fontFamily: F.medium, fontSize: 11 },
      sceneStyle: { backgroundColor: C.bg },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('sun') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: icon('trending-up') }} />
      <Tabs.Screen name="log" options={{
        title: 'Log', tabBarAccessibilityLabel: 'Log food',
        tabBarIcon: () => <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', marginTop: -8 }}><Feather name="plus" size={22} color={C.onAccent} /></View>,
        tabBarLabel: () => null,
      }} listeners={{ tabPress: e => { e.preventDefault(); router.push('/add'); } }} />
      <Tabs.Screen name="coach" options={{ title: 'Coach', tabBarIcon: icon('message-circle') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('user') }} />
    </Tabs>
  );
}
