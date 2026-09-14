import { readFileSync } from 'fs';
import { read } from 'xlsx';
import { parseWorkbook } from '../src/engine/parse';
import { computeDoses } from '../src/engine/dosing';
import { lookup, searchDrugs } from '../src/engine/lookup';

const wb = read(readFileSync(__dirname + '/../CatLieuNhanh_mau.xlsx'));
const ds = parseWorkbook(wb, 'duocsi_sua.xlsx');
console.log('=== DƯỢC SĨ NẠP:', ds.drugs.length, 'thuốc,', ds.rules.length, 'luật,', ds.symptoms.length, 'triệu chứng,', ds.errors.length, 'lỗi');
for (const e of ds.errors) console.log(`  Dòng ${e.row} ${e.sheet}: ${e.message}`);
console.log('  Triệu chứng mới tự thêm?', ds.symptoms.filter(s => s.group === 'Khác').map(s => s.name));

const show = (label: string, sel: string[], aud: 'Người lớn' | 'Trẻ em', kg: number | null) => {
  const r = computeDoses(ds, sel, aud, kg);
  console.log(`\n=== NV: ${label} → ${aud}${kg ? ' ' + kg + 'kg' : ''}: ${sel.join(' + ')}`);
  for (const it of r.items) {
    console.log(` • [${it.group}] ${it.drug?.name ?? it.active}${it.drug?.mgText ? ' ' + it.drug.mgText + 'mg' : ''} — ${it.doseLine}${it.howTo ? ' · ' + it.howTo : ''}`);
    if (it.calcLine) console.log(`     ${it.calcLine}`);
    for (const o of it.orLines) console.log(`     ${o}`);
  }
  if (r.warnings.length) console.log(' ⚠', r.warnings.join(' | '));
  if (r.noRule.length) console.log(' ✗ không có luật:', r.noRule);
};
show('Khách 1: bé 3 tuổi 14kg sốt + sổ mũi', ['Sốt', 'Sổ mũi'], 'Trẻ em', 14);
show('Khách 2: người lớn cảm cúm (chip mới của dược sĩ)', ['Cảm cúm'], 'Người lớn', null);
show('Khách 3: bé 8 tuổi cảm cúm, NV quên hỏi cân', ['Cảm cúm'], 'Trẻ em', null);
show('Khách 4: người lớn đau họng + ho khan + nghẹt mũi', ['Đau họng', 'Ho khan', 'Nghẹt mũi'], 'Người lớn', null);
show('Khách 5: người lớn tiêu chảy + buồn nôn', ['Tiêu chảy', 'Buồn nôn'], 'Người lớn', null);
show('Khách 6: bé 25kg đau răng (luật có "7,5" dạng chữ)', ['Đau răng'], 'Trẻ em', 25);

const ask = (q: string) => {
  const m = searchDrugs(ds, q);
  console.log(`\n=== KH hỏi "${q}" → tìm thấy:`, m.map(d => d.name).join(', ') || '(không có)');
  if (m[0]) {
    const L = lookup(ds, m[0]);
    console.log(`   ${m[0].name} = ${m[0].active} ${m[0].mgText}mg`);
    console.log('   cùng mg:', L.sameMg.map(d => d.name).join(', ') || '—');
    console.log('   khác mg:', L.otherMg.map(d => d.name).join(', ') || '—');
    console.log('   có thêm chất:', L.combos.map(d => d.name).join(', ') || '—');
  }
};
ask('Panadol');           // có
ask('Decolgen');          // combo mới thêm → thay thế bằng Tiffy?
ask('Efferalgan');        // có nhiều hàm lượng
ask('Alaxan');            // KHÔNG có ở quầy → NV bó tay?
ask('paracetamol');       // hỏi theo hoạt chất
ask('augmentin');         // kê đơn
