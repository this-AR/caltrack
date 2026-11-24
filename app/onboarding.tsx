import { useRouter } from 'expo-router';
import { Screen, T } from '../src/ui';
import { ProfileForm } from '../src/ProfileForm';
import { setProfile, setWeight, today } from '../src/db';
import { DEFAULT_PROFILE } from '../src/nutrients';

export default function Onboarding() {
  const router = useRouter();
  return (
    <Screen kicker="Welcome to Caltrack" title="Let's set your targets">
      <T v="small" style={{ marginTop: -8, marginBottom: 18 }}>Everything stays on this phone. Your calorie, protein, vitamin and water targets come from these details, and you can change them any time.</T>
      <ProfileForm initial={DEFAULT_PROFILE} cta="Start tracking" onSave={p => { setProfile(p); setWeight(today(), p.weightKg); router.replace('/'); }} />
    </Screen>
  );
}
