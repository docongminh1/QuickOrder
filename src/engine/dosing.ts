import { fmtMg, fmtUnits, norm } from './normalize';
import type { Audience, DataSet, Drug, Rule } from './types';

export interface DoseItem {
  key: string;
  group: string;
  active: string;
  symptoms: string[];      // triệu chứng nào kéo dòng này ra
  drug: Drug | null;       // thuốc ở quầy được chọn
  alternatives: Drug[];    // thuốc khác cùng hoạt chất
  doseLine: string;        // "1 gói / lần · 3–4 lần/ngày"
  howTo: string;
  calcLine: string | null; // "20 kg × 12,5 mg/kg = 250 mg → 1 gói"
  needsWeight: boolean;
  capped: boolean;
  orLines: string[];       // luật khác cùng Nhóm, hiện "Cách khác: ..."
  warning: string;
  totalLine: string | null; // "Cắt đủ 3 ngày: 12 gói"
  rxOnly: boolean;         // hoạt chất chỉ có thuốc kê đơn
  outOfStock: boolean;     // hoạt chất có trong sheet nhưng hết hàng hết
  priority: number;        // ưu tiên nhỏ nhất của nhóm (1 = chính)
}

export interface DoseResult {
  items: DoseItem[];
  warnings: string[];
  noRule: string[];        // triệu chứng chọn mà không có luật cho đối tượng này
  needsWeight: boolean;    // có luật theo kg mà chưa nhập cân
}

// viên: có thể bẻ ¼ ½; gói / ống / viên sủi / viên ngậm: không bẻ nhỏ hơn ½
const UNITS_TABLET = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
const UNITS_SACHET = [0.5, 1, 1.5, 2, 3, 4];

function unitName(form: string): string {
  const f = norm(form);
  if (f.startsWith('vien')) return form.toLowerCase().includes('ngậm') ? 'viên' : 'viên';
  if (f === 'goi') return 'gói';
  if (f === 'siro') return 'ml';
  if (f === 'ong') return 'ống';
  return form || 'đơn vị';
}

/** Số đơn vị cho 1 lần uống với thuốc có hàm lượng `strength`. Siro: mg/5ml → ml. */
function unitsFor(mg: number, drug: Drug): { units: number; label: string; err: number; isSyrup: boolean } | null {
  if (!drug.mg || drug.mg <= 0) return null;
  const isSyrup = norm(drug.form) === 'siro';
  if (isSyrup) {
    const ml = (mg / drug.mg) * 5;
    const r = Math.max(0.5, Math.round(ml * 2) / 2);
    return { units: r, label: `${String(r).replace('.', ',')} ml`, err: Math.abs(r - ml) / ml, isSyrup: true };
  }
  const raw = mg / drug.mg;
  const table = norm(drug.form) === 'vien' ? UNITS_TABLET : UNITS_SACHET;
  let best = table[0];
  for (const u of table) if (Math.abs(u - raw) < Math.abs(best - raw)) best = u;
  return { units: best, label: `${fmtUnits(best)} ${unitName(drug.form)}`, err: Math.abs(best - raw) / raw, isSyrup: false };
}

function candidates(data: DataSet, active: string, audience: Audience): Drug[] {
  const a = norm(active);
  const list = data.drugs.filter((d) => norm(d.active) === a && d.inStock && !d.rx);
  const score = (d: Drug) => (d.audience === audience ? 0 : d.audience === 'Cả hai' ? 1 : 2);
  return list.sort((x, y) => score(x) - score(y));
}

function pickDrug(data: DataSet, rule: Rule, audience: Audience, mg: number | null): { drug: Drug | null; alts: Drug[]; units: string | null } {
  const cands = candidates(data, rule.active, audience);
  if (cands.length === 0) return { drug: null, alts: [], units: null };
  if (mg === null) return { drug: cands[0], alts: cands.slice(1), units: null };
  let best: { d: Drug; score: number; label: string } | null = null;
  for (const d of cands) {
    const u = unitsFor(mg, d);
    if (!u) continue;
    const audPenalty = d.audience === audience ? 0 : d.audience === 'Cả hai' ? 0.15 : 0.6;
    const bigPenalty = u.isSyrup ? (u.units > 15 ? 0.4 : 0) : u.units > 2 ? 0.4 : 0;
    // cùng độ chính xác thì ưu tiên số nguyên và ít đơn vị hơn (1 gói 250 hơn 1½ gói 150)
    const fracPenalty = u.isSyrup ? 0 : (Number.isInteger(u.units) ? 0 : 0.04) + u.units * 0.01;
    const score = u.err + audPenalty + bigPenalty + fracPenalty;
    if (!best || score < best.score) best = { d, score, label: u.label };
  }
  if (!best) return { drug: cands[0], alts: cands.slice(1), units: null };
  return { drug: best.d, alts: cands.filter((c) => c !== best!.d), units: best.label };
}

function doseFor(data: DataSet, rule: Rule, audience: Audience, kg: number | null) {
  let mg: number | null = null;
  let calc: string | null = null;
  let needsWeight = false;
  let capped = false;

  if (rule.mgPerKg !== null) {
    if (kg === null || kg <= 0) needsWeight = true;
    else mg = rule.mgPerKg * kg;
  } else if (rule.mgFixed !== null) {
    mg = rule.mgFixed;
  }

  if (mg !== null) {
    const times = rule.timesMax ?? 1;
    const max = rule.maxAbs ?? (rule.maxPerKg !== null && kg ? rule.maxPerKg * kg : null);
    if (max !== null && mg * times > max + 1e-9) {
      mg = max / times;
      capped = true;
    }
  }

  const picked = pickDrug(data, rule, audience, mg);
  const timesTxt = rule.timesLabel ? ` · ${rule.timesLabel} lần/ngày` : '';
  let doseLine: string;

  if (needsWeight) {
    doseLine = `Nhập số kg để tính (${fmtMg(rule.mgPerKg!)} mg/kg/lần${timesTxt})`;
  } else if (mg !== null) {
    doseLine = picked.units ? `${picked.units} / lần${timesTxt}` : `${fmtMg(mg)} mg / lần${timesTxt}`;
    if (rule.mgPerKg !== null && kg) {
      calc = `${fmtMg(kg)} kg × ${fmtMg(rule.mgPerKg)} mg/kg = ${fmtMg(mg)} mg` + (picked.units ? ` → ${picked.units}` : '');
    } else if (picked.drug?.mg && picked.units && Math.abs(mg - picked.drug.mg) > 1e-9) {
      calc = `${fmtMg(mg)} mg ÷ ${fmtMg(picked.drug.mg)} mg/${unitName(picked.drug.form)} → ${picked.units}`;
    }
    if (capped) calc = (calc ? calc + ' · ' : '') + 'đã hạ theo tối đa/ngày';
  } else if (rule.mgFixedText && picked.drug) {
    // thuốc phối hợp ("500 + 65"): 1 đơn vị / lần
    doseLine = `1 ${unitName(picked.drug.form)} / lần${timesTxt}`;
  } else {
    doseLine = rule.freeText || '(chưa có liều)';
  }
  if (rule.freeText && (mg !== null || needsWeight)) {
    // có cả liều tính và ghi tay → câu ghi tay là chính, phần tính thành chú thích
    calc = calc ?? (picked.units ? `${fmtMg(mg ?? 0)} mg / lần → ${picked.units}` : null);
    doseLine = rule.freeText;
  }
  // hoạt chất có trong sheet nhưng không dùng được: hết hàng hoặc kê đơn
  const all = data.drugs.filter((d) => norm(d.active) === norm(rule.active));
  const rxOnly = !picked.drug && all.length > 0 && all.every((d) => d.rx);
  const outOfStock = !picked.drug && all.length > 0 && !rxOnly && all.every((d) => !d.inStock || d.rx);
  return { doseLine, calc, needsWeight, capped, rxOnly, outOfStock, unitsPerDose: picked.units, ...picked };
}

function totalFor(units: string | null, timesMax: number | null, days: number, form: string): string | null {
  if (!units || !timesMax || days <= 0) return null;
  const m = units.match(/^([\d,.¼½¾]+)\s*(.*)$/);
  if (!m) return null;
  const frac: Record<string, number> = { '¼': 0.25, '½': 0.5, '¾': 0.75 };
  let n = 0;
  const numTxt = m[1];
  const whole = numTxt.replace(/[¼½¾]/g, '').replace(',', '.');
  n += whole ? Number(whole) : 0;
  for (const ch of numTxt) if (frac[ch]) n += frac[ch];
  if (!Number.isFinite(n) || n <= 0) return null;
  const total = n * timesMax * days;
  const unit = m[2] || unitName(form);
  const rounded = unit === 'ml' ? Math.ceil(total) : Math.ceil(total * 2) / 2;
  return `Cắt đủ ${days} ngày: ${unit === 'ml' ? rounded : fmtUnits(rounded)} ${unit}`;
}

export function computeDoses(data: DataSet, selected: string[], audience: Audience, kg: number | null, days = 3): DoseResult {
  const sel = new Set(selected.map(norm));
  const rules = data.rules.filter((r) => r.audience === audience && sel.has(norm(r.symptom)));

  // triệu chứng không có luật
  const covered = new Set(rules.map((r) => norm(r.symptom)));
  const noRule = selected.filter((s) => !covered.has(norm(s)));

  // gộp theo hoạt chất: 1 hoạt chất chỉ 1 dòng (ưu tiên nhỏ nhất)
  const byActive = new Map<string, { rule: Rule; symptoms: Set<string> }>();
  for (const r of rules) {
    const k = norm(r.active);
    const cur = byActive.get(k);
    if (!cur) byActive.set(k, { rule: r, symptoms: new Set([r.symptom]) });
    else {
      cur.symptoms.add(r.symptom);
      if (r.priority < cur.rule.priority) cur.rule = r;
    }
  }

  // gộp theo nhóm: 1 nhóm 1 dòng chính, còn lại là "hoặc"
  const byGroup = new Map<string, { primary: Rule; symptoms: Set<string>; others: Rule[] }>();
  for (const { rule, symptoms } of byActive.values()) {
    const k = norm(rule.group);
    const cur = byGroup.get(k);
    if (!cur) byGroup.set(k, { primary: rule, symptoms: new Set(symptoms), others: [] });
    else {
      symptoms.forEach((s) => cur.symptoms.add(s));
      if (rule.priority < cur.primary.priority) {
        cur.others.push(cur.primary);
        cur.primary = rule;
      } else cur.others.push(rule);
    }
  }

  const items: DoseItem[] = [];
  const warnings: string[] = [];
  let needsWeight = false;
  const seenWarn = new Set<string>();
  const pushWarn = (w: string) => {
    if (w && !seenWarn.has(norm(w))) { seenWarn.add(norm(w)); warnings.push(w); }
  };

  for (const { primary, symptoms, others } of byGroup.values()) {
    const d = doseFor(data, primary, audience, kg);
    if (d.needsWeight) needsWeight = true;
    const orLines = others
      .sort((a, b) => a.priority - b.priority)
      .filter((o) => {
        const od = doseFor(data, o, audience, kg);
        return od.drug !== null; // cách khác mà không có thuốc thì khỏi hiện
      })
      .map((o) => {
        const od = doseFor(data, o, audience, kg);
        const name = od.drug ? od.drug.name : o.active;
        return `Cách khác: ${name} · ${od.doseLine}${o.warning ? ` (${o.warning})` : ''}`;
      });
    pushWarn(primary.warning);
    if (d.rxOnly) pushWarn(`${primary.active} là thuốc kê đơn, hỏi dược sĩ trước khi bán.`);
    items.push({
      key: `${primary.group}|${primary.active}`,
      group: primary.group,
      active: primary.active,
      symptoms: [...symptoms],
      drug: d.drug,
      alternatives: d.alts,
      doseLine: d.doseLine,
      howTo: primary.howTo,
      calcLine: d.calc,
      needsWeight: d.needsWeight,
      capped: d.capped,
      orLines,
      warning: primary.warning,
      totalLine: d.needsWeight || d.rxOnly ? null : totalFor(d.unitsPerDose, primary.timesMax, days, d.drug?.form ?? ''),
      rxOnly: d.rxOnly,
      outOfStock: d.outOfStock,
      priority: primary.priority,
    });
  }
  const selIndex = (it: DoseItem) => Math.min(...it.symptoms.map((s) => selected.findIndex((x) => norm(x) === norm(s))).map((i) => (i < 0 ? 999 : i)));
  const prio = (it: DoseItem) => Math.min(...rules.filter((r) => norm(r.group) === norm(it.group)).map((r) => r.priority));
  items.sort((a, b) => selIndex(a) - selIndex(b) || prio(a) - prio(b) || a.group.localeCompare(b.group, 'vi'));
  return { items, warnings, noRule, needsWeight };
}
