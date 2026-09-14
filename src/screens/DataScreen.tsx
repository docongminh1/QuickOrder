import React, { useState } from 'react';
import { Alert as RNAlert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { read as xlsxRead, utils as xlsxUtils, write as xlsxWrite } from 'xlsx';
import { parseWorkbook } from '../engine/parse';
import { auditDataSet } from '../engine/audit';
import type { DataSet } from '../engine/types';
import { TEMPLATE_BASE64 } from '../data/templateBase64';
import { useData } from '../store/DataContext';
import { Alert, Button, Card, Label } from '../ui/bits';
import { C, R } from '../ui/theme';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function shareBase64(base64: string, fileName: string) {
  const f = new File(Paths.cache, fileName);
  if (f.exists) f.delete();
  f.create();
  f.write(base64, { encoding: 'base64' });
  if (!(await Sharing.isAvailableAsync())) {
    RNAlert.alert('Không chia sẻ được', `File đã lưu tại ${f.uri}`);
    return;
  }
  await Sharing.shareAsync(f.uri, { mimeType: XLSX_MIME, dialogTitle: fileName, UTI: 'org.openxmlformats.spreadsheetml.sheet' });
}

function toWorkbookBase64(ds: DataSet): string {
  const wb = xlsxUtils.book_new();
  const drugs = ds.drugs.map((d) => ({ 'Tên thuốc': d.name, 'Hoạt chất': d.active, mg: d.mgText, 'Dạng': d.form, 'Hãng': d.brand, 'Đối tượng': d.audience, 'Còn hàng': d.inStock ? 'Có' : 'Hết', 'Kê đơn': d.rx ? 'Có' : '', 'Ghi chú': d.note }));
  const rules = ds.rules.map((r) => ({
    'Triệu chứng': r.symptom, 'Đối tượng': r.audience, 'Nhóm': r.group, 'Hoạt chất': r.active,
    'mg/kg/lần': r.mgPerKg ?? '', 'mg cố định/lần': r.mgFixedText, 'Lần/ngày': r.timesLabel.replace('–', '-'),
    'Tối đa mg/ngày': r.maxAbs ?? (r.maxPerKg !== null ? `${r.maxPerKg}/kg` : ''), 'Liều ghi tay': r.freeText,
    'Cách uống': r.howTo, 'Cảnh báo': r.warning, 'Ưu tiên': r.priority,
  }));
  const syms = ds.symptoms.map((x) => ({ 'Triệu chứng': x.name, 'Nhóm hiển thị': x.group, 'Thứ tự': x.order, 'Khách hay nói': x.synonyms.join(', ') }));
  const flags = ds.redFlags.map((f) => ({ 'Dấu hiệu': f.text, 'Đối tượng': f.audience, 'Làm gì': f.action }));
  xlsxUtils.book_append_sheet(wb, xlsxUtils.json_to_sheet(drugs), 'Thuốc');
  xlsxUtils.book_append_sheet(wb, xlsxUtils.json_to_sheet(rules), 'Luật cắt liều');
  xlsxUtils.book_append_sheet(wb, xlsxUtils.json_to_sheet(syms), 'Triệu chứng');
  xlsxUtils.book_append_sheet(wb, xlsxUtils.json_to_sheet(flags), 'Dấu hiệu nguy hiểm');
  return xlsxWrite(wb, { type: 'base64', bookType: 'xlsx' });
}

export default function DataScreen() {
  const { data, replace, resetToSample } = useData();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [lastMsg, setLastMsg] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const audit = auditDataSet(data);
  const auditWarn = audit.filter((a) => a.level === 'warn').length;

  const pick = async () => {
    setBusy(true); setLastMsg(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: [XLSX_MIME, 'application/vnd.ms-excel', '*/*'], copyToCacheDirectory: true, multiple: false });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      const b64 = await new File(asset.uri).base64();
      const wb = xlsxRead(b64, { type: 'base64' });
      const ds = parseWorkbook(wb, asset.name);
      if (ds.drugs.length === 0 && ds.rules.length === 0) {
        RNAlert.alert('Không nạp được', ds.errors[0]?.message ?? 'File không có sheet Thuốc / Luật cắt liều. Dùng file mẫu để điền.');
        return;
      }
      await replace(ds);
      setLastMsg(`Đã nạp ${asset.name}: ${ds.drugs.length} thuốc, ${ds.rules.length} luật, ${ds.symptoms.length} triệu chứng.`);
    } catch (e) {
      RNAlert.alert('Lỗi khi nạp', String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const shareTemplate = () => shareBase64(TEMPLATE_BASE64, 'CatLieuNhanh_mau.xlsx').catch((e) => RNAlert.alert('Lỗi', String(e)));
  const exportCurrent = () => shareBase64(toWorkbookBase64(data), 'CatLieuNhanh_dang_dung.xlsx').catch((e) => RNAlert.alert('Lỗi', String(e)));
  const reset = () =>
    RNAlert.alert('Về dữ liệu mẫu?', 'Dữ liệu bạn đã nạp sẽ bị bỏ, quay lại bộ mẫu có sẵn trong app.', [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Về mẫu', style: 'destructive', onPress: () => resetToSample() },
    ]);

  const when = data.importedAt ? new Date(data.importedAt) : null;
  const whenTxt = when ? `${when.getDate()}/${when.getMonth() + 1} · ${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}` : '';

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.top}><Text style={s.title}>Dữ liệu</Text></View>
      <ScrollView contentContainerStyle={s.body}>
        <Pressable onPress={pick} disabled={busy} style={({ pressed }) => [s.big, pressed && { opacity: 0.8 }]}>
          <Text style={s.bigTitle}>{busy ? 'Đang đọc…' : '⇪  Nạp file Excel'}</Text>
          <Text style={s.bigSub}>chọn file .xlsx từ máy, Drive hoặc Zalo</Text>
        </Pressable>
        {lastMsg && <Alert kind="ok">{lastMsg}</Alert>}

        <Label right={data.source === 'sample' ? 'bộ mẫu trong app' : `nạp ${whenTxt}`}>Đang dùng</Label>
        {data.source === 'import' && data.fileName ? <Text style={s.file}>{data.fileName}</Text> : null}
        <View style={s.stats}>
          <Stat n={data.drugs.length} label="thuốc ở quầy" />
          <Stat n={data.symptoms.length} label="triệu chứng" />
          <Stat n={data.rules.length} label="dòng luật cắt liều" />
          <Stat n={data.errors.length} label="dòng bị bỏ qua" bad={data.errors.length > 0} />
        </View>
        <Pressable onPress={() => setShowAudit((v) => !v)}>
          <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontWeight: '700', color: auditWarn ? C.warn : C.ink }}>Soát dữ liệu cho dược sĩ · {audit.length} ghi chú{auditWarn ? ` · ${auditWarn} cần xem` : ''}</Text>
            <Text style={{ color: C.muted }}>{showAudit ? '▲' : '▼'}</Text>
          </Card>
        </Pressable>
        {showAudit && audit.map((a, i) => <Alert key={i} kind={a.level === 'warn' ? 'warn' : 'ok'}>{a.text}</Alert>)}
        {showAudit && audit.length === 0 && <Alert kind="ok">Không thấy gì bất thường.</Alert>}

        {data.errors.length > 0 && (
          <>
            <Label>Dòng bị bỏ qua và vì sao</Label>
            {data.errors.slice(0, 30).map((e, i) => (
              <Alert key={i} kind="danger">{e.row ? `Dòng ${e.row}, sheet ${e.sheet}: ` : `Sheet ${e.sheet}: `}{e.message}</Alert>
            ))}
            {data.errors.length > 30 && <Text style={s.more}>… và {data.errors.length - 30} dòng nữa</Text>}
            <Alert kind="ok">Các dòng còn lại đã nạp và đang chạy. Sửa dòng lỗi trong Excel rồi nạp lại.</Alert>
          </>
        )}

        <Label>File mẫu</Label>
        <Card style={{ gap: 10 }}>
          <Text style={s.help}>File Excel có 4 sheet: Thuốc (kèm Còn hàng, Kê đơn), Luật cắt liều, Triệu chứng (kèm Khách hay nói), Dấu hiệu nguy hiểm, và sheet Hướng dẫn. Sửa theo quầy mình rồi nạp lại.</Text>
          <Button title="⬇  Tải file Excel mẫu" onPress={shareTemplate} />
          <Button title="Xuất dữ liệu đang dùng ra Excel" onPress={exportCurrent} ghost />
        </Card>

        {data.source === 'import' && (
          <Pressable onPress={reset}><Text style={s.reset}>Về dữ liệu mẫu</Text></Pressable>
        )}
        <Text style={s.foot}>Dữ liệu nằm trong máy này, không gửi đi đâu. Xoá app thì mất, nạp lại là xong.{Platform.OS === 'ios' ? '' : ''}</Text>
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

function Stat({ n, label, bad }: { n: number; label: string; bad?: boolean }) {
  return (
    <Card style={s.stat}>
      <Text style={[s.statN, bad && { color: C.danger }]}>{n}</Text>
      <Text style={s.statL}>{label}</Text>
    </Card>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  top: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  title: { fontSize: 20, fontWeight: '700', color: C.ink },
  body: { padding: 14, gap: 10 },
  big: { backgroundColor: C.surface, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.accent, borderRadius: R.lg, paddingVertical: 22, alignItems: 'center', gap: 4 },
  bigTitle: { fontSize: 17, fontWeight: '700', color: C.accent },
  bigSub: { fontSize: 13, color: C.muted },
  file: { fontSize: 13, color: C.ink2 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { width: '48%', flexGrow: 1 },
  statN: { fontSize: 22, fontWeight: '700', color: C.ink, fontVariant: ['tabular-nums'] },
  statL: { fontSize: 12.5, color: C.muted },
  more: { fontSize: 13, color: C.muted, textAlign: 'center' },
  help: { fontSize: 14, color: C.ink2, lineHeight: 20 },
  reset: { color: C.danger, textAlign: 'center', paddingVertical: 8, fontWeight: '600' },
  foot: { fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 4 },
});
