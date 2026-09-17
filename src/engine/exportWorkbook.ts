import { utils as xlsxUtils, write as xlsxWrite } from 'xlsx';
import type { DataSet } from './types';

/** Xuất dữ liệu đang dùng ra Excel cùng cấu trúc file mẫu (4 sheet) */
export function toWorkbookBase64(ds: DataSet): string {
  const wb = xlsxUtils.book_new();
  const drugs = ds.drugs.map((d) => ({ 'Tên thuốc': d.name, 'Hoạt chất': d.active, mg: d.mgText, 'Dạng': d.form, 'Hãng': d.brand, 'Đối tượng': d.audience, 'Còn hàng': d.inStock ? 'Có' : 'Hết', 'Kê đơn': d.rx ? 'Có' : '', 'Vị trí': d.location, 'Ghi chú': d.note }));
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

