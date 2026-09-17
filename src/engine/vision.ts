/**
 * Đọc ảnh bằng Claude: (1) ảnh kệ → thuốc + hàng/vị trí, (2) ảnh toa/hộp → tên thuốc + số lượng.
 * Phần gọi API tách khỏi phần khớp dữ liệu để test được không cần mạng.
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { norm } from './normalize';
import type { DataSet, Drug } from './types';

export const MODEL = 'claude-opus-5';

// ---------------------------------------------------------------- schema
export const ShelfItem = z.object({
  name: z.string().describe('Tên thương mại in trên hộp, đúng chữ nhìn thấy'),
  active: z.string().describe('Hoạt chất nếu đọc được hoặc biết chắc, ngược lại để trống'),
  strength: z.string().describe('Hàm lượng như in trên hộp, vd "500mg", "500/125mg"; trống nếu không đọc được'),
  form: z.string().describe('viên, gói, siro, chai, tuýp, ống... ; trống nếu không rõ'),
  row: z.number().int().describe('Hàng/tầng kệ đếm từ TRÊN xuống, bắt đầu 1'),
  side: z.enum(['trái', 'giữa', 'phải', '']).describe('Vị trí ngang trong hàng'),
  count: z.number().int().describe('Số hộp nhìn thấy'),
  confidence: z.enum(['cao', 'vừa', 'thấp']).describe('cao = đọc rõ tên và hàm lượng; thấp = đoán'),
});
export const ShelfReading = z.object({
  rows_total: z.number().int().describe('Tổng số hàng/tầng nhìn thấy'),
  cabinet_label: z.string().describe('Chữ nhãn dán trên tủ/kệ nếu có, vd "THUỐC KÊ ĐƠN"; trống nếu không'),
  items: z.array(ShelfItem),
});
export type ShelfReadingT = z.infer<typeof ShelfReading>;

export const RxItem = z.object({
  name: z.string().describe('Tên thuốc như ghi trên toa/hộp'),
  strength: z.string().describe('Hàm lượng nếu ghi'),
  quantity: z.string().describe('Số lượng như ghi, vd "10 viên", "2 hộp"; trống nếu không ghi'),
  instruction: z.string().describe('Cách dùng như ghi trên toa, nguyên văn ngắn gọn'),
  confidence: z.enum(['cao', 'vừa', 'thấp']),
});
export const PrescriptionReading = z.object({
  kind: z.enum(['toa', 'hộp thuốc', 'khác']).describe('Ảnh là toa thuốc, hộp thuốc, hay thứ khác'),
  items: z.array(RxItem),
  note: z.string().describe('Ghi chú ngắn cho nhân viên: chữ mờ, thiếu trang, chỗ không đọc được'),
});
export type PrescriptionReadingT = z.infer<typeof PrescriptionReading>;

// ---------------------------------------------------------------- gọi Claude
export function makeClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2, timeout: 120_000 });
}

export type ImageInput = { base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' };

export class VisionRefusal extends Error {}

const SHELF_PROMPT = `Đây là ảnh một kệ/tủ thuốc ở quầy thuốc Việt Nam. Liệt kê TẤT CẢ hộp thuốc nhìn thấy.
- Đếm hàng (tầng) từ TRÊN xuống, hàng trên cùng là 1. Chỉ tính hàng có hộp.
- side: hộp nằm phần trái/giữa/phải của hàng đó.
- name: chép đúng chữ in trên hộp (kể cả số đi kèm như "Vipocef 100"). Cùng tên cùng hàm lượng thì gộp 1 dòng, tăng count.
- strength: chỉ điền khi đọc được trên hộp. Không đoán.
- active: chỉ điền khi đọc được trên hộp hoặc là thuốc rất quen thuộc bạn chắc chắn; không chắc thì để trống.
- confidence thấp khi chữ mờ, bị che, hoặc bạn đoán tên.
Không bỏ sót hộp nào; hộp không đọc được tên thì name = "không đọc được" và mô tả màu/hình trong strength.`;

const RX_PROMPT = `Đây là ảnh khách đưa ở quầy thuốc Việt Nam: có thể là toa bác sĩ (in hoặc viết tay) hoặc hộp/vỏ thuốc.
Liệt kê từng thuốc đọc được: tên như ghi, hàm lượng, số lượng như ghi, cách dùng nguyên văn ngắn.
Không suy ra liều, không thêm thuốc không có trong ảnh. Chữ tay khó đọc thì confidence thấp và ghi vào note.`;

export async function readShelfImage(client: Anthropic, img: ImageInput): Promise<ShelfReadingT> {
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.base64 } },
      { type: 'text', text: SHELF_PROMPT },
    ] }],
    output_config: { format: zodOutputFormat(ShelfReading) },
  });
  if (res.stop_reason === 'refusal') throw new VisionRefusal('Claude từ chối đọc ảnh này.');
  if (!res.parsed_output) throw new Error('Không đọc được kết quả từ Claude, thử chụp lại rõ hơn.');
  return res.parsed_output;
}

export async function readPrescriptionImage(client: Anthropic, img: ImageInput): Promise<PrescriptionReadingT> {
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.base64 } },
      { type: 'text', text: RX_PROMPT },
    ] }],
    output_config: { format: zodOutputFormat(PrescriptionReading) },
  });
  if (res.stop_reason === 'refusal') throw new VisionRefusal('Claude từ chối đọc ảnh này.');
  if (!res.parsed_output) throw new Error('Không đọc được kết quả từ Claude, thử chụp lại rõ hơn.');
  return res.parsed_output;
}

// ---------------------------------------------------------------- khớp với dữ liệu quầy (không cần mạng)
function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

function strengthNum(s: string): string {
  return norm(s).replace(/mg|ml|\s/g, '').replace(',', '.');
}

/** Khớp tên đọc từ ảnh với thuốc trong dữ liệu: ưu tiên tên + hàm lượng, rồi tên gần giống. */
export function matchDrug(ds: DataSet, name: string, strength = ''): { drug: Drug; exact: boolean } | null {
  const n = norm(name).replace(/\s*\(\?\)\s*/g, '').trim();
  if (!n || n === 'khong doc duoc') return null;
  const sNum = strengthNum(strength);
  const scored: { d: Drug; score: number }[] = [];
  for (const d of ds.drugs) {
    const dn = norm(d.name);
    let score = 99;
    if (dn === n) score = 0;
    else if (dn.startsWith(n) || n.startsWith(dn)) score = 1;
    else {
      const base = n.replace(/\s*\d+([.,]\d+)?(\s*\/\s*\d+)?\s*(mg)?\s*$/, '').trim(); // bỏ số hàm lượng ở cuối
      const dbase = dn.replace(/\s*\d+([.,]\d+)?(\s*\/\s*\d+)?\s*(mg)?\s*$/, '').trim();
      if (base && base === dbase) score = 2;
      else if (base.length >= 4 && lev(base, dbase) <= (base.length <= 6 ? 1 : 2)) score = 3;
    }
    if (score >= 99) continue;
    // hàm lượng: khớp thì cộng điểm, lệch thì phạt
    if (sNum && d.mgText) {
      const dm = strengthNum(d.mgText);
      if (dm === sNum || dm.replace('+', '/') === sNum.replace('+', '/')) score -= 0.5;
      else if (score > 0) score += 2;
    }
    scored.push({ d, score });
  }
  if (!scored.length) return null;
  scored.sort((a, b) => a.score - b.score);
  const best = scored[0];
  return { drug: best.d, exact: best.score <= 1 };
}

export function buildLocation(shelfName: string, row: number, side: string): string {
  const parts = [shelfName.trim() || 'Kệ', `hàng ${row}`];
  if (side) parts.push(side);
  return parts.join(' · ');
}

export interface ShelfProposal {
  key: string;
  read: z.infer<typeof ShelfItem>;
  location: string;
  match: Drug | null;
  exact: boolean;
  action: 'update' | 'add' | 'skip';   // đề nghị mặc định
}

/** Biến kết quả đọc thành danh sách đề nghị để dược sĩ tick */
export function proposeFromShelf(ds: DataSet, reading: ShelfReadingT, shelfName: string): ShelfProposal[] {
  return reading.items.map((it, i) => {
    const m = matchDrug(ds, it.name, it.strength);
    const location = buildLocation(shelfName, it.row, it.side);
    const unreadable = norm(it.name) === 'khong doc duoc';
    // đọc không chắc → mặc định bỏ qua, dược sĩ tự tick nếu đúng
    let action: ShelfProposal['action'] = 'skip';
    if (it.confidence !== 'thấp' && m) action = 'update';
    else if (it.confidence !== 'thấp' && !m && !unreadable) action = 'add';
    return { key: `${i}-${it.name}`, read: it, location, match: m?.drug ?? null, exact: m?.exact ?? false, action };
  });
}

/** Áp dụng đề nghị đã tick vào dữ liệu: cập nhật Vị trí, thêm thuốc mới (Kê đơn nếu tủ ghi vậy) */
export function applyShelfProposals(ds: DataSet, props: ShelfProposal[], opts: { rxCabinet: boolean }): { ds: DataSet; updated: number; added: number } {
  const drugs = ds.drugs.map((d) => ({ ...d }));
  let updated = 0, added = 0;
  for (const p of props) {
    if (p.action === 'update' && p.match) {
      const d = drugs.find((x) => x.name === p.match!.name);
      if (d) { d.location = p.location; if (!d.inStock) d.inStock = true; updated++; }
    } else if (p.action === 'add') {
      const active = p.read.active.trim() || '?';
      const actives = active.split('+').map((x) => x.trim()).filter(Boolean);
      const mgText = p.read.strength.replace(/mg/gi, '').trim();
      const mgNum = actives.length > 1 ? null : (Number(mgText.replace(',', '.')) || null);
      drugs.push({
        name: p.read.name.trim(), active, actives, isCombo: actives.length > 1,
        mg: mgNum, mgText, form: p.read.form.trim() || 'viên', brand: '', audience: 'Người lớn',
        inStock: true, rx: opts.rxCabinet, location: p.location,
        note: `thêm từ ảnh kệ ${new Date().toLocaleDateString('vi-VN')}${p.read.confidence !== 'cao' ? ' · chưa chắc, rà lại' : ''}`,
      });
      added++;
    }
  }
  return { ds: { ...ds, drugs }, updated, added };
}

export interface RxProposal {
  read: z.infer<typeof RxItem>;
  match: Drug | null;
  exact: boolean;
  alternatives: Drug[];  // cùng hoạt chất còn hàng, khi thuốc khớp hết hàng hoặc không khớp
}

export function proposeFromPrescription(ds: DataSet, reading: PrescriptionReadingT): RxProposal[] {
  return reading.items.map((it) => {
    const m = matchDrug(ds, it.name, it.strength);
    let alternatives: Drug[] = [];
    if (m && !m.drug.inStock) alternatives = ds.drugs.filter((d) => norm(d.active) === norm(m.drug.active) && d.inStock && d !== m.drug);
    return { read: it, match: m?.drug ?? null, exact: m?.exact ?? false, alternatives };
  });
}
