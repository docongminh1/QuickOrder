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
  caution: string | null;  // liều làm tròn không an toàn → không tự cắt, hỏi dược sĩ
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
interface UnitPick { units: number; label: string; err: number; isSyrup: boolean; mgPerDose: number }

function unitOptions(drug: Drug): number[] {
  return norm(drug.form) === 'vien' ? UNITS_TABLET : UNITS_SACHET;
}

function labelFor(units: number, drug: Drug): string {
  return norm(drug.form) === 'siro' ? `${String(units).replace('.', ',')} ml` : `${fmtUnits(units)} ${unitName(drug.form)}`;
}

function mgOf(units: number, drug: Drug): number {
  return norm(drug.form) === 'siro' ? (units / 5) * (drug.mg ?? 0) : units * (drug.mg ?? 0);
}

/** Số đơn vị gần nhất cho 1 lần uống. Siro: mg/5ml → ml (bước 0,5 ml). */
function unitsFor(mg: number, drug: Drug): UnitPick | null {
  if (!drug.mg || drug.mg <= 0) return null;
  const isSyrup = norm(drug.form) === 'siro';
  let units: number;
  if (isSyrup) {
    const ml = (mg / drug.mg) * 5;
    units = Math.max(0.5, Math.round(ml * 2) / 2);
  } else {
    const raw = mg / drug.mg;
    const table = unitOptions(drug);
    units = table[0];
    for (const u of table) if (Math.abs(u - raw) < Math.abs(units - raw)) units = u;
  }
  const mgPerDose = mgOf(units, drug);
  return { units, label: labelFor(units, drug), err: Math.abs(mgPerDose - mg) / mg, isSyrup, mgPerDose };
}

function candidates(data: DataSet, active: string, audience: Audience): Drug[] {
  const a = norm(active);
  const list = data.drugs.filter((d) => norm(d.active) === a && d.inStock && !d.rx);
  const score = (d: Drug) => (d.audience === audience ? 0 : d.audience === 'Cả hai' ? 1 : 2);
  return list.sort((x, y) => score(x) - score(y));
}

function safeOptions(drug: Drug, mg: number, target: number, max: number | null, times: number): number[] {
  const isSyrup = norm(drug.form) === 'siro';
  const cands = isSyrup ? Array.from({ length: 60 }, (_, i) => (i + 1) * 0.5) : unitOptions(drug);
  return cands
    .filter((u) => {
      const per = mgOf(u, drug);
      const ratio = per / target;
      return (max === null || per * times <= max * 1.02) && ratio <= OVER_RATIO && ratio >= UNDER_RATIO;
    })
    .sort((a, b) => Math.abs(mgOf(a, drug) - mg) - Math.abs(mgOf(b, drug) - mg));
}

/**
 * Chọn thuốc ở quầy cho hoạt chất này. Ưu tiên thuốc CÓ mức cắt an toàn (không vượt tối đa/ngày,
 * không lệch quá xa liều tính); trong số đó chọn mức gần liều tính nhất, rồi mới tới đúng đối tượng,
 * số nguyên, ít đơn vị. Không thuốc nào an toàn → trả mức gần nhất và để doseFor gắn caution.
 */
function pickDrug(data: DataSet, rule: Rule, audience: Audience, mg: number | null, target: number | null, max: number | null, times: number): { drug: Drug | null; alts: Drug[]; pick: UnitPick | null } {
  const cands = candidates(data, rule.active, audience);
  if (cands.length === 0) return { drug: null, alts: [], pick: null };
  if (mg === null) return { drug: cands[0], alts: cands.slice(1), pick: null };
  let best: { d: Drug; score: number; pick: UnitPick } | null = null;
  for (const d of cands) {
    if (!d.mg || d.mg <= 0) continue;
    const safe = safeOptions(d, mg, target ?? mg, max, times);
    let u: UnitPick | null;
    let unsafePenalty = 0;
    if (safe.length) {
      const units = safe[0];
      u = { units, label: labelFor(units, d), err: Math.abs(mgOf(units, d) - mg) / mg, isSyrup: norm(d.form) === 'siro', mgPerDose: mgOf(units, d) };
    } else {
      u = unitsFor(mg, d);
      unsafePenalty = 10; // chỉ dùng khi không thuốc nào an toàn
    }
    if (!u) continue;
    const audPenalty = d.audience === audience ? 0 : d.audience === 'Cả hai' ? 0.15 : 0.6;
    const bigPenalty = u.isSyrup ? (u.units > 15 ? 0.4 : 0) : u.units > 2 ? 0.4 : 0;
    // cùng độ chính xác thì ưu tiên số nguyên và ít đơn vị hơn (1 gói 250 hơn 1½ gói 150)
    const fracPenalty = u.isSyrup ? 0 : (Number.isInteger(u.units) ? 0 : 0.04) + u.units * 0.01;
    const score = unsafePenalty + u.err + audPenalty + bigPenalty + fracPenalty;
    if (!best || score < best.score) best = { d, score, pick: u };
  }
  if (!best) return { drug: cands[0], alts: cands.slice(1), pick: null };
  return { drug: best.d, alts: cands.filter((c) => c !== best!.d), pick: best.pick };
}

// Sau làm tròn, liều 1 lần được lệch bao nhiêu so với liều tính trước khi phải hỏi dược sĩ
const OVER_RATIO = 1.25;
const UNDER_RATIO = 0.66;

function doseFor(data: DataSet, rule: Rule, audience: Audience, kg: number | null) {
  let mg: number | null = null;
  let calc: string | null = null;
  let needsWeight = false;
  let capped = false;
  let caution: string | null = null;

  if (rule.mgPerKg !== null) {
    if (kg === null || kg <= 0) needsWeight = true;
    else mg = rule.mgPerKg * kg;
  } else if (rule.mgFixed !== null) {
    mg = rule.mgFixed;
  }

  const times = rule.timesMax ?? 1;
  const max = rule.maxAbs ?? (rule.maxPerKg !== null && kg ? rule.maxPerKg * kg : null);
  const target = mg; // liều tính trước khi hạ theo tối đa
  if (mg !== null && max !== null && mg * times > max + 1e-9) {
    mg = max / times;
    capped = true;
  }

  const picked = pickDrug(data, rule, audience, mg, target, max, times);
  let pick = picked.pick;
  const drug = picked.drug;

  // ---- kiểm an toàn SAU làm tròn (đây là chỗ từng lọt: ¼ viên cho bé 5 kg = gấp đôi liều)
  if (pick && drug && mg !== null) {
    const options = norm(drug.form) === 'siro' ? null : unitOptions(drug);
    const fits = (u: number) => {
      const per = mgOf(u, drug);
      const ratio = per / (target ?? mg!);
      const underMax = max === null || per * times <= max * 1.02;
      return underMax && ratio <= OVER_RATIO && ratio >= UNDER_RATIO;
    };
    if (!fits(pick.units)) {
      // thử các mức khác của cùng thuốc, gần liều tính nhất mà vẫn an toàn
      const cands = options ? options : Array.from({ length: 60 }, (_, i) => (i + 1) * 0.5);
      const ok = cands.filter(fits).sort((a, b) => Math.abs(mgOf(a, drug) - mg!) - Math.abs(mgOf(b, drug) - mg!));
      if (ok.length) {
        const u = ok[0];
        pick = { units: u, label: labelFor(u, drug), err: Math.abs(mgOf(u, drug) - mg) / mg, isSyrup: !options, mgPerDose: mgOf(u, drug) };
      } else {
        const per = pick.mgPerDose;
        const ratio = per / (target ?? mg);
        if (max !== null && per * times > max * 1.02) {
          caution = `${pick.label} ${drug.name} = ${fmtMg(per)} mg × ${times} lần = ${fmtMg(per * times)} mg/ngày, vượt tối đa ${fmtMg(max)} mg/ngày. Không tự cắt, hỏi dược sĩ.`;
        } else if (ratio > OVER_RATIO) {
          caution = `Liều tính ${fmtMg(target ?? mg)} mg nhưng đơn vị nhỏ nhất cắt được là ${pick.label} ${drug.name} = ${fmtMg(per)} mg (gấp ${ratio.toFixed(1)} lần). Hàm lượng thuốc quá lớn cho ca này, hỏi dược sĩ chọn dạng khác.`;
        } else {
          caution = `Liều tính ${fmtMg(target ?? mg)} mg nhưng ${pick.label} ${drug.name} chỉ được ${fmtMg(per)} mg (${Math.round(ratio * 100)}%). Hỏi dược sĩ.`;
        }
      }
    }
  }

  const unitsLabel = pick?.label ?? null;
  const timesTxt = rule.timesLabel ? ` · ${rule.timesLabel} lần/ngày` : '';
  let doseLine: string;

  if (needsWeight) {
    doseLine = `Nhập số kg để tính (${fmtMg(rule.mgPerKg!)} mg/kg/lần${timesTxt})`;
  } else if (mg !== null) {
    doseLine = unitsLabel ? `${unitsLabel} / lần${timesTxt}` : `${fmtMg(mg)} mg / lần${timesTxt}`;
    if (rule.mgPerKg !== null && kg) {
      calc = `${fmtMg(kg)} kg × ${fmtMg(rule.mgPerKg)} mg/kg = ${fmtMg(target ?? mg)} mg` + (unitsLabel ? ` → ${unitsLabel}` : '');
    } else if (drug?.mg && unitsLabel && Math.abs(mg - drug.mg) > 1e-9) {
      calc = `${fmtMg(mg)} mg ÷ ${fmtMg(drug.mg)} mg/${unitName(drug.form)} → ${unitsLabel}`;
    }
    if (capped) calc = (calc ? calc + ' · ' : '') + `đã hạ theo tối đa ${fmtMg(max!)} mg/ngày`;
  } else if (rule.mgFixedText && drug) {
    // thuốc phối hợp ("500 + 65"): 1 đơn vị / lần
    doseLine = `1 ${unitName(drug.form)} / lần${timesTxt}`;
  } else {
    doseLine = rule.freeText || '(chưa có liều)';
  }
  if (rule.freeText && (mg !== null || needsWeight)) {
    // có cả liều tính và ghi tay → câu ghi tay là chính, phần tính thành chú thích
    calc = calc ?? (unitsLabel ? `${fmtMg(mg ?? 0)} mg / lần → ${unitsLabel}` : null);
    doseLine = rule.freeText;
  }
  // hoạt chất có trong sheet nhưng không dùng được: hết hàng hoặc kê đơn
  const all = data.drugs.filter((d) => norm(d.active) === norm(rule.active));
  const rxOnly = !drug && all.length > 0 && all.every((d) => d.rx);
  const outOfStock = !drug && all.length > 0 && !rxOnly && all.every((d) => !d.inStock || d.rx);
  return { doseLine, calc, needsWeight, capped, rxOnly, outOfStock, caution, unitsPerDose: unitsLabel, drug, alts: picked.alts };
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
        return `Cách khác: ${name} · ${od.caution ? 'liều không cắt chính xác được, hỏi dược sĩ' : od.doseLine}${o.warning ? ` (${o.warning})` : ''}`;
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
      totalLine: d.needsWeight || d.rxOnly || d.caution ? null : totalFor(d.unitsPerDose, primary.timesMax, days, d.drug?.form ?? ''),
      caution: d.caution,
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
