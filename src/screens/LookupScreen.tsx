import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lookup, searchDrugs, suggestDrugs } from '../engine/lookup';
import type { Drug } from '../engine/types';
import { useData } from '../store/DataContext';
import { Alert, Card, Empty, Label } from '../ui/bits';
import { C, R } from '../ui/theme';

export default function LookupScreen() {
  const { data } = useData();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Drug | null>(null);

  const matches = useMemo(() => searchDrugs(data, q), [data, q]);
  const suggestions = useMemo(() => (q && matches.length === 0 ? suggestDrugs(data, q) : []), [data, q, matches.length]);
  const result = useMemo(() => (picked ? lookup(data, picked) : null), [data, picked]);

  const onType = (t: string) => { setQ(t); setPicked(null); };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.top}><Text style={s.title}>Tra thuốc</Text></View>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <View style={s.search}>
          <TextInput
            value={q}
            onChangeText={onType}
            placeholder="Gõ tên thuốc hoặc hoạt chất…"
            placeholderTextColor={C.muted}
            style={s.input}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {q ? <Pressable onPress={() => onType('')}><Text style={s.x}>✕</Text></Pressable> : null}
        </View>

        {!picked && q && matches.length === 0 && suggestions.length > 0 && (
          <>
            <Label>Có phải bạn tìm</Label>
            {suggestions.map((d) => (
              <Pressable key={d.name + d.mgText} onPress={() => { setQ(d.name); setPicked(d); }}>
                <Row d={d} />
              </Pressable>
            ))}
          </>
        )}
        {!picked && q && matches.length === 0 && suggestions.length === 0 && (
          <>
            <Empty text="Không có thuốc tên này trong danh sách của quầy." />
            <Alert kind="warn">Trả lời khách: "Dạ thuốc này em chưa có". Hỏi khách thuốc đó trị gì rồi qua tab Cắt liều chấm triệu chứng, hoặc hỏi dược sĩ. Thử gõ tên hoạt chất ghi trên hộp (vd Paracetamol) nếu khách cầm hộp theo.</Alert>
          </>
        )}
        {!picked && matches.map((d) => (
          <Pressable key={d.name + d.mgText} onPress={() => setPicked(d)}>
            <Row d={d} />
          </Pressable>
        ))}
        {!picked && !q && <Empty text="Ví dụ: Panadol, Hapacol, Paracetamol…" />}

        {result && (
          <>
            <View style={s.hero}>
              <Text style={s.heroLabel}>HOẠT CHẤT</Text>
              <Text style={s.heroTitle}>{result.drug.active}{result.drug.mgText ? ` · ${result.drug.mgText} mg` : ''}</Text>
              <Text style={s.heroSub}>{[result.drug.name, result.drug.form, result.drug.brand, result.drug.note].filter(Boolean).join(' · ')}</Text>
              <View style={s.badges}>
                {result.drug.inStock ? <Badge text="Còn hàng" kind="ok" /> : <Badge text="Hết hàng / chưa nhập" kind="danger" />}
                {result.drug.rx ? <Badge text="Kê đơn, hỏi dược sĩ" kind="danger" /> : null}
              </View>
            </View>
            {!result.drug.inStock && (
              <Alert kind="warn">Trả lời khách: "Dạ {result.drug.name} em hết rồi, em có {result.sameMg.find((d) => d.inStock)?.name ?? 'thuốc khác'} cùng hoạt chất".</Alert>
            )}
            <Label right={String(result.sameMg.length)}>{result.drug.isCombo ? 'Cùng công thức' : 'Cùng hoạt chất, cùng mg'}</Label>
            {result.sameMg.length === 0 && <Empty text="Không có thuốc nào khác cùng mg." />}
            {result.sameMg.map((d) => <Row key={d.name} d={d} />)}
            {result.otherMg.length > 0 && (
              <>
                <Label right={String(result.otherMg.length)}>{result.drug.isCombo ? 'Thuốc đơn chất của từng thành phần' : 'Cùng hoạt chất, khác mg'}</Label>
                {result.otherMg.map((d) => <Row key={d.name} d={d} sub={result.drug.isCombo ? d.active : undefined} />)}
              </>
            )}
            {result.combos.length > 0 && (
              <>
                <Label right={String(result.combos.length)}>Có thêm chất khác</Label>
                {result.combos.map((d) => <Row key={d.name} d={d} sub={d.active} />)}
              </>
            )}
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

function Badge({ text, kind }: { text: string; kind: 'ok' | 'danger' }) {
  return (
    <View style={[s.badge, kind === 'ok' ? { backgroundColor: C.accent } : { backgroundColor: C.danger }]}>
      <Text style={s.badgeText}>{text}</Text>
    </View>
  );
}

function Row({ d, sub }: { d: Drug; sub?: string }) {
  const dim = !d.inStock || d.rx;
  return (
    <Card style={[s.row, dim && { opacity: 0.6 }]}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={s.rowName}>{d.name}</Text>
          {!d.inStock ? <Badge text="Hết" kind="danger" /> : null}
          {d.rx ? <Badge text="Kê đơn" kind="danger" /> : null}
        </View>
        <Text style={s.rowSub}>{sub ?? [d.brand, d.form, d.audience !== 'Cả hai' ? d.audience : '', d.note].filter(Boolean).join(' · ')}</Text>
      </View>
      <Text style={s.rowMg}>{d.mgText ? `${d.mgText} mg` : d.form}</Text>
    </Card>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  top: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  title: { fontSize: 20, fontWeight: '700', color: C.ink },
  body: { padding: 14, gap: 8 },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.accent, borderRadius: R.md, paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 16, color: C.ink, paddingVertical: 11 },
  x: { color: C.muted, fontSize: 16, paddingLeft: 8 },
  hero: { backgroundColor: C.accentSoft, borderRadius: R.md, padding: 12, gap: 2, marginTop: 4 },
  heroLabel: { fontSize: 11, letterSpacing: 1, color: C.accent, fontWeight: '700' },
  heroTitle: { fontSize: 18, fontWeight: '700', color: C.ink },
  heroSub: { fontSize: 13, color: C.ink2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  rowName: { fontSize: 15, fontWeight: '600', color: C.ink },
  rowSub: { fontSize: 12.5, color: C.muted, marginTop: 1 },
  rowMg: { fontSize: 14, color: C.ink2, fontVariant: ['tabular-nums'] },
  badges: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
