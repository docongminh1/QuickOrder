import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { C, R } from './theme';

export function Label({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={s.labelRow}>
      <Text style={s.label}>{children}</Text>
      {right ? <Text style={s.labelRight}>{right}</Text> : null}
    </View>
  );
}

export function Chip({ text, on, onPress }: { text: string; on?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, on && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: !!on }}>
      <Text style={[s.chipText, on && s.chipTextOn]}>{text}</Text>
    </Pressable>
  );
}

export function Segment<T extends string>({ options, value, onChange }: { options: T[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={s.seg}>
      {options.map((o) => (
        <Pressable key={o} onPress={() => onChange(o)} style={[s.segItem, o === value && s.segOn]}>
          <Text style={[s.segText, o === value && s.segTextOn]}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Alert({ kind, children }: { kind: 'warn' | 'danger' | 'ok'; children: React.ReactNode }) {
  const bg = kind === 'warn' ? C.warnSoft : kind === 'danger' ? C.dangerSoft : C.accentSoft;
  const fg = kind === 'warn' ? C.warn : kind === 'danger' ? C.danger : C.accent;
  return (
    <View style={[s.alert, { backgroundColor: bg }]}>
      <Text style={[s.alertText, { color: fg }]}>{children}</Text>
    </View>
  );
}

export function Button({ title, onPress, ghost, disabled }: { title: string; onPress: () => void; ghost?: boolean; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [s.btn, ghost && s.btnGhost, disabled && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}>
      <Text style={[s.btnText, ghost && s.btnGhostText]}>{title}</Text>
    </Pressable>
  );
}

export function Empty({ text }: { text: string }) {
  return <Text style={s.empty}>{text}</Text>;
}

const s = StyleSheet.create({
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6 },
  label: { fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: C.muted, fontWeight: '600' },
  labelRight: { fontSize: 12, color: C.muted },
  chip: { borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, borderRadius: R.pill, paddingVertical: 7, paddingHorizontal: 13 },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { fontSize: 14, color: C.ink2 },
  chipTextOn: { color: C.accentInk, fontWeight: '600' },
  seg: { flexDirection: 'row', borderWidth: 1, borderColor: C.line, borderRadius: R.sm, overflow: 'hidden', backgroundColor: C.surface },
  segItem: { flex: 1, paddingVertical: 9, alignItems: 'center' },
  segOn: { backgroundColor: C.accentSoft },
  segText: { fontSize: 14, color: C.muted },
  segTextOn: { color: C.accent, fontWeight: '700' },
  card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: R.md, padding: 12 },
  alert: { borderRadius: R.sm, padding: 10 },
  alertText: { fontSize: 13, lineHeight: 18 },
  btn: { backgroundColor: C.accent, borderRadius: R.md, paddingVertical: 13, alignItems: 'center' },
  btnGhost: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line },
  btnText: { color: C.accentInk, fontWeight: '700', fontSize: 15 },
  btnGhostText: { color: C.ink },
  empty: { color: C.muted, fontSize: 14, textAlign: 'center', paddingVertical: 24 },
});
