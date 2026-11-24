import { useState, useEffect } from 'react';
import { Modal, View, Pressable, KeyboardAvoidingView } from 'react-native';
import { T, Field, Btn, Row } from './ui';
import { C, R } from './theme';
import { setWeight, today, latestWeight } from './db';

export function WeightModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [kg, setKg] = useState('');
  useEffect(() => { if (visible) setKg(String(latestWeight()?.kg ?? '')); }, [visible]);
  const v = parseFloat(kg.replace(',', '.'));
  const ok = v >= 20 && v <= 350;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(30,26,21,0.35)' }} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior="padding" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <View style={{ backgroundColor: C.bg, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, padding: 22, paddingBottom: 34 }}>
          <T v="label">Weekly check-in</T>
          <T v="h1" style={{ marginBottom: 14 }}>Today's weight</T>
          <Field label="Weight (kg)" value={kg} onChangeText={setKg} keyboardType="decimal-pad" autoFocus placeholder="e.g. 72.5" />
          <T v="small" style={{ marginBottom: 14 }}>Weigh yourself in the morning, after the bathroom and before eating, so readings compare week to week.</T>
          <Row style={{ gap: 10 }}>
            <Btn title="Cancel" kind="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Btn title="Save" disabled={!ok} onPress={() => { setWeight(today(), Math.round(v * 10) / 10); onClose(); }} style={{ flex: 1 }} />
          </Row>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
