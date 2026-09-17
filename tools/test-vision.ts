// Test phần khớp/áp dụng KHÔNG cần mạng: giả lập kết quả Claude đọc tấm ảnh tủ kê đơn
import { fromSample } from '../src/engine/parse';
import { applyShelfProposals, matchDrug, proposeFromPrescription, proposeFromShelf, type ShelfReadingT, type PrescriptionReadingT } from '../src/engine/vision';
import sample from '../src/data/sample.json';
const ds = fromSample(sample as any);

const reading: ShelfReadingT = { rows_total: 6, cabinet_label: 'THUỐC KÊ ĐƠN', items: [
  { name: 'Auclanityl', active: 'Amoxicillin + Acid clavulanic', strength: '500/125mg', form: 'viên', row: 1, side: 'giữa', count: 1, confidence: 'cao' },
  { name: 'Augmentin', active: '', strength: '625', form: 'viên', row: 1, side: 'giữa', count: 1, confidence: 'vừa' },
  { name: 'Panadol Extra', active: '', strength: '', form: 'viên', row: 4, side: 'trái', count: 2, confidence: 'cao' },
  { name: 'Hapacol 250', active: 'Paracetamol', strength: '250mg', form: 'gói', row: 4, side: 'phải', count: 3, confidence: 'cao' },
  { name: 'Hapaco', active: '', strength: '150mg', form: 'gói', row: 4, side: 'phải', count: 1, confidence: 'thấp' },
  { name: 'không đọc được', active: '', strength: 'hộp xanh', form: '', row: 6, side: 'trái', count: 2, confidence: 'thấp' },
  { name: 'Alaxan', active: '', strength: '', form: 'viên', row: 5, side: '', count: 1, confidence: 'cao' },
]};
const props = proposeFromShelf(ds, reading, 'Tủ kê đơn');
for (const p of props) console.log(`${p.action.padEnd(6)} ${p.read.name.padEnd(16)} → ${p.match ? p.match.name + (p.exact ? '' : ' (gần giống)') : '—'} @ ${p.location}`);
const r = applyShelfProposals(ds, props, { rxCabinet: true });
console.log(`cập nhật ${r.updated}, thêm ${r.added}; Augmentin 625 location =`, r.ds.drugs.find(d => d.name === 'Augmentin 625')?.location, '; Alaxan inStock =', r.ds.drugs.find(d => d.name === 'Alaxan')?.inStock);
console.log('thêm mới:', r.ds.drugs.filter(d => d.note.startsWith('thêm từ ảnh')).map(d => `${d.name} [${d.active}] rx=${d.rx}`));

const rx: PrescriptionReadingT = { kind: 'toa', note: 'chữ tay hàng 2 mờ', items: [
  { name: 'Panadol 500mg', strength: '500mg', quantity: '10 viên', instruction: 'uống 1 viên khi sốt', confidence: 'cao' },
  { name: 'Alaxan', strength: '', quantity: '6 viên', instruction: '', confidence: 'vừa' },
  { name: 'Clarityn', strength: '10mg', quantity: '5 viên', instruction: 'tối 1 viên', confidence: 'vừa' },
  { name: 'Zinnat', strength: '500', quantity: '10 viên', instruction: '', confidence: 'thấp' },
]};
for (const p of proposeFromPrescription(ds, rx)) console.log(`toa: ${p.read.name.padEnd(14)} → ${p.match ? `${p.match.name} 📍${p.match.location} ${p.match.inStock ? '' : 'HẾT → thay: ' + p.alternatives.map(d => d.name).join(', ')}` : 'chưa có ở quầy'}`);
console.log('matchDrug("Hapacol", "500") →', matchDrug(ds, 'Hapacol', '500')?.drug.name);
