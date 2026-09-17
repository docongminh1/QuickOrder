// Săn lỗi thật: bất biến ĐỘC LẬP với bộ não (không dùng computeDoses để sinh kỳ vọng)
import { fromSample } from '../src/engine/parse';
import { computeDoses } from '../src/engine/dosing';
import { norm, num } from '../src/engine/normalize';
import sample from '../src/data/sample.json';
const ds = fromSample(sample as any);
const symptoms = ds.symptoms.map((s) => s.name);
let seed = 424242; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const fracVal: Record<string, number> = { '¼': 0.25, '½': 0.5, '¾': 0.75 };
function parseUnits(doseLine: string): { n: number; unit: string } | null {
  const m = doseLine.match(/^([\d,.]*)([¼½¾]?)\s*(viên|gói|ml|ống)\s*\/ lần/);
  if (!m) return null;
  const n = (m[1] ? Number(m[1].replace(',', '.')) : 0) + (m[2] ? fracVal[m[2]] : 0);
  return { n, unit: m[3] };
}
const issues = new Map<string, { count: number; example: string }>();
const flag = (key: string, ex: string) => { const c = issues.get(key); if (c) c.count++; else issues.set(key, { count: 1, example: ex }); };
let runs = 0; let cautions = 0; const cautionEx: string[] = [];
for (let i = 0; i < 4000; i++) {
  const aud = rnd() < 0.5 ? 'Trẻ em' : 'Người lớn';
  // kg oái oăm: 3–60 bình thường, thêm biên
  const kg = aud === 'Trẻ em' ? pick([3, 4, 5, 6, 8, 10, 12, 14, 17, 20, 25, 30, 35, 40, 45, 60, 2.5, 90]) : null;
  const n = 1 + Math.floor(rnd() * 4);
  const sel = [...new Set(Array.from({ length: n }, () => pick(symptoms)))];
  const days = pick([1, 2, 3, 5]);
  const r = computeDoses(ds, sel, aud, kg, days);
  runs++;
  const seenDrug = new Set<string>();
  for (const it of r.items) {
    const tag = `${aud}${kg ? ' ' + kg + 'kg' : ''} ${sel.join('+')} → ${it.drug?.name ?? it.active}: ${it.doseLine}${it.calcLine ? ' | ' + it.calcLine : ''}`;
    if (it.drug) {
      if (seenDrug.has(it.drug.name)) flag('cùng một thuốc hiện 2 thẻ', tag); seenDrug.add(it.drug.name);
      if (it.drug.rx) flag('gợi ý thuốc KÊ ĐƠN', tag);
      if (!it.drug.inStock) flag('gợi ý thuốc HẾT HÀNG', tag);
      if (aud === 'Trẻ em' && it.drug.audience === 'Người lớn' && ds.drugs.some((d) => norm(d.active) === norm(it.active) && d.audience !== 'Người lớn' && d.inStock && !d.rx))
        flag('trẻ em nhận thuốc "Người lớn" dù có thuốc trẻ em cùng hoạt chất', tag);
    }
    // tìm luật gốc để kiểm liều
    const rule = ds.rules.find((x) => norm(x.active) === norm(it.active) && x.audience === aud && sel.some((s) => norm(s) === norm(x.symptom)));
    const u = parseUnits(it.doseLine);
    if (it.caution) { cautions++; if (cautionEx.length < 3) cautionEx.push(`${tag}\n       ⛔ ${it.caution}`); if (it.totalLine) flag('có caution mà vẫn in tổng', tag); }
    if (rule && it.drug && it.drug.mg && u && !it.needsWeight && !it.caution) {
      const perDoseMg = u.unit === 'ml' ? (u.n / 5) * it.drug.mg : u.n * it.drug.mg;
      const target = rule.mgPerKg !== null && kg ? rule.mgPerKg * kg : rule.mgFixed;
      if (target) {
        const ratio = perDoseMg / target;
        if (ratio > 1.34) flag('liều sau làm tròn CAO hơn liều tính >34%', `${tag} → uống ${perDoseMg}mg / tính ${target}mg (×${ratio.toFixed(2)})`);
        if (ratio < 0.66) flag('liều sau làm tròn THẤP hơn liều tính >34%', `${tag} → uống ${perDoseMg}mg / tính ${target}mg (×${ratio.toFixed(2)})`);
      }
      const max = rule.maxAbs ?? (rule.maxPerKg !== null && kg ? rule.maxPerKg * kg : null);
      const times = rule.timesMax ?? 1;
      if (max !== null && perDoseMg * times > max * 1.05) flag('vượt TỐI ĐA/ngày sau khi làm tròn', `${tag} → ${perDoseMg}×${times}=${perDoseMg * times} > ${max}`);
      if (u.n <= 0 || !Number.isFinite(u.n)) flag('số đơn vị vô lý', tag);
      // tổng
      if (it.totalLine) {
        const tm = it.totalLine.match(/: ([\d,.]*)([¼½¾]?)\s*(\S+)/);
        if (tm) {
          const tot = (tm[1] ? Number(tm[1].replace(',', '.')) : 0) + (tm[2] ? fracVal[tm[2]] : 0);
          const expect = u.n * times * days;
          if (Math.abs(tot - expect) > 0.51 && !(u.unit === 'ml' && Math.abs(tot - expect) < 1)) flag('tổng "Cắt đủ" không bằng liều × lần × ngày', `${tag} | ${it.totalLine} (mong ${expect})`);
        }
      }
    }
    if (rule && it.drug && !it.drug.mg && (rule.mgPerKg !== null || rule.mgFixed !== null) && !it.needsWeight && !/^\d/.test(it.doseLine)) flag('luật có mg nhưng thuốc không có mg → không ra số viên', tag);
    if (it.doseLine.includes('mg mg') || /\bmg\s*mg\b/.test(it.doseLine)) flag('chữ "mg mg" lặp', tag);
  }
  for (const s of sel) {
    const covered = r.items.some((it) => it.symptoms.some((x) => norm(x) === norm(s))) || r.noRule.some((x) => norm(x) === norm(s));
    if (!covered) flag('triệu chứng chọn mà không ra thẻ cũng không báo thiếu luật', `${aud} ${sel.join('+')} thiếu ${s}`);
  }
  if (aud === 'Trẻ em' && kg === null && r.items.some((it) => it.calcLine?.includes('kg ×'))) flag('không có kg mà vẫn tính theo kg', sel.join('+'));
}
console.log(`=== FUZZ ${runs} lượt · ${cautions} thẻ chuyển 'hỏi dược sĩ' vì làm tròn không an toàn ===`);
for (const e of cautionEx) console.log('  vd: ' + e);
if (issues.size === 0) console.log('không phát hiện vi phạm bất biến');
for (const [k, v] of [...issues.entries()].sort((a, b) => b[1].count - a[1].count)) console.log(`✗ ${k} — ${v.count} lần\n    vd: ${v.example}`);

// ---- dữ liệu Excel bẩn: dược sĩ gõ như đời thật → phải đọc ra đúng số
console.log('\n=== DỮ LIỆU BẨN ===');
import { times, maxPerDay } from '../src/engine/normalize';
let bad = 0;
const eq = (label: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(`  ${ok ? '✓' : '✗'} ${label} → ${JSON.stringify(got)}${ok ? '' : '  (mong ' + JSON.stringify(want) + ')'}`); };
eq('num("500mg")', num('500mg'), 500); eq('num("500 mg")', num('500 mg'), 500); eq('num(" 500 ")', num(' 500 '), 500);
eq('num("12,5")', num('12,5'), 12.5); eq('num("12.5mg")', num('12.5mg'), 12.5); eq('num(500)', num(500), 500);
eq('num("3g")', num('3g'), 3000); eq('num("1/2")', num('1/2'), null); eq('num("abc")', num('abc'), null); eq('num("")', num(''), null);
eq('times("3-4")', times('3-4'), { label: '3–4', max: 4 }); eq('times("3 – 4")', times('3 – 4'), { label: '3–4', max: 4 });
eq('times("3 lần/ngày")', times('3 lần/ngày'), { label: '3', max: 3 }); eq('times("2-3 lần")', times('2-3 lần'), { label: '2–3', max: 3 });
eq('times("x3")', times('x3'), { label: '3', max: 3 }); eq('times(3)', times(3), { label: '3', max: 3 }); eq('times("")', times(''), { label: '', max: null });
eq('times("khi cần")', times('khi cần'), { label: 'khi cần', max: null });
eq('maxPerDay("60/kg")', maxPerDay('60/kg'), { abs: null, perKg: 60 }); eq('maxPerDay("60 mg/kg")', maxPerDay('60 mg/kg'), { abs: null, perKg: 60 });
eq('maxPerDay("60mg/kg/ngày")', maxPerDay('60mg/kg/ngày'), { abs: null, perKg: 60 }); eq('maxPerDay("3000")', maxPerDay('3000'), { abs: 3000, perKg: null });
eq('maxPerDay("3000 mg")', maxPerDay('3000 mg'), { abs: 3000, perKg: null }); eq('maxPerDay("3g")', maxPerDay('3g'), { abs: 3000, perKg: null });
eq('maxPerDay("")', maxPerDay(''), { abs: null, perKg: null });
if (bad) { console.log(`${bad} ca đọc dữ liệu bẩn SAI`); process.exit(1); }
if (issues.size > 0) process.exit(1);
