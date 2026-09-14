// Nhân viên không biết gì: gõ lời khách nói vào ô tìm, gõ sai tên thuốc, gặp dấu hiệu nguy hiểm
import { fromSample, matchSymptoms } from '../src/engine/parse';
import { searchDrugs, suggestDrugs } from '../src/engine/lookup';
import sample from '../src/data/sample.json';
const ds = fromSample(sample as any);

const SAID = ['đi ngoài', 'nhức đầu', 'nổi mẩn', 'nóng trong người', 'ho đàm', 'chảy mũi', 'ngạt mũi', 'rát họng', 'đau bao tử', 'ợ chua', 'bón',
  'đau bụng tới tháng', 'nhức răng', 'say xe', 'khó ngủ', 'cảm', 'trúng gió', 'hắt xì', 'mất tiếng', 'đầy bụng', 'ói', 'ngứa', 'cay mắt', 'nhức mỏi',
  'mệt', 'ho về đêm', 'khò khè', 'đau vai gáy', 'sốt cao', 'đau quặn', 'chướng bụng', 'mắc ói', 'ho', 'đau bụng', 'sổ mũi xanh', 'đau lưng', 'nghẹt', 'uể oải', 'ớn lạnh', 'tào tháo'];
let hit = 0; const miss: string[] = [];
console.log('=== Lời khách nói → chip ===');
for (const p of SAID) { const m = matchSymptoms(ds.symptoms, p); if (m.length) { hit++; console.log(`  "${p}" → ${m.slice(0, 3).map(x => x.name).join(' / ')}${m.length > 3 ? ' …' : ''}`); } else miss.push(p); }
console.log(`  Khớp ${hit}/${SAID.length}. Không khớp: ${miss.join(', ') || '—'}`);

const TYPOS = ['pandol', 'panadon', 'hapacon', 'eferalgan', 'paracetamon', 'clarityn', 'telfat', 'smecta', 'oresol', 'bisolvon', 'zyrtec', 'otrivin', 'bruffen', 'acemux', 'strepsil', 'domperidone', 'loratadine', 'decolgen', 'tifi', 'alaxan'];
console.log('\n=== Gõ sai tên thuốc ===');
let ok = 0;
for (const t of TYPOS) { const m = searchDrugs(ds, t); const sg = m.length ? [] : suggestDrugs(ds, t); if (m.length || sg.length) ok++; console.log(`  "${t}" → ${m.length ? 'tìm thấy: ' + m.slice(0, 2).map(d => d.name).join(', ') : sg.length ? 'gợi ý: ' + sg.slice(0, 3).map(d => d.name).join(', ') : 'KHÔNG'}`); }
console.log(`  Ra kết quả ${ok}/${TYPOS.length}`);

console.log('\n=== Cờ đỏ trong app ===');
ds.redFlags.forEach(f => console.log(`  [${f.audience}] ${f.text} → ${f.action}`));
