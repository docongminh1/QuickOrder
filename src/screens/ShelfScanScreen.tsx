import React, { useState } from 'react';
import { ActivityIndicator, Alert as RNAlert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { applyShelfProposals, makeClient, proposeFromShelf, readShelfImage, VisionRefusal, type ShelfProposal } from '../engine/vision';
import { norm } from '../engine/normalize';
import { getApiKey } from '../store/apiKey';
import { useData } from '../store/DataContext';
import { captureImage } from '../ui/capture';
import { Alert, Button, Card, Chip, Label } from '../ui/bits';
import { C, R } from '../ui/theme';

export default function ShelfScanScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { data, replace } = useData();
  const [shelf, setShelf] = useState('Kệ 1');
  const [busy, setBusy] = useState<string | null>(null);
  const [props, setProps] = useState<ShelfProposal[] | null>(null);
  const [label, setLabel] = useState('');
  const [rxCabinet, setRxCabinet] = useState(false);

  const scan = async (src: 'camera' | 'library') => {
    const key = await getApiKey();
    if (!key) { RNAlert.alert('Chưa có khoá Claude', 'Vào tab Dữ liệu → "Khoá Claude để đọc ảnh" dán khoá trước.'); return; }
    try {
      setBusy('Đang mở ảnh…');
      const img = await captureImage(src);
      if (!img) { setBusy(null); return; }
      setBusy('Claude đang đọc ảnh, khoảng 20–40 giây…');
      const reading = await readShelfImage(makeClient(key), img);
      const isRx = /ke don|k[eê] ?[dđ][oơ]n/.test(norm(reading.cabinet_label));
      setRxCabinet(isRx);
      setLabel(reading.cabinet_label);
      if (isRx && shelf === 'Kệ 1') setShelf('Tủ kê đơn');
      setProps(proposeFromShelf(data, reading, isRx && shelf === 'Kệ 1' ? 'Tủ kê đơn' : shelf));
    } catch (e) {
      const msg = e instanceof VisionRefusal ? e.message : String((e as Error)?.message ?? e);
      RNAlert.alert('Không đọc được', msg.includes('401') || msg.includes('authentication') ? 'Khoá Claude sai hoặc hết hạn. Kiểm tra lại ở tab Dữ liệu.' : msg);
    } finally { setBusy(null); }
  };

  const cycle = (p: ShelfProposal) => {
    const next: ShelfProposal['action'] = p.action === 'skip' ? (p.match ? 'update' : 'add') : 'skip';
    setProps((cur) => cur!.map((x) => (x.key === p.key ? { ...x, action: next } : x)));
  };
  const relocate = (p: ShelfProposal, location: string) => setProps((cur) => cur!.map((x) => (x.key === p.key ? { ...x, location } : x)));

  const apply = async () => {
    if (!props) return;
    const r = applyShelfProposals(data, props, { rxCabinet });
    await replace({ ...r.ds, source: 'import', importedAt: new Date().toISOString(), fileName: (data.fileName ?? 'dữ liệu').replace(/ \+ ảnh kệ$/, '') + ' + ảnh kệ' });
    RNAlert.alert('Đã cập nhật', `${r.updated} thuốc đổi vị trí, ${r.added} thuốc mới.\n\nNhớ bấm "Xuất dữ liệu đang dùng ra Excel" để giữ bản mới, lần sau nạp Excel cũ sẽ mất.`, [{ text: 'OK', onPress: () => { setProps(null); onClose(); } }]);
  };

  const nUpd = props?.filter((p) => p.action === 'update').length ?? 0;
  const nAdd = props?.filter((p) => p.action === 'add').length ?? 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.top}>
          <Text style={s.title}>Chụp kệ → cập nhật vị trí</Text>
          <Pressable onPress={onClose}><Text style={s.close}>Đóng</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          {!props && (
            <>
              <Label>Tên kệ / tủ đang chụp</Label>
              <TextInput value={shelf} onChangeText={setShelf} style={s.input} placeholder="Kệ 1, Tủ kê đơn, Ngăn kéo 2…" placeholderTextColor={C.muted} />
              <Text style={s.hint}>Ghi đúng nhãn dán trên kệ. Vị trí sẽ thành "{shelf || 'Kệ'} · hàng 2 · trái", hàng đếm từ trên xuống. Chụp thẳng, đủ sáng, mỗi kệ một tấm; kệ cao thì chụp 2 tấm cùng tên kệ.</Text>
              {busy ? (
                <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 24 }}>
                  <ActivityIndicator color={C.accent} />
                  <Text style={{ color: C.ink2 }}>{busy}</Text>
                </Card>
              ) : (
                <View style={{ gap: 8 }}>
                  <Button title="📷  Chụp kệ" onPress={() => scan('camera')} />
                  <Button title="Chọn ảnh có sẵn" onPress={() => scan('library')} ghost />
                </View>
              )}
              <Alert kind="warn">Mỗi tấm tốn vài trăm đồng phí Claude và cần mạng. Kết quả đọc luôn phải dược sĩ xác nhận trước khi lưu.</Alert>
            </>
          )}
          {props && (
            <>
              <Alert kind="ok">Đọc được {props.length} loại hộp{label ? ` · nhãn tủ: "${label}"` : ''}. Chấm vào từng dòng để đổi: ✓ cập nhật vị trí · + thêm thuốc mới · bỏ qua.</Alert>
              {rxCabinet && <Alert kind="warn">Tủ có nhãn kê đơn → thuốc mới thêm từ tủ này sẽ gắn Kê đơn = Có.</Alert>}
              {props.map((p) => (
                <Pressable key={p.key} onPress={() => cycle(p)}>
                  <Card style={[s.row, p.action === 'skip' && { opacity: 0.55 }]}>
                    <View style={[s.box, p.action !== 'skip' && s.boxOn]}><Text style={s.boxText}>{p.action === 'update' ? '✓' : p.action === 'add' ? '+' : ''}</Text></View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={s.name}>{p.read.name}{p.read.strength ? ` · ${p.read.strength}` : ''}{p.read.count > 1 ? ` · ${p.read.count} hộp` : ''}</Text>
                      <Text style={s.sub}>
                        {p.match ? `→ ${p.match.name}${p.exact ? '' : ' (gần giống, kiểm lại)'}` : norm(p.read.name) === 'khong doc duoc' ? 'không đọc được tên' : `thuốc mới${p.read.active ? ` · ${p.read.active}` : ''}`}
                        {p.read.confidence !== 'cao' ? ` · độ chắc ${p.read.confidence}` : ''}
                      </Text>
                      <View style={s.locRow}>
                        <Text style={s.pin}>📍</Text>
                        <TextInput value={p.location} onChangeText={(t) => relocate(p, t)} style={s.locInput} />
                      </View>
                    </View>
                  </Card>
                </Pressable>
              ))}
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Chip text="Bỏ hết dòng chưa chắc" onPress={() => setProps((cur) => cur!.map((x) => (x.read.confidence === 'thấp' ? { ...x, action: 'skip' } : x)))} />
                <Chip text="Chụp lại" onPress={() => setProps(null)} />
              </View>
              <Button title={`Lưu: ${nUpd} đổi vị trí · ${nAdd} thuốc mới`} onPress={apply} disabled={nUpd + nAdd === 0} />
            </>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  title: { fontSize: 18, fontWeight: '700', color: C.ink },
  close: { color: C.accent, fontWeight: '600' },
  body: { padding: 14, gap: 10 },
  input: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: C.ink },
  hint: { fontSize: 12, color: C.muted, lineHeight: 16 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  box: { width: 26, height: 26, borderRadius: 6, borderWidth: 1.5, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  boxOn: { backgroundColor: C.accent, borderColor: C.accent },
  boxText: { color: '#fff', fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '700', color: C.ink },
  sub: { fontSize: 12.5, color: C.ink2 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  pin: { fontSize: 13 },
  locInput: { flex: 1, fontSize: 13, color: C.warn, fontWeight: '700', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.line },
});
