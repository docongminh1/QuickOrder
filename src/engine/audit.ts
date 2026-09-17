import { norm } from './normalize';
import type { DataSet } from './types';

export interface AuditItem { level: 'warn' | 'info'; text: string }

/** Soát dữ liệu hộ dược sĩ: những chỗ app sẽ lúng túng khi nhân viên dùng */
export function auditDataSet(ds: DataSet): AuditItem[] {
  const out: AuditItem[] = [];
  const byActive = new Map<string, { any: number; usable: number }>();
  for (const d of ds.drugs) {
    const k = norm(d.active);
    const cur = byActive.get(k) ?? { any: 0, usable: 0 };
    cur.any++;
    if (d.inStock && !d.rx) cur.usable++;
    byActive.set(k, cur);
  }
  // hoạt chất trong luật nhưng không có thuốc bán được
  const seenAct = new Set<string>();
  for (const r of ds.rules) {
    const k = norm(r.active);
    if (seenAct.has(k)) continue;
    seenAct.add(k);
    const c = byActive.get(k);
    if (c && c.usable === 0) out.push({ level: 'warn', text: `Hoạt chất "${r.active}" chỉ có thuốc hết hàng hoặc kê đơn → dòng luật này sẽ báo "hết / hỏi dược sĩ".` });
  }
  // triệu chứng chỉ có luật cho 1 đối tượng
  const symAud = new Map<string, Set<string>>();
  for (const r of ds.rules) {
    const k = norm(r.symptom);
    const set = symAud.get(k) ?? new Set<string>();
    set.add(r.audience);
    symAud.set(k, set);
  }
  const onlyAdult: string[] = []; const onlyChild: string[] = []; const none: string[] = [];
  for (const s of ds.symptoms) {
    const set = symAud.get(norm(s.name));
    if (!set) none.push(s.name);
    else if (!set.has('Trẻ em')) onlyAdult.push(s.name);
    else if (!set.has('Người lớn')) onlyChild.push(s.name);
  }
  if (none.length) out.push({ level: 'warn', text: `Triệu chứng chưa có luật nào: ${none.join(', ')}.` });
  if (onlyAdult.length) out.push({ level: 'info', text: `Chỉ có luật Người lớn (trẻ em sẽ báo "hỏi dược sĩ"): ${onlyAdult.join(', ')}.` });
  if (onlyChild.length) out.push({ level: 'info', text: `Chỉ có luật Trẻ em: ${onlyChild.join(', ')}.` });
  // luật theo kg mà không có tối đa
  const noMax = ds.rules.filter((r) => r.mgPerKg !== null && r.maxAbs === null && r.maxPerKg === null);
  if (noMax.length) out.push({ level: 'info', text: `${noMax.length} dòng luật tính theo kg nhưng chưa có Tối đa mg/ngày (dòng ${noMax.slice(0, 6).map((r) => r.row).join(', ')}${noMax.length > 6 ? '…' : ''}).` });
  // thuốc không nằm trong bài nào
  const ruleActs = new Set(ds.rules.map((r) => norm(r.active)));
  const unused = ds.drugs.filter((d) => !ruleActs.has(norm(d.active)) && d.inStock && !d.rx).map((d) => d.name);
  if (unused.length) out.push({ level: 'info', text: `Thuốc còn hàng nhưng chưa có bài nào dùng (chỉ tra được, không tự gợi ý): ${unused.slice(0, 8).join(', ')}${unused.length > 8 ? ` +${unused.length - 8}` : ''}.` });
  const noLoc = ds.drugs.filter((d) => d.inStock && !d.location).map((d) => d.name);
  if (noLoc.length) out.push({ level: 'info', text: `Chưa ghi Vị trí kệ cho ${noLoc.length} thuốc còn hàng: ${noLoc.slice(0, 8).join(', ')}${noLoc.length > 8 ? ` +${noLoc.length - 8}` : ''}. Nhân viên mới sẽ không biết lấy ở đâu.` });
  const nameCount = new Map<string, number>();
  for (const d of ds.drugs) nameCount.set(norm(d.name), (nameCount.get(norm(d.name)) ?? 0) + 1);
  const dup = [...nameCount.entries()].filter(([, c]) => c > 1).map(([n]) => ds.drugs.find((d) => norm(d.name) === n)!.name);
  if (dup.length) out.push({ level: 'warn', text: `Tên thuốc bị trùng (Tra thuốc và cập nhật vị trí sẽ lẫn): ${dup.join(', ')}. Ghi thêm hàm lượng vào tên để phân biệt.` });
  const badMg = ds.drugs.filter((d) => !d.isCombo && d.mgText && d.mg === null).map((d) => `${d.name} ("${d.mgText}")`);
  if (badMg.length) out.push({ level: 'warn', text: `Cột mg có chữ app không đọc được số → không tính ra số viên/gói: ${badMg.slice(0, 6).join(', ')}${badMg.length > 6 ? ` +${badMg.length - 6}` : ''}. Ghi số thuần, vd 500 hoặc 12,5.` });
  const noTimes = ds.rules.filter((r) => (r.mgPerKg !== null || r.mgFixed !== null) && r.timesMax === null).map((r) => `dòng ${r.row}`);
  if (noTimes.length) out.push({ level: 'warn', text: `Luật có liều nhưng cột Lần/ngày không có số (không tính được tổng, không kiểm được tối đa): ${noTimes.slice(0, 8).join(', ')}.` });
  // triệu chứng không có từ khách hay nói
  const noSyn = ds.symptoms.filter((s) => s.synonyms.length === 0).map((s) => s.name);
  if (noSyn.length) out.push({ level: 'info', text: `Chưa có cột "Khách hay nói" cho: ${noSyn.slice(0, 8).join(', ')}${noSyn.length > 8 ? ` +${noSyn.length - 8}` : ''}. Nhân viên chỉ tìm được theo tên chip.` });
  return out;
}
