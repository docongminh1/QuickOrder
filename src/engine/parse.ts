import type { WorkBook } from 'xlsx';
import { utils } from 'xlsx';
import { norm, text, num, times, maxPerDay, splitActives } from './normalize';
import type { Audience, DataSet, Drug, DrugAudience, ImportError, RedFlag, Rule, Symptom } from './types';

/** Bản ghi thô với khoá chuẩn — dùng chung cho Excel và JSON mẫu. */
export interface RawDrug { name: unknown; active: unknown; mg: unknown; form: unknown; brand?: unknown; audience?: unknown; inStock?: unknown; rx?: unknown; note?: unknown }
export interface RawRule {
  symptom: unknown; audience: unknown; group?: unknown; active: unknown; mgPerKg?: unknown; mgFixed?: unknown;
  timesPerDay?: unknown; maxPerDay?: unknown; freeText?: unknown; howTo?: unknown; warning?: unknown; priority?: unknown;
}
export interface RawSymptom { name: unknown; group?: unknown; order?: unknown; synonyms?: unknown }
export interface RawFlag { text: unknown; audience?: unknown; action?: unknown }

const SHEET = { drugs: 'Thuốc', rules: 'Luật cắt liều', symptoms: 'Triệu chứng', flags: 'Dấu hiệu nguy hiểm' };

const DRUG_COLS: Record<string, keyof RawDrug> = {
  'ten thuoc': 'name', 'hoat chat': 'active', 'mg': 'mg', 'dang': 'form', 'hang': 'brand', 'doi tuong': 'audience', 'con hang': 'inStock', 'ke don': 'rx', 'ghi chu': 'note',
};
const RULE_COLS: Record<string, keyof RawRule> = {
  'trieu chung': 'symptom', 'doi tuong': 'audience', 'nhom': 'group', 'hoat chat': 'active', 'mg/kg/lan': 'mgPerKg',
  'mg co dinh/lan': 'mgFixed', 'lan/ngay': 'timesPerDay', 'toi da mg/ngay': 'maxPerDay', 'lieu ghi tay': 'freeText',
  'cach uong': 'howTo', 'canh bao': 'warning', 'uu tien': 'priority',
};
const SYM_COLS: Record<string, keyof RawSymptom> = { 'trieu chung': 'name', 'nhom hien thi': 'group', 'thu tu': 'order', 'khach hay noi': 'synonyms' };
const FLAG_COLS: Record<string, keyof RawFlag> = { 'dau hieu': 'text', 'doi tuong': 'audience', 'lam gi': 'action' };

/** Cờ đỏ mặc định khi file Excel không có sheet Dấu hiệu nguy hiểm */
export const DEFAULT_RED_FLAGS: RedFlag[] = [
  { text: 'Khó thở, thở gấp, thở rít', audience: 'Cả hai', action: 'Đi khám ngay. Không bán thuốc.' },
  { text: 'Đau ngực, tức ngực', audience: 'Cả hai', action: 'Đi khám ngay.' },
  { text: 'Sốt trên 39,5° không hạ / sốt co giật', audience: 'Cả hai', action: 'Đi cấp cứu.' },
  { text: 'Trẻ dưới 3 tháng tuổi bị sốt', audience: 'Trẻ em', action: 'Đi khám ngay, không tự hạ sốt.' },
  { text: 'Trẻ lừ đừ, bỏ bú, khóc không dỗ được', audience: 'Trẻ em', action: 'Đi khám ngay.' },
  { text: 'Nôn ra máu / đi cầu ra máu / phân đen', audience: 'Cả hai', action: 'Đi khám ngay.' },
  { text: 'Đau bụng dữ dội, bụng cứng', audience: 'Cả hai', action: 'Đi khám ngay, không cho thuốc giảm đau.' },
  { text: 'Bệnh đã kéo dài trên 1 tuần, uống thuốc không đỡ', audience: 'Cả hai', action: 'Khuyên đi khám, không cắt tiếp.' },
];

function audienceOf(v: unknown): DrugAudience | null {
  const n = norm(v);
  if (n === 'nguoi lon' || n === 'nl' || n === 'adult') return 'Người lớn';
  if (n === 'tre em' || n === 'te' || n === 'child') return 'Trẻ em';
  if (n === 'ca hai' || n === '' || n === 'both') return 'Cả hai';
  return null;
}

export function buildDataSet(
  drugsRaw: { row: number; r: RawDrug }[],
  rulesRaw: { row: number; r: RawRule }[],
  symsRaw: { row: number; r: RawSymptom }[],
  meta: Pick<DataSet, 'source' | 'importedAt' | 'fileName'>,
  flagsRaw: { row: number; r: RawFlag }[] = [],
): DataSet {
  const errors: ImportError[] = [];
  const drugs: Drug[] = [];
  for (const { row, r } of drugsRaw) {
    const name = text(r.name);
    const active = text(r.active);
    const form = text(r.form);
    if (!name && !active) continue; // dòng trống
    if (!name || !active || !form) {
      errors.push({ sheet: SHEET.drugs, row, message: 'thiếu Tên thuốc, Hoạt chất hoặc Dạng.' });
      continue;
    }
    const aud = audienceOf(r.audience);
    if (!aud) {
      errors.push({ sheet: SHEET.drugs, row, message: `Đối tượng "${text(r.audience)}" không hợp lệ (Người lớn / Trẻ em / Cả hai).` });
      continue;
    }
    const actives = splitActives(active);
    const note = text(r.note);
    const stockTxt = norm(r.inStock);
    const inStock = !(stockTxt === 'het' || stockTxt === 'khong' || stockTxt === 'chua co' || stockTxt === 'chua nhap' || stockTxt === '0' || stockTxt === 'no');
    const rxTxt = norm(r.rx);
    const rx = rxTxt === 'co' || rxTxt === 'x' || rxTxt === 'yes' || rxTxt === '1' || rxTxt === 'true' || norm(note).includes('ke don');
    drugs.push({
      name, active, actives, isCombo: actives.length > 1,
      mg: actives.length > 1 ? null : num(r.mg), mgText: text(r.mg), form, brand: text(r.brand), audience: aud, inStock, rx, note,
    });
  }
  const activeSet = new Set(drugs.map((d) => norm(d.active)));

  const rules: Rule[] = [];
  for (const { row, r } of rulesRaw) {
    const symptom = text(r.symptom);
    const active = text(r.active);
    if (!symptom && !active) continue;
    const aud = audienceOf(r.audience);
    if (!symptom || !active) {
      errors.push({ sheet: SHEET.rules, row, message: 'thiếu Triệu chứng hoặc Hoạt chất.' });
      continue;
    }
    if (!aud || aud === 'Cả hai') {
      errors.push({ sheet: SHEET.rules, row, message: 'Đối tượng phải là Người lớn hoặc Trẻ em.' });
      continue;
    }
    if (!activeSet.has(norm(active))) {
      errors.push({ sheet: SHEET.rules, row, message: `hoạt chất "${active}" không có trong sheet Thuốc. Kiểm tra chính tả.` });
      continue;
    }
    const mgPerKg = num(r.mgPerKg);
    const mgFixed = num(r.mgFixed);
    const mgFixedText = text(r.mgFixed);
    const freeText = text(r.freeText);
    if (mgPerKg !== null && mgFixed !== null) {
      errors.push({ sheet: SHEET.rules, row, message: 'điền cả mg/kg/lần và mg cố định/lần. Chỉ điền một cột.' });
      continue;
    }
    if (mgPerKg === null && !mgFixedText && !freeText) {
      errors.push({ sheet: SHEET.rules, row, message: 'thiếu mg/kg/lần, mg cố định/lần hoặc Liều ghi tay.' });
      continue;
    }
    const t = times(r.timesPerDay);
    const mx = maxPerDay(r.maxPerDay);
    rules.push({
      row, symptom, audience: aud as Audience, group: text(r.group) || active, active,
      mgPerKg, mgFixed, mgFixedText, timesLabel: t.label, timesMax: t.max, maxAbs: mx.abs, maxPerKg: mx.perKg,
      freeText, howTo: text(r.howTo), warning: text(r.warning), priority: num(r.priority) ?? 99,
    });
  }

  const symptoms: Symptom[] = [];
  const seen = new Set<string>();
  for (const { r } of symsRaw) {
    const name = text(r.name);
    if (!name || seen.has(norm(name))) continue;
    seen.add(norm(name));
    symptoms.push({ name, group: text(r.group) || 'Khác', order: num(r.order) ?? 999, synonyms: text(r.synonyms).split(/[,;\n]/).map((x) => x.trim()).filter(Boolean) });
  }
  // triệu chứng có luật nhưng chưa có trong sheet → tự thêm
  for (const rule of rules) {
    if (!seen.has(norm(rule.symptom))) {
      seen.add(norm(rule.symptom));
      symptoms.push({ name: rule.symptom, group: 'Khác', order: 999, synonyms: [] });
    }
  }
  symptoms.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'vi'));

  const redFlags: RedFlag[] = [];
  for (const { r } of flagsRaw) {
    const t = text(r.text);
    if (!t) continue;
    redFlags.push({ text: t, audience: audienceOf(r.audience) ?? 'Cả hai', action: text(r.action) || 'Hỏi dược sĩ / khuyên đi khám.' });
  }

  return { ...meta, drugs, rules, symptoms, redFlags: redFlags.length ? redFlags : DEFAULT_RED_FLAGS, errors };
}

// ------------------------------------------------------------------ Excel
function findSheet(wb: WorkBook, wanted: string): string | null {
  const w = norm(wanted);
  return wb.SheetNames.find((n) => norm(n) === w) ?? wb.SheetNames.find((n) => norm(n).includes(w.split(' ')[0])) ?? null;
}

function rowsOf<T>(wb: WorkBook, sheetName: string | null, cols: Record<string, keyof T>, errors: ImportError[], label: string): { row: number; r: T }[] {
  if (!sheetName) {
    errors.push({ sheet: label, row: 0, message: `không tìm thấy sheet "${label}".` });
    return [];
  }
  const ws = wb.Sheets[sheetName];
  const grid: unknown[][] = utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  if (grid.length === 0) return [];
  const header = grid[0].map((h) => norm(h));
  const idx: Partial<Record<keyof T, number>> = {};
  header.forEach((h, i) => {
    const key = cols[h];
    if (key !== undefined && idx[key] === undefined) idx[key] = i;
  });
  const out: { row: number; r: T }[] = [];
  for (let i = 1; i < grid.length; i++) {
    const line = grid[i];
    if (!line || line.every((c) => text(c) === '')) continue;
    const firstCell = line.map((c) => text(c)).find((c) => c !== '') ?? '';
    if (firstCell.startsWith('↳')) continue; // dòng ví dụ trong file mẫu
    const r = {} as T;
    (Object.keys(cols) as string[]).forEach((h) => {
      const key = cols[h];
      const at = idx[key];
      (r as Record<string, unknown>)[key as string] = at === undefined ? '' : line[at];
    });
    out.push({ row: i + 1, r });
  }
  return out;
}

export function parseWorkbook(wb: WorkBook, fileName: string): DataSet {
  const errors: ImportError[] = [];
  const drugs = rowsOf<RawDrug>(wb, findSheet(wb, SHEET.drugs), DRUG_COLS, errors, SHEET.drugs);
  const rules = rowsOf<RawRule>(wb, findSheet(wb, SHEET.rules), RULE_COLS, errors, SHEET.rules);
  const syms = rowsOf<RawSymptom>(wb, findSheet(wb, SHEET.symptoms), SYM_COLS, errors, SHEET.symptoms);
  const flagSheet = findSheet(wb, SHEET.flags);
  const flags = flagSheet ? rowsOf<RawFlag>(wb, flagSheet, FLAG_COLS, errors, SHEET.flags) : []; // không có sheet này thì dùng mặc định, không báo lỗi
  const ds = buildDataSet(drugs, rules, syms, { source: 'import', importedAt: new Date().toISOString(), fileName }, flags);
  ds.errors = [...errors, ...ds.errors];
  return ds;
}

// ------------------------------------------------------------------ JSON mẫu
export function fromSample(sample: { drugs: RawDrug[]; rules: RawRule[]; symptoms: RawSymptom[]; redFlags?: RawFlag[] }): DataSet {
  const wrap = <T,>(arr: T[]) => arr.map((r, i) => ({ row: i + 2, r }));
  return buildDataSet(wrap(sample.drugs), wrap(sample.rules), wrap(sample.symptoms), { source: 'sample' }, wrap(sample.redFlags ?? []));
}

/** Lọc chip theo lời khách nói: khớp theo TỪ (không phải chuỗi con) để "ho" không dính "cho", "ói" không dính "người" */
export function matchSymptoms(symptoms: Symptom[], query: string): Symptom[] {
  const q = norm(query);
  if (!q) return symptoms;
  const qWords = q.split(' ').filter(Boolean);
  const wordHit = (w: string, hayWords: string[]) => hayWords.some((h) => (w.length <= 3 ? h === w : h.startsWith(w)));
  const scored: { s: Symptom; score: number }[] = [];
  for (const s of symptoms) {
    const phrases = [s.name, ...s.synonyms].map(norm);
    let best = 0;
    for (const ph of phrases) {
      if (ph === q) { best = Math.max(best, 3); continue; }
      const hayWords = ph.split(' ').filter(Boolean);
      if ((' ' + ph + ' ').includes(' ' + q + ' ') || (' ' + ph).includes(' ' + q)) { best = Math.max(best, 2); continue; }
      const matched = qWords.filter((w) => wordHit(w, hayWords)).length;
      if (matched === qWords.length || (matched >= 2 && matched / qWords.length >= 0.6)) best = Math.max(best, 1 + matched / qWords.length / 2);
    }
    if (best > 0) scored.push({ s, score: best });
  }
  return scored.sort((a, b) => b.score - a.score).map((x) => x.s);
}
