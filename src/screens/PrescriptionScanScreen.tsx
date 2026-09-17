import React, { useState } from 'react';
import { ActivityIndicator, Alert as RNAlert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeClient, proposeFromPrescription, readPrescriptionImage, VisionRefusal, type RxProposal } from '../engine/vision';
import { suggestDrugs } from '../engine/lookup';
import { getApiKey } from '../store/apiKey';
import { useData } from '../store/DataContext';
import { captureImage } from '../ui/capture';
import { Alert, Button, Card } from '../ui/bits';
import { C, R } from '../ui/theme';

export default function PrescriptionScanScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { data } = useData();
  const [busy, setBusy] = useState<string | null>(null);
  const [props, setProps] = useState<RxProposal[] | null>(null);
  const [note, setNote] = useState('');
  const [kind, setKind] = useState('');

  const scan = async (src: 'camera' | 'library') => {
    const key = await getApiKey();
    if (!key) { RNAlert.alert('Chưa có khoá Claude', 'Vào tab Dữ liệu → "Khoá Claude để đọc ảnh" dán khoá trước.'); return; }
    try {
      setBusy('Đang mở ảnh…');
      const img = await captureImage(src);
      if (!img) { setBusy(null); return; }
      setBusy('Claude đang đọc, khoảng 20–40 giây…');
      const reading = await readPrescriptionImage(makeClient(key), img);
      setNote(reading.note); setKind(reading.kind);
      setProps(proposeFromPrescription(data, reading));
    } catch (e) {
      const msg = e instanceof VisionRefusal ? e.message : String((e as Error)?.message ?? e);
      RNAlert.alert('Không đọc được', msg.includes('401') || msg.includes('authentication') ? 'Khoá Claude sai hoặc hết hạn. Kiểm tra lại ở tab Dữ liệu.' : msg);
    } finally { setBusy(null); }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.top}>
          <Text style={s.title}>Đọc toa / hộp thuốc khách đưa</Text>
          <Pressable onPress={onClose}><Text style={s.close}>Đóng</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={s.body}>
          {!props && (
            <>
              <Text style={s.hint}>Chụp toa bác sĩ hoặc hộp thuốc khách cầm tới. App chỉ đọc tên và số lượng ghi trên đó rồi chỉ chỗ lấy, KHÔNG tự tính liều. Đọc xong phải hỏi lại khách "đúng thuốc này không?".</Text>
              {busy ? (
                <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 24 }}>
                  <ActivityIndicator color={C.accent} />
                  <Text style={{ color: C.ink2 }}>{busy}</Text>
                </Card>
              ) : (
                <View style={{ gap: 8 }}>
                  <Button title="📷  Chụp toa / hộp thuốc" onPress={() => scan('camera')} />
                  <Button title="Chọn ảnh có sẵn" onPress={() => scan('library')} ghost />
                </View>
              )}
              <Alert kind="warn">Toa viết tay dễ đọc sai. Dòng nào "độ chắc thấp" → hỏi khách hoặc gọi dược sĩ, không đoán.</Alert>
            </>
          )}
          {props && (
            <>
              <Alert kind="ok">Ảnh là {kind}. Đọc được {props.length} thuốc.{note ? ` Ghi chú: ${note}` : ''}</Alert>
              {props.map((p, i) => (
                <Card key={i} style={{ gap: 4, borderColor: p.match ? (p.match.inStock ? C.line : C.danger) : C.warn, borderWidth: p.match?.inStock ? 1 : 1.5 }}>
                  <Text style={s.read}>Toa ghi: <Text style={{ fontWeight: '700' }}>{p.read.name}{p.read.strength ? ` ${p.read.strength}` : ''}</Text>{p.read.quantity ? ` · ${p.read.quantity}` : ''}{p.read.confidence !== 'cao' ? `  (độ chắc ${p.read.confidence})` : ''}</Text>
                  {p.read.instruction ? <Text style={s.instr}>Cách dùng trên toa: {p.read.instruction}</Text> : null}
                  {p.match ? (
                    <>
                      <Text style={s.name}>{p.match.name}{p.match.mgText ? ` · ${p.match.mgText} mg` : ''}{p.exact ? '' : '  (gần giống, hỏi lại khách)'}</Text>
                      {p.match.rx ? <Text style={s.warn}>Thuốc kê đơn: chỉ bán khi có toa hợp lệ, hỏi dược sĩ.</Text> : null}
                      {p.match.inStock ? (
                        <Text style={s.loc}>📍 {p.match.location || 'chưa ghi vị trí, hỏi dược sĩ'}</Text>
                      ) : (
                        <Text style={s.danger}>Hết hàng.{p.alternatives.length ? ` Cùng hoạt chất còn: ${p.alternatives.map((d) => `${d.name}${d.location ? ` (${d.location})` : ''}`).join(', ')} → hỏi dược sĩ trước khi đổi.` : ' Chưa có thuốc thay, hỏi dược sĩ.'}</Text>
                      )}
                    </>
                  ) : (
                    <>
                      <Text style={s.danger}>Chưa có ở quầy.</Text>
                      {suggestDrugs(data, p.read.name).length > 0 && <Text style={s.sub}>Có phải: {suggestDrugs(data, p.read.name).slice(0, 3).map((d) => d.name).join(', ')}?</Text>}
                      <Text style={s.sub}>Trả lời khách: "Dạ thuốc này em chưa có". Không tự thay thuốc trên toa, hỏi dược sĩ.</Text>
                    </>
                  )}
                </Card>
              ))}
              <Button title="Chụp toa khác" onPress={() => setProps(null)} ghost />
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
  hint: { fontSize: 13, color: C.ink2, lineHeight: 18 },
  read: { fontSize: 13, color: C.ink2 },
  instr: { fontSize: 12.5, color: C.muted, fontStyle: 'italic' },
  name: { fontSize: 17, fontWeight: '700', color: C.ink },
  loc: { fontSize: 15, fontWeight: '800', color: C.warn },
  warn: { fontSize: 13, color: C.danger, fontWeight: '600' },
  danger: { fontSize: 14, color: C.danger, fontWeight: '600' },
  sub: { fontSize: 12.5, color: C.muted },
});
