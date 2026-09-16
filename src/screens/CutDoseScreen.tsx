import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { computeDoses, type DoseItem } from '../engine/dosing';
import { norm } from '../engine/normalize';
import { matchSymptoms } from '../engine/parse';
import type { Audience } from '../engine/types';
import { useData } from '../store/DataContext';
import { Alert, Card, Chip, Empty, Label, Segment } from '../ui/bits';
import { C, R } from '../ui/theme';

const AUDIENCES: Audience[] = ['Người lớn', 'Trẻ em'];
const DAYS = ['1', '2', '3', '5'] as const;

/** Tình trạng khách: bật là phải gọi dược sĩ, và đánh dấu thuốc có cảnh báo liên quan */
const CONDITIONS: { key: string; label: string; keywords: string[] }[] = [
  { key: 'preg', label: 'Có thai / cho bú', keywords: ['mang thai', 'có thai', 'thai', 'cho bú', 'cho con bú'] },
  { key: 'stomach', label: 'Đau dạ dày', keywords: ['dạ dày', 'bao tử', 'loét'] },
  { key: 'allergy', label: 'Dị ứng thuốc', keywords: ['dị ứng'] },
  { key: 'old', label: 'Trên 65 tuổi', keywords: [] },
  { key: 'meds', label: 'Đang uống thuốc khác', keywords: [] },
];

export default function CutDoseScreen() {
  const { data } = useData();
  const insets = useSafeAreaInsets();
  const [audience, setAudience] = useState<Audience>('Người lớn');
  const [kgText, setKgText] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [days, setDays] = useState<(typeof DAYS)[number]>('3');
  const [showExtra, setShowExtra] = useState(false);
  const [conds, setConds] = useState<string[]>([]);
  const [condsDone, setCondsDone] = useState(false);
  const [flags, setFlags] = useState<string[]>([]);
  const [flagsDone, setFlagsDone] = useState(false);
  const condsY = useRef(0);
  const flagsY = useRef(0);
  const [showFlags, setShowFlags] = useState(false);
  const [query, setQuery] = useState('');
  const kgRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const resultY = useRef(0);

  const kg = useMemo(() => {
    const n = Number(kgText.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [kgText]);
  const isChild = audience === 'Trẻ em';
  const kgWarn = isChild && kg !== null ? (kg < 3 || kg > 90 ? 'Số kg lạ, kiểm lại (bé thường 3–60 kg).' : kg > 40 ? 'Nặng như người lớn. Chọn Người lớn hoặc hỏi dược sĩ.' : null) : null;

  const visibleSymptoms = useMemo(() => matchSymptoms(data.symptoms, query), [data.symptoms, query]);
  const groups = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of visibleSymptoms) {
      const arr = m.get(s.group) ?? [];
      arr.push(s.name);
      m.set(s.group, arr);
    }
    return [...m.entries()];
  }, [visibleSymptoms]);

  const redFlags = useMemo(() => data.redFlags.filter((f) => f.audience === 'Cả hai' || f.audience === audience), [data.redFlags, audience]);
  const activeFlags = redFlags.filter((f) => flags.includes(f.text));

  const result = useMemo(() => computeDoses(data, selected, audience, kg, Number(days)), [data, selected, audience, kg, days]);
  const mainItems = result.items.length > 3 ? result.items.filter((i) => i.priority < 3) : result.items;
  const extraItems = result.items.length > 3 ? result.items.filter((i) => i.priority >= 3) : [];
  const condKeywords = CONDITIONS.filter((c) => conds.includes(c.key)).flatMap((c) => c.keywords);
  const flagFor = (it: DoseItem): string | null => {
    const hay = norm([it.warning, ...it.orLines].join(' '));
    const hit = CONDITIONS.find((c) => conds.includes(c.key) && c.keywords.some((k) => hay.includes(norm(k))));
    return hit ? `Khách ${hit.label.toLowerCase()}: thuốc này có cảnh báo, hỏi dược sĩ trước khi đưa.` : null;
  };
  void condKeywords;

  const toggle = (name: string) =>
    setSelected((cur) => (cur.some((x) => norm(x) === norm(name)) ? cur.filter((x) => norm(x) !== norm(name)) : [...cur, name]));
  const toggleIn = (setter: React.Dispatch<React.SetStateAction<string[]>>, v: string) =>
    setter((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  const newCustomer = () => {
    setSelected([]); setKgText(''); setAudience('Người lớn'); setDays('3'); setConds([]); setCondsDone(false); setFlags([]); setFlagsDone(false); setQuery(''); setShowExtra(false); setShowFlags(false);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };
  const changeAudience = (a: Audience) => {
    setAudience(a);
    if (a === 'Người lớn') setKgText('');
    else setTimeout(() => kgRef.current?.focus(), 50);
  };
  const hasInput = selected.length > 0 || conds.length > 0 || flags.length > 0 || kgText !== '' || audience !== 'Người lớn' || condsDone || flagsDone;
  const gateOpen = condsDone && flagsDone;
  const scrollTo = (y: number) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.top}>
        <Text style={s.title}>Cắt liều</Text>
        <View style={s.topBtns}>
          {selected.length > 0 && activeFlags.length === 0 && gateOpen && (
            <Pressable onPress={() => scrollRef.current?.scrollTo({ y: Math.max(0, resultY.current - 8), animated: true })} style={s.jump}>
              <Text style={s.jumpText}>↓ Xem thuốc ({result.items.length})</Text>
            </Pressable>
          )}
          {hasInput && (
            <Pressable onPress={newCustomer} style={s.newBtn}>
              <Text style={s.newText}>Khách mới</Text>
            </Pressable>
          )}
        </View>
      </View>
      <ScrollView ref={scrollRef} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {/* 1. Ai uống */}
        <Label>1 · Ai uống?</Label>
        <View style={s.row}>
          <View style={{ flex: 1.2 }}>
            <Segment options={AUDIENCES} value={audience} onChange={changeAudience} />
          </View>
          <View style={[s.kgBox, !isChild && { opacity: 0.45 }, isChild && kg === null && s.kgBoxNeed]}>
            <Text style={s.kgLabel}>Cân</Text>
            <TextInput ref={kgRef} value={kgText} onChangeText={setKgText} keyboardType="decimal-pad" placeholder="— kg" placeholderTextColor={C.muted} style={s.kgInput} editable={isChild} />
            {kgText ? <Text style={s.kgUnit}>kg</Text> : null}
          </View>
        </View>
        <Text style={s.hint}>Trẻ em = dưới 12 tuổi. Từ 12 tuổi hoặc trên 40 kg → Người lớn. Không chắc → hỏi dược sĩ.</Text>
        {kgWarn && <Alert kind="danger">{kgWarn}</Alert>}

        {/* 2. Tình trạng đặc biệt */}
        <View onLayout={(e) => { condsY.current = e.nativeEvent.layout.y; }}>
          <Label right={condsDone ? '✓ đã hỏi' : 'chưa hỏi'}>2 · Khách có gì đặc biệt không? (hỏi rồi chấm)</Label>
        </View>
        <View style={s.chips}>
          <Chip text="Không có gì đặc biệt" on={condsDone && conds.length === 0} onPress={() => { setConds([]); setCondsDone(true); }} />
          {CONDITIONS.filter((c) => !(c.key === 'preg' && isChild) && !(c.key === 'old' && isChild)).map((c) => (
            <Chip key={c.key} text={c.label} on={conds.includes(c.key)} onPress={() => { toggleIn(setConds, c.key); setCondsDone(true); }} />
          ))}
        </View>

        {/* 3. Cờ đỏ */}
        <View onLayout={(e) => { flagsY.current = e.nativeEvent.layout.y; }}>
          <Label right={flagsDone ? (activeFlags.length ? `⛔ ${activeFlags.length}` : '✓ không có') : 'chưa hỏi'}>3 · Dấu hiệu nguy hiểm? (hỏi khách {redFlags.length} câu)</Label>
        </View>
        <View style={s.row}>
          <Pressable onPress={() => { setFlags([]); setFlagsDone(true); setShowFlags(false); }} style={[s.okBtn, flagsDone && activeFlags.length === 0 && s.okBtnOn]}>
            <Text style={[s.okBtnText, flagsDone && activeFlags.length === 0 && { color: '#fff' }]}>✓ Không có dấu hiệu nào</Text>
          </Pressable>
          <Pressable onPress={() => setShowFlags((v) => !v)} style={[s.flagHead, activeFlags.length > 0 && s.flagHeadOn]}>
            <Text style={[s.flagHeadText, activeFlags.length > 0 && { color: '#fff' }]}>{activeFlags.length > 0 ? `⛔ Có ${activeFlags.length}` : showFlags ? 'Ẩn ▲' : 'Xem câu hỏi ▼'}</Text>
          </Pressable>
        </View>
        {(showFlags || activeFlags.length > 0) && (
          <View style={s.chips}>
            {redFlags.map((f) => (
              <Pressable key={f.text} onPress={() => { toggleIn(setFlags, f.text); setFlagsDone(true); }} style={[s.flagChip, flags.includes(f.text) && s.flagChipOn]}>
                <Text style={[s.flagChipText, flags.includes(f.text) && { color: '#fff' }]}>{f.text}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* 4. Triệu chứng */}
        <Label right={selected.length ? `đã chấm ${selected.length}` : undefined}>4 · Khách bị gì?</Label>
        <View style={s.search}>
          <TextInput value={query} onChangeText={setQuery} placeholder="Gõ lời khách nói: đi ngoài, nhức đầu, nổi mẩn…" placeholderTextColor={C.muted} style={s.searchInput} autoCorrect={false} />
          {query ? <Pressable onPress={() => setQuery('')}><Text style={s.x}>✕</Text></Pressable> : null}
        </View>
        {selected.length > 0 && query !== '' && (
          <Text style={s.hint}>Đang chấm: {selected.join(', ')}</Text>
        )}
        {groups.length === 0 && <Alert kind="warn">Không có triệu chứng nào khớp "{query}". Hỏi lại khách bằng từ khác, hoặc hỏi dược sĩ.</Alert>}
        {groups.map(([g, names]) => (
          <View key={g} style={{ gap: 6 }}>
            <Text style={s.groupName}>{g}</Text>
            <View style={s.chips}>
              {names.map((n) => (
                <Chip key={n} text={n} on={selected.some((x) => norm(x) === norm(n))} onPress={() => { toggle(n); if (query) setQuery(''); }} />
              ))}
            </View>
          </View>
        ))}

        {/* 5. Kết quả */}
        <View onLayout={(e) => { resultY.current = e.nativeEvent.layout.y; }}>
          <Label right={result.items.length && activeFlags.length === 0 ? `${result.items.length} món` : undefined}>5 · Thuốc cần cắt</Label>
        </View>

        {activeFlags.length > 0 ? (
          <View style={s.stop}>
            <Text style={s.stopTitle}>KHÔNG CẮT THUỐC</Text>
            {activeFlags.map((f) => (
              <Text key={f.text} style={s.stopLine}>• {f.text}: <Text style={{ fontWeight: '700' }}>{f.action}</Text></Text>
            ))}
            <Text style={s.stopFoot}>Gọi dược sĩ ngay nếu dược sĩ có mặt. Nói với khách nhẹ nhàng: "Dạ trường hợp này em không dám cắt, anh/chị đi khám cho chắc".</Text>
          </View>
        ) : selected.length > 0 && !gateOpen ? (
          <View style={s.gate}>
            <Text style={s.gateTitle}>Còn thiếu câu hỏi bắt buộc</Text>
            {!condsDone && (
              <Pressable onPress={() => scrollTo(condsY.current)} style={s.gateBtn}><Text style={s.gateBtnText}>→ Bước 2: hỏi khách có gì đặc biệt không, rồi chấm</Text></Pressable>
            )}
            {!flagsDone && (
              <Pressable onPress={() => scrollTo(flagsY.current)} style={s.gateBtn}><Text style={s.gateBtnText}>→ Bước 3: hỏi dấu hiệu nguy hiểm, rồi bấm "Không có" hoặc chấm</Text></Pressable>
            )}
            <Text style={s.gateFoot}>Thuốc chỉ hiện khi hỏi đủ. Đây là quy trình dược sĩ đặt ra để bán an toàn.</Text>
          </View>
        ) : (
          <>
            {selected.length === 0 && <Empty text="Chấm triệu chứng ở mục 4, thuốc sẽ hiện ở đây." />}
            {selected.length > 0 && (
              <>
                <View style={s.forWho}>
                  <Text style={s.forWhoText}>Đang tính cho: <Text style={s.forWhoStrong}>{audience.toUpperCase()}{isChild && kg ? ` · ${kgText} kg` : ''}</Text> · {days} ngày</Text>
                </View>
                <View style={s.daysRow}>
                  <Text style={s.daysLabel}>Cắt cho</Text>
                  <View style={{ flex: 1 }}><Segment options={[...DAYS]} value={days} onChange={setDays} /></View>
                  <Text style={s.daysLabel}>ngày</Text>
                </View>
              </>
            )}
            {conds.length > 0 && selected.length > 0 && (
              <Alert kind="danger">Khách {CONDITIONS.filter((c) => conds.includes(c.key)).map((c) => c.label.toLowerCase()).join(', ')} → gọi dược sĩ duyệt trước khi bán. Thuốc có dấu đỏ bên dưới là thuốc cần tránh.</Alert>
            )}
            {result.needsWeight && (
              <Pressable onPress={() => kgRef.current?.focus()}>
                <Alert kind="danger">Hỏi khách: bé nặng bao nhiêu kg? Nhập vào ô Cân ở mục 1 thì app mới tính được liều.</Alert>
              </Pressable>
            )}
            {mainItems.map((it) => <DoseCard key={it.key} item={it} flagged={flagFor(it)} />)}
            {extraItems.length > 0 && (
              <Pressable onPress={() => setShowExtra((v) => !v)} style={s.extraBtn}>
                <Text style={s.extraText}>{showExtra ? '▲ Ẩn' : '▼ Thêm nếu cần'} ({extraItems.length} món phụ: {extraItems.map((i) => i.group).join(', ')})</Text>
              </Pressable>
            )}
            {showExtra && extraItems.map((it) => <DoseCard key={it.key} item={it} flagged={flagFor(it)} />)}
            {result.noRule.length > 0 && (
              <Alert kind={result.items.length === 0 ? 'danger' : 'warn'}>
                {result.items.length === 0 ? 'Gọi dược sĩ. ' : ''}Chưa có hướng dẫn cắt liều cho {audience.toLowerCase()} với: {result.noRule.join(', ')}. Đừng tự chọn thuốc, hỏi dược sĩ.
              </Alert>
            )}
            {result.warnings.length > 0 && <Alert kind="warn">{result.warnings.map((w) => `⚠ ${w}`).join('\n')}</Alert>}
            {selected.length > 0 && (
              <Text style={s.foot}>Đọc cho khách nghe cách uống và cảnh báo vàng. Kiểm lại tên thuốc và hàm lượng trên hộp trước khi giao. Xong bấm "Khách mới".</Text>
            )}
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

function DoseCard({ item, flagged }: { item: DoseItem; flagged: string | null }) {
  const name = item.drug ? item.drug.name : item.active;
  const strength = item.drug ? [item.drug.mgText && `${item.drug.mgText} mg`, item.drug.form].filter(Boolean).join(' · ') : '';
  return (
    <Card style={[{ gap: 3 }, flagged && { borderColor: C.danger, borderWidth: 1.5 }]}>
      <View style={s.cardHead}>
        <Text style={s.group}>{item.group.toUpperCase()}</Text>
        <Text style={s.active}>{item.active}</Text>
      </View>
      <View style={s.nameRow}>
        <Text style={s.name}>{name}</Text>
        {strength ? <Text style={s.strength}>{strength}</Text> : null}
      </View>
      {item.drug?.location ? (
        <View style={s.locRow}><Text style={s.loc}>📍 {item.drug.location}</Text></View>
      ) : item.drug ? (
        <Text style={s.locMissing}>📍 chưa ghi vị trí kệ, hỏi dược sĩ</Text>
      ) : null}
      {item.rxOnly ? (
        <Text style={[s.dose, { color: C.danger }]}>Thuốc kê đơn. Không tự bán, hỏi dược sĩ.</Text>
      ) : item.outOfStock ? (
        <Text style={[s.dose, { color: C.danger }]}>Quầy đang hết thuốc này. Hỏi dược sĩ thuốc thay.</Text>
      ) : (
        <Text style={[s.dose, item.needsWeight && { color: C.warn }]}>{item.doseLine}{item.howTo ? ` · ${item.howTo}` : ''}</Text>
      )}
      {item.calcLine ? <View style={s.calc}><Text style={s.calcText}>{item.calcLine}</Text></View> : null}
      {item.totalLine ? <Text style={s.total}>{item.totalLine}</Text> : null}
      {flagged ? <Text style={s.flagged}>⛔ {flagged}</Text> : null}
      {item.alternatives.length > 0 && (
        <Text style={s.alt}>
          Hết thì thay: {item.alternatives.slice(0, 3).map((d) => `${d.name}${d.location ? ` (${d.location})` : ''}`).join(', ')}
          {item.alternatives.length > 3 ? ` +${item.alternatives.length - 3} nữa` : ''}
        </Text>
      )}
      {item.orLines.map((l) => <Text key={l} style={s.or}>{l}</Text>)}
    </Card>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: C.bg },
  title: { fontSize: 20, fontWeight: '700', color: C.ink },
  topBtns: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  jump: { backgroundColor: C.accent, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  jumpText: { color: C.accentInk, fontWeight: '700', fontSize: 13 },
  newBtn: { borderWidth: 1.5, borderColor: C.accent, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  newText: { color: C.accent, fontWeight: '700', fontSize: 13 },
  body: { padding: 14, gap: 10 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  kgBox: { flex: 0.8, flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: R.sm, paddingHorizontal: 10, gap: 6 },
  kgBoxNeed: { borderColor: C.danger, borderWidth: 1.5 },
  kgLabel: { color: C.muted, fontSize: 13 },
  kgInput: { flex: 1, fontSize: 16, color: C.ink, paddingVertical: 6, fontVariant: ['tabular-nums'] },
  kgUnit: { color: C.muted },
  hint: { fontSize: 12, color: C.muted, lineHeight: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  groupName: { fontSize: 12, color: C.ink2, fontWeight: '600' },
  flagHead: { flex: 1, borderWidth: 1, borderColor: C.danger, borderRadius: R.md, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: C.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  okBtn: { flex: 1.3, borderWidth: 1.5, borderColor: C.accent, borderRadius: R.md, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface },
  okBtnOn: { backgroundColor: C.accent },
  okBtnText: { color: C.accent, fontWeight: '700', fontSize: 13 },
  gate: { backgroundColor: C.warnSoft, borderRadius: R.lg, padding: 14, gap: 8 },
  gateTitle: { color: C.warn, fontWeight: '800', fontSize: 16 },
  gateBtn: { backgroundColor: C.surface, borderRadius: R.sm, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: C.line },
  gateBtnText: { color: C.ink, fontWeight: '600', fontSize: 14 },
  gateFoot: { color: C.warn, fontSize: 12 },
  flagHeadOn: { backgroundColor: C.danger },
  flagHeadText: { color: C.danger, fontWeight: '700', fontSize: 13 },
  flagChip: { borderWidth: 1, borderColor: C.danger, backgroundColor: C.surface, borderRadius: R.sm, paddingVertical: 6, paddingHorizontal: 10 },
  flagChipOn: { backgroundColor: C.danger },
  flagChipText: { fontSize: 13, color: C.danger },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.accent, borderRadius: R.md, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 15, color: C.ink, paddingVertical: 9 },
  x: { color: C.muted, fontSize: 16, paddingLeft: 8 },
  forWho: { backgroundColor: C.ink, borderRadius: R.sm, paddingVertical: 8, paddingHorizontal: 12 },
  forWhoText: { color: '#fff', fontSize: 14 },
  forWhoStrong: { fontWeight: '800', fontSize: 15 },
  daysRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  daysLabel: { fontSize: 14, color: C.ink2 },
  stop: { backgroundColor: C.danger, borderRadius: R.lg, padding: 16, gap: 8 },
  stopTitle: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 1 },
  stopLine: { color: '#fff', fontSize: 15, lineHeight: 21 },
  stopFoot: { color: '#fff', fontSize: 13, opacity: 0.9, marginTop: 4 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  group: { fontSize: 11, letterSpacing: 0.8, color: C.accent, fontWeight: '700' },
  active: { fontSize: 12, color: C.muted },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  name: { fontSize: 17, fontWeight: '700', color: C.ink, flexShrink: 1 },
  strength: { fontSize: 13, color: C.ink2, fontVariant: ['tabular-nums'] },
  locRow: { alignSelf: 'flex-start', backgroundColor: C.warnSoft, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  loc: { fontSize: 14, fontWeight: '700', color: C.warn },
  locMissing: { fontSize: 12, color: C.muted, fontStyle: 'italic' },
  dose: { fontSize: 15, color: C.ink, lineHeight: 21 },
  calc: { alignSelf: 'flex-start', backgroundColor: C.accentSoft, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 2 },
  calcText: { fontSize: 12, color: C.accent, fontVariant: ['tabular-nums'] },
  total: { fontSize: 15, fontWeight: '700', color: C.ink, marginTop: 2 },
  flagged: { fontSize: 13, color: C.danger, fontWeight: '600', marginTop: 2 },
  alt: { fontSize: 12.5, color: C.muted, marginTop: 2 },
  or: { fontSize: 12.5, color: C.ink2, marginTop: 2, fontStyle: 'italic' },
  extraBtn: { paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: R.md, backgroundColor: C.surface2 },
  extraText: { color: C.ink2, fontSize: 13, fontWeight: '600' },
  foot: { fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 6 },
});
