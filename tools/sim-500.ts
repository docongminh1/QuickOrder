import { fromSample } from '../src/engine/parse';
import { computeDoses, type DoseItem } from '../src/engine/dosing';
import { norm } from '../src/engine/normalize';
import sample from '../src/data/sample.json';

const ds = fromSample(sample as any);
const symptoms = ds.symptoms.map((s) => s.name);

// PRNG cố định để lặp lại được
let seed = 20260914;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];

// nhóm triệu chứng hay đi chung để giống đời thật
const CLUSTERS: string[][] = [
  ['Sốt', 'Đau đầu', 'Đau nhức mình'], ['Ho khan', 'Đau họng', 'Khàn tiếng'], ['Ho có đờm', 'Sổ mũi', 'Nghẹt mũi', 'Hắt hơi'],
  ['Sốt', 'Sổ mũi', 'Ho có đờm'], ['Tiêu chảy', 'Buồn nôn', 'Đau bụng quặn'], ['Đầy hơi, khó tiêu', 'Ợ nóng, đau dạ dày', 'Buồn nôn'],
  ['Nổi mề đay', 'Ngứa', 'Ngứa mắt, chảy nước mắt'], ['Cảm cúm', 'Đau đầu'], ['Đau răng'], ['Đau bụng kinh', 'Đau đầu'],
  ['Đau lưng, đau khớp'], ['Say tàu xe', 'Buồn nôn'], ['Mất ngủ nhẹ', 'Mệt mỏi'], ['Táo bón', 'Đầy hơi, khó tiêu'], ['Mệt mỏi', 'Đau đầu'],
];

interface Cust { id: number; aud: 'Người lớn' | 'Trẻ em'; kg: number | null; ageTxt: string; sel: string[]; forgotKg: boolean; days: number }
const custs: Cust[] = [];
for (let i = 1; i <= 500; i++) {
  const isChild = rnd() < 0.4;
  let kg: number | null; let ageTxt: string;
  if (isChild) {
    const age = Math.floor(rnd() * 12) + 1; // 1–12 tuổi
    kg = Math.round((age * 2 + 8) * (0.85 + rnd() * 0.3)); // xấp xỉ theo tuổi
    ageTxt = `bé ${age} tuổi ${kg} kg`;
  } else { kg = null; ageTxt = pick(['thanh niên', 'cô trung niên', 'bác lớn tuổi', 'anh công nhân', 'chị văn phòng']); }
  const forgotKg = isChild && rnd() < 0.15; // 15% nhân viên quên hỏi cân
  const n = 1 + Math.floor(rnd() * 4);
  let sel: string[];
  if (rnd() < 0.7) { const c = pick(CLUSTERS); sel = [...c].sort(() => rnd() - 0.5).slice(0, Math.min(n, c.length)); if (rnd() < 0.3) sel.push(pick(symptoms)); }
  else { sel = Array.from({ length: n }, () => pick(symptoms)); }
  sel = [...new Set(sel)];
  custs.push({ id: i, aud: isChild ? 'Trẻ em' : 'Người lớn', kg: forgotKg ? null : kg, ageTxt, sel, forgotKg, days: pick([2, 3, 3, 3, 5]) });
}

// thống kê
const stat = { ok: 0, needKg: 0, noRuleSome: 0, noRuleAll: 0, rxOnly: 0, outOfStock: 0, capped: 0, manyItems: 0, bigUnits: 0, warnings: 0 };
const noRuleCount = new Map<string, number>();
const drugCount = new Map<string, number>();
const oddities: string[] = [];
const samples: string[] = [];
const itemsHist = new Map<number, number>();

for (const c of custs) {
  const r = computeDoses(ds, c.sel, c.aud, c.kg, c.days);
  itemsHist.set(r.items.length, (itemsHist.get(r.items.length) ?? 0) + 1);
  if (r.needsWeight) stat.needKg++;
  if (r.noRule.length) { stat.noRuleSome++; r.noRule.forEach((s) => noRuleCount.set(`${c.aud}: ${s}`, (noRuleCount.get(`${c.aud}: ${s}`) ?? 0) + 1)); }
  if (r.items.length === 0) { stat.noRuleAll++; oddities.push(`#${c.id} ${c.ageTxt} ${c.sel.join('+')} → KHÔNG RA THUỐC NÀO`); }
  if (r.items.length >= 5) { stat.manyItems++; }
  if (r.warnings.length) stat.warnings++;
  for (const it of r.items) {
    if (it.drug) drugCount.set(it.drug.name, (drugCount.get(it.drug.name) ?? 0) + 1);
    if (it.rxOnly) { stat.rxOnly++; oddities.push(`#${c.id} ${c.ageTxt} ${c.sel.join('+')} → ${it.active} chỉ có thuốc kê đơn`); }
    if (it.outOfStock) { stat.outOfStock++; oddities.push(`#${c.id} ${c.ageTxt} ${c.sel.join('+')} → ${it.active} hết hàng`); }
    if (it.capped) { stat.capped++; oddities.push(`#${c.id} ${c.ageTxt} ${c.sel.join('+')} → ${it.drug?.name}: ${it.doseLine} | ${it.calcLine}`); }
    const m = it.doseLine.match(/^(\d+(?:[.,]\d+)?|[¼½¾]|\d+[¼½¾])\s+(viên|gói|ml|ống)/);
    if (m) {
      const v = m[1]; const num = v.includes('½') ? parseFloat(v) + 0.5 : v.includes('¼') ? parseFloat(v || '0') + 0.25 : parseFloat(v.replace(',', '.'));
      if ((m[2] !== 'ml' && num >= 2.5) || (m[2] === 'ml' && num >= 15)) { stat.bigUnits++; oddities.push(`#${c.id} ${c.ageTxt} ${c.sel.join('+')} → ${it.drug?.name}: ${it.doseLine} | ${it.calcLine ?? ''}`); }
    }
  }
  if (!r.needsWeight && r.noRule.length === 0 && r.items.length > 0 && !r.items.some((i) => i.rxOnly || i.outOfStock)) stat.ok++;
  if (samples.length < 8 && rnd() < 0.05) {
    samples.push(`#${c.id} ${c.ageTxt} · ${c.sel.join(' + ')} · ${c.days} ngày\n` + r.items.map((it) => `   • ${it.drug?.name ?? it.active}: ${it.doseLine}${it.totalLine ? ' → ' + it.totalLine : ''}`).join('\n') + (r.warnings.length ? `\n   ⚠ ${r.warnings.join(' | ')}` : '') + (r.needsWeight ? '\n   ✋ nhắc nhập kg' : '') + (r.noRule.length ? `\n   ✗ chưa có luật: ${r.noRule.join(', ')}` : ''));
  }
}

console.log('=== 500 KHÁCH ===');
console.log(`Trẻ em: ${custs.filter(c => c.aud === 'Trẻ em').length} · Người lớn: ${custs.filter(c => c.aud === 'Người lớn').length} · quên hỏi cân: ${custs.filter(c => c.forgotKg).length}`);
console.log('Kết quả:', stat);
console.log('Số thẻ thuốc/khách:', [...itemsHist.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k} thẻ: ${v}`).join(' · '));
console.log('\n--- Triệu chứng CHƯA CÓ LUẬT (số lần gặp) ---');
[...noRuleCount.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${v.toString().padStart(3)}  ${k}`));
console.log('\n--- Thuốc được gợi ý nhiều nhất ---');
[...drugCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([k, v]) => console.log(`  ${v.toString().padStart(3)}  ${k}`));
console.log('\n--- Ca lạ / cần dược sĩ (' + oddities.length + ') ---');
[...new Set(oddities)].slice(0, 25).forEach((o) => console.log('  ' + o));
console.log('\n--- 8 khách mẫu ---');
samples.forEach((s) => console.log(s + '\n'));
