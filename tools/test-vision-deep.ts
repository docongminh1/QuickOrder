// Kiểm kỹ phần đọc ảnh, KHÔNG cần khoá: (1) khớp tên nhiều ca dễ nhầm, (2) áp dụng + xuất Excel → nạp lại,
// (3) gọi SDK Claude qua fetch giả để soi gói tin và xử lý từ chối / kết quả hỏng.
import { read } from 'xlsx';
import { fromSample, parseWorkbook } from '../src/engine/parse';
import { toWorkbookBase64 } from '../src/engine/exportWorkbook';
import { applyShelfProposals, makeClient, matchDrug, proposeFromPrescription, proposeFromShelf, readPrescriptionImage, readShelfImage, VisionRefusal, type ShelfReadingT } from '../src/engine/vision';
import sample from '../src/data/sample.json';
import Anthropic from '@anthropic-ai/sdk';

async function main() {
let fails = 0;
const ok = (cond: boolean, msg: string) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) fails++; };
const ds = fromSample(sample as any);

console.log('=== 1. Khớp tên đọc từ ảnh với thuốc ở quầy ===');
const cases: [string, string, string | null, boolean][] = [
  ['Panadol', '500mg', 'Panadol', true],
  ['Panadol Extra', '', 'Panadol Extra', true],
  ['PANADOL', '', 'Panadol', true],
  ['Hapacol 150', '150mg', 'Hapacol 150', true],
  ['Hapacol', '250mg', 'Hapacol 250', true],          // tên chung + hàm lượng → đúng loại
  ['Hapacol', '500', 'Hapacol 500', true],
  ['Efferalgan', '150 mg', 'Efferalgan 150', true],
  ['Clarityn', '10mg', 'Clarityne 10', true],          // thiếu chữ cuối = tiền tố → coi là khớp
  ['Bruffen 400', '', 'Brufen 400', false],
  ['Otrivin 0,1%', '', 'Otrivin 0,1%', true],
  ['Zinnat', '500', null, false],                     // không có ở quầy
  ['không đọc được', 'hộp xanh', null, false],
  ['Alaxan (?)', '', 'Alaxan', true],                 // bỏ dấu (?)
  ['Acemuc', '200mg', 'Acemuc 200', true],
  ['Acemuc', '100', 'Acemuc 100', true],
  ['Telfast', '180', 'Telfast 180', true],
  ['Hidrasec', '30mg', 'Hidrasec 30', true],
  ['Smecta', '', 'Smecta', true],
  ['Oresol', '', 'Oresol', true],
  ['Cataflam 25', '25mg', null, false],               // thuốc mới
];
for (const [name, str, want, wantExact] of cases) {
  const m = matchDrug(ds, name, str);
  const got = m?.drug.name ?? null;
  ok(got === want && (!m || m.exact === wantExact), `"${name}" ${str ? '(' + str + ')' : ''} → ${got ?? '—'}${m ? (m.exact ? '' : ' gần giống') : ''}  [mong: ${want ?? '—'}]`);
}

console.log('\n=== 2. Áp dụng đề nghị → xuất Excel → nạp lại ===');
const reading: ShelfReadingT = { rows_total: 3, cabinet_label: 'THUỐC KÊ ĐƠN', items: [
  { name: 'Panadol', active: 'Paracetamol', strength: '500mg', form: 'viên', row: 1, side: 'trái', count: 2, confidence: 'cao' },
  { name: 'Cataflam 25', active: 'Diclofenac', strength: '25mg', form: 'viên', row: 2, side: 'giữa', count: 4, confidence: 'cao' },
  { name: 'Augmentin', active: '', strength: '625', form: 'viên', row: 1, side: 'phải', count: 1, confidence: 'vừa' },
  { name: 'Panadol', active: '', strength: '500mg', form: 'viên', row: 3, side: 'phải', count: 1, confidence: 'cao' },  // trùng tên 2 hàng
  { name: 'Alaxan', active: '', strength: '', form: 'viên', row: 2, side: 'trái', count: 1, confidence: 'thấp' },        // độ chắc thấp
  { name: 'Xyz Forte', active: 'Amoxicillin + Acid clavulanic', strength: '875/125', form: 'viên', row: 3, side: '', count: 1, confidence: 'cao' },
]};
const props = proposeFromShelf(ds, reading, 'Tủ kê đơn');
ok(props.filter((p) => p.action === 'skip').length === 1 && props[4].action === 'skip', 'độ chắc thấp → mặc định bỏ qua, các dòng khác không bị bỏ');
ok(props[1].action === 'add' && props[5].action === 'add', 'thuốc chưa có → đề nghị thêm');
ok(props[2].action === 'update' && props[2].match?.name === 'Augmentin 625', 'Augmentin 625 khớp gần giống, vẫn đề nghị cập nhật (độ chắc vừa)');
const applied = applyShelfProposals(ds, props, { rxCabinet: true });
ok(applied.updated === 3 && applied.added === 2, `cập nhật ${applied.updated} (mong 3), thêm ${applied.added} (mong 2)`);
const pan = applied.ds.drugs.find((d) => d.name === 'Panadol')!;
ok(pan.location === 'Tủ kê đơn · hàng 3 · phải', `trùng tên 2 dòng → lấy dòng sau: ${pan.location}`);
const cata = applied.ds.drugs.find((d) => d.name === 'Cataflam 25')!;
ok(cata.rx === true && cata.mg === 25 && cata.active === 'Diclofenac' && cata.location === 'Tủ kê đơn · hàng 2 · giữa', 'thuốc mới trong tủ kê đơn: rx=Có, mg=25, vị trí đúng');
const xyz = applied.ds.drugs.find((d) => d.name === 'Xyz Forte')!;
ok(xyz.isCombo && xyz.mg === null && xyz.mgText === '875/125', 'thuốc phối hợp: isCombo, mg null, mgText giữ nguyên');
ok(applied.ds.drugs.length === ds.drugs.length + 2 && ds.drugs.find((d) => d.name === 'Panadol')!.location === 'Kệ A1', 'không sửa dữ liệu gốc (immutable)');
// xuất → nạp
const b64 = toWorkbookBase64(applied.ds);
const wb = read(Buffer.from(b64, 'base64'));
const back = parseWorkbook(wb, 'roundtrip.xlsx');
ok(back.errors.length === 0, `nạp lại 0 lỗi (thực: ${back.errors.length}) ${back.errors.map((e) => e.row + ':' + e.message).join(' | ')}`);
ok(back.drugs.length === applied.ds.drugs.length, `số thuốc giữ nguyên ${back.drugs.length}`);
ok(back.drugs.find((d) => d.name === 'Cataflam 25')?.location === 'Tủ kê đơn · hàng 2 · giữa' && back.drugs.find((d) => d.name === 'Cataflam 25')?.rx === true, 'vị trí + kê đơn của thuốc mới sống qua Excel');
ok(back.rules.length === ds.rules.length && back.symptoms.length === ds.symptoms.length && back.redFlags.length === ds.redFlags.length, 'luật, triệu chứng, cờ đỏ giữ nguyên');
ok(back.symptoms.every((s) => s.synonyms.length === ds.symptoms.find((x) => x.name === s.name)!.synonyms.length), 'cột Khách hay nói sống qua Excel');

console.log('\n=== 3. Gọi SDK Claude với máy chủ giả ===');
const seen: any[] = [];
const fakeFetch = (body: object, status = 200) => async (_url: any, init: any) => {
  seen.push({ url: String(_url), headers: init?.headers, body: JSON.parse(init.body) });
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
};
const shelfJson = { rows_total: 2, cabinet_label: 'THUỐC KÊ ĐƠN', items: [{ name: 'Vipocef 100', active: 'Cefpodoxim', strength: '100mg', form: 'viên', row: 2, side: 'trái', count: 4, confidence: 'cao' }] };
const okMsg = (text: string) => ({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5', content: [{ type: 'text', text }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1500, output_tokens: 200 } });
const clientOk = new Anthropic({ apiKey: 'sk-ant-test', dangerouslyAllowBrowser: true, fetch: fakeFetch(okMsg(JSON.stringify(shelfJson))) as any, maxRetries: 0 });
const img = { base64: 'aGVsbG8=', mediaType: 'image/jpeg' as const };
const r1 = await readShelfImage(clientOk, img);
ok(r1.items[0].name === 'Vipocef 100' && r1.items[0].row === 2, 'parse kết quả kệ đúng schema');
const req = seen[0];
ok(req.url.endsWith('/v1/messages') && req.body.model === 'claude-opus-5', `gửi tới /v1/messages, model ${req.body.model}`);
ok(req.body.messages[0].content[0].type === 'image' && req.body.messages[0].content[0].source.media_type === 'image/jpeg' && req.body.messages[0].content[0].source.data === 'aGVsbG8=', 'ảnh gửi dạng base64 image/jpeg, đứng trước câu lệnh');
ok(req.body.output_config?.format?.type === 'json_schema' && req.body.output_config.format.schema?.properties?.items, 'yêu cầu trả JSON theo schema (output_config.format json_schema)');
ok(typeof req.body.messages[0].content[1].text === 'string' && req.body.messages[0].content[1].text.includes('TRÊN xuống'), 'câu lệnh đọc kệ có quy ước đếm hàng từ trên xuống');
ok(new Headers(req.headers).get('x-api-key') === 'sk-ant-test', 'khoá đi trong header x-api-key');
ok(req.body.thinking === undefined || req.body.thinking?.type === 'adaptive', 'không gửi tham số thinking lỗi thời');

const clientRefuse = new Anthropic({ apiKey: 'k', dangerouslyAllowBrowser: true, maxRetries: 0, fetch: fakeFetch({ ...okMsg(''), content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: null, explanation: null } }) as any });
try { await readShelfImage(clientRefuse, img); ok(false, 'từ chối phải ném VisionRefusal'); } catch (e) { ok(e instanceof VisionRefusal, `từ chối → VisionRefusal: "${(e as Error).message}"`); }

const clientBad = new Anthropic({ apiKey: 'k', dangerouslyAllowBrowser: true, maxRetries: 0, fetch: fakeFetch(okMsg('không phải json {')) as any });
try { await readShelfImage(clientBad, img); ok(false, 'JSON hỏng phải báo lỗi'); } catch (e) { ok(!(e instanceof VisionRefusal), `JSON hỏng → lỗi thường: "${(e as Error).message.slice(0, 60)}"`); }

const client401 = new Anthropic({ apiKey: 'sai', dangerouslyAllowBrowser: true, maxRetries: 0, fetch: fakeFetch({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 401) as any });
try { await readPrescriptionImage(client401, img); ok(false, '401 phải ném lỗi'); } catch (e) { ok(e instanceof Anthropic.AuthenticationError && String((e as Error).message).includes('401'), `khoá sai → AuthenticationError có chữ 401 để UI nhận ra: "${(e as Error).message.slice(0, 50)}"`); }

const rxJson = { kind: 'toa', note: '', items: [{ name: 'Panadol', strength: '500mg', quantity: '10 viên', instruction: '1 viên khi sốt', confidence: 'cao' }, { name: 'Zinnat', strength: '500', quantity: '', instruction: '', confidence: 'thấp' }] };
const clientRx = new Anthropic({ apiKey: 'k', dangerouslyAllowBrowser: true, maxRetries: 0, fetch: fakeFetch(okMsg(JSON.stringify(rxJson))) as any });
const rx = await readPrescriptionImage(clientRx, img);
const rxProps = proposeFromPrescription(ds, rx);
ok(rxProps[0].match?.name === 'Panadol' && rxProps[0].match.location === 'Kệ A1', 'toa: Panadol → 📍 Kệ A1');
ok(rxProps[1].match === null, 'toa: Zinnat → chưa có ở quầy');
const created = makeClient('sk-ant-x');
ok(created instanceof Anthropic, 'makeClient tạo được client với dangerouslyAllowBrowser');

console.log(fails === 0 ? '\nTẤT CẢ ĐẠT' : `\n${fails} KIỂM TRA THẤT BẠI`);
process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
