// Sinh 500 khách + kết quả mong đợi từ bộ não, ghi JSON cho tay máy UI so sánh
import { writeFileSync } from 'fs';
import { fromSample } from '../src/engine/parse';
import { computeDoses } from '../src/engine/dosing';
import { norm } from '../src/engine/normalize';
import { searchDrugs, lookup } from '../src/engine/lookup';
import sample from '../src/data/sample.json';
const ds = fromSample(sample as any);
const symptoms = ds.symptoms.map((s) => s.name);
let seed = 20260917; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const CLUSTERS = [['Sốt','Đau đầu'],['Ho khan','Đau họng'],['Ho có đờm','Sổ mũi','Nghẹt mũi'],['Sốt','Sổ mũi'],['Tiêu chảy','Buồn nôn'],['Đầy hơi, khó tiêu','Ợ nóng, đau dạ dày'],['Nổi mề đay','Ngứa'],['Cảm cúm'],['Đau răng'],['Đau bụng kinh'],['Đau lưng, đau khớp'],['Say tàu xe'],['Mất ngủ nhẹ'],['Táo bón'],['Mệt mỏi','Đau đầu'],['Hắt hơi','Ngứa mắt, chảy nước mắt'],['Khàn tiếng']];
const LOOKUPS = ['Panadol','Hapacol','Efferalgan','Alaxan','Augmentin','Smecta','Zinnat','pandol','Otrivin','Clarityn','Telfast','Decolgen','Oresol','Zyrtec'];
const out: any[] = [];
for (let i = 1; i <= 500; i++) {
  const r = rnd();
  if (r < 0.12) { // khách hỏi thuốc
    const q = pick(LOOKUPS); const m = searchDrugs(ds, q);
    out.push({ id: i, kind: 'lookup', query: q, expect: m.length ? { first: m[0].name, location: m[0].location, inStock: m[0].inStock, same: lookup(ds, m[0]).sameMg.map(d => d.name) } : { none: true } });
    continue;
  }
  const child = rnd() < 0.4; const kg = child ? Math.round((Math.floor(rnd() * 12) + 1) * 2 + 8 + rnd() * 4) : null;
  const forgotKg = child && rnd() < 0.12;
  let sel = [...pick(CLUSTERS)]; if (rnd() < 0.3) sel.push(pick(symptoms)); sel = [...new Set(sel)].slice(0, 3);
  const flag = rnd() < 0.08; const cond = !flag && rnd() < 0.15;
  const aud = child ? 'Trẻ em' : 'Người lớn';
  const res = computeDoses(ds, sel, aud, forgotKg ? null : kg, 3);
  out.push({ id: i, kind: 'dose', audience: aud, kg: forgotKg ? null : kg, symptoms: sel, typed: sel.map(s => norm(s)), flag, cond,
    expect: { items: res.items.filter(x => x.priority < 3 || res.items.length <= 3).map(x => ({ drug: x.drug?.name ?? x.active, total: x.totalLine, caution: !!x.caution })), needsWeight: res.needsWeight, noRule: res.noRule, nItems: res.items.length } });
}
writeFileSync('tools/customers.json', JSON.stringify(out, null, 0));
const d = out.filter(o => o.kind === 'dose'); console.log(`thẻ 'KHÔNG TỰ CẮT': ${d.reduce((a: number, o: any) => a + o.expect.items.filter((i: any) => i.caution).length, 0)}`); console.log(`sinh ${out.length} khách: ${d.length} cắt liều (${d.filter((o: any) => o.audience === 'Trẻ em').length} trẻ em, ${d.filter((o: any) => o.flag).length} cờ đỏ, ${d.filter((o: any) => o.cond).length} có tình trạng đặc biệt, ${d.filter((o: any) => o.audience === 'Trẻ em' && o.kg === null).length} quên cân), ${out.length - d.length} hỏi thuốc`);
