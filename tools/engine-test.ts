import { fromSample, parseWorkbook } from '../src/engine/parse';
import { computeDoses } from '../src/engine/dosing';
import { lookup, searchDrugs } from '../src/engine/lookup';
import sample from '../src/data/sample.json';
import { readFileSync } from 'fs';
import { read } from 'xlsx';

const ds = fromSample(sample as any);
console.log('sample:', ds.drugs.length, 'drugs', ds.rules.length, 'rules', ds.symptoms.length, 'symptoms', ds.errors.length, 'errors');
for (const e of ds.errors) console.log('  ERR', e);

const show = (label: string, sel: string[], aud: 'Người lớn' | 'Trẻ em', kg: number | null) => {
  const r = computeDoses(ds, sel, aud, kg);
  console.log(`\n== ${label} (${aud}${kg ? ' ' + kg + 'kg' : ''}) → ${sel.join(', ')}`);
  for (const it of r.items) {
    console.log(` [${it.group}] ${it.drug?.name ?? it.active} ${it.drug?.mgText ?? ''}mg ${it.drug?.form ?? ''}`);
    console.log(`    ${it.doseLine}${it.howTo ? ' · ' + it.howTo : ''}`);
    if (it.calcLine) console.log(`    calc: ${it.calcLine}`);
    if (it.alternatives.length) console.log(`    alt: ${it.alternatives.map(d => d.name).join(', ')}`);
    for (const o of it.orLines) console.log(`    ${o}`);
  }
  if (r.warnings.length) console.log(' WARN:', r.warnings);
  if (r.noRule.length) console.log(' NO RULE:', r.noRule);
};
show('bé', ['Ho có đờm', 'Sổ mũi', 'Sốt'], 'Trẻ em', 20);
show('bé chưa kg', ['Sốt'], 'Trẻ em', null);
show('bé nặng', ['Sốt', 'Đau đầu'], 'Trẻ em', 45);
show('người lớn', ['Sốt', 'Đau đầu', 'Ho khan', 'Nghẹt mũi', 'Đau họng'], 'Người lớn', null);
show('tiêu chảy bé', ['Tiêu chảy', 'Buồn nôn'], 'Trẻ em', 12);
show('người lớn tiêu chảy', ['Tiêu chảy'], 'Người lớn', null);

console.log('\n== lookup Panadol');
const m = searchDrugs(ds, 'pana');
console.log(' matches:', m.map(d => d.name));
const L = lookup(ds, m[0]);
console.log(' sameMg:', L.sameMg.map(d => d.name), '\n otherMg:', L.otherMg.map(d => d.name), '\n combos:', L.combos.map(d => d.name));

console.log('\n== parse xlsx template');
const wb = read(readFileSync(__dirname + '/../CatLieuNhanh_mau.xlsx'));
const ds2 = parseWorkbook(wb, 'mau.xlsx');
console.log(' xlsx:', ds2.drugs.length, 'drugs', ds2.rules.length, 'rules', ds2.symptoms.length, 'symptoms', ds2.errors.length, 'errors');
for (const e of ds2.errors) console.log('  ERR', e);
const r2 = computeDoses(ds2, ['Sốt'], 'Trẻ em', 20);
console.log(' xlsx Sốt 20kg:', r2.items.map(i => `${i.drug?.name} ${i.doseLine} | ${i.calcLine}`));
