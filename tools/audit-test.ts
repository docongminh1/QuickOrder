import { readFileSync } from 'fs';
import { read } from 'xlsx';
import { parseWorkbook } from '../src/engine/parse';
import { auditDataSet } from '../src/engine/audit';
const wb = read(readFileSync(__dirname + '/../CatLieuNhanh_mau.xlsx'));
const ds = parseWorkbook(wb, 'mau.xlsx');
console.log('xlsx mẫu (có dòng ↳):', ds.drugs.length, 'thuốc', ds.rules.length, 'luật', ds.symptoms.length, 'triệu chứng', ds.redFlags.length, 'cờ đỏ', ds.errors.length, 'lỗi');
for (const a of auditDataSet(ds)) console.log(' ', a.level.toUpperCase(), a.text);
