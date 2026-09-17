/** Chuẩn hoá chữ để so khớp: bỏ dấu, thường hoá, gộp khoảng trắng. */
export function norm(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function text(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/** "12,5" | 12.5 | "500" | "500mg" | "500 mg" | "3g" → số mg; chữ khác → null */
export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim().toLowerCase().replace(',', '.').replace(/\s+/g, '');
  const m = s.match(/^(-?\d+(?:\.\d+)?)(mg|ml|g|mcg|µg|vien|goi|viên|gói)?$/);
  if (!m) return null;
  let n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  if (m[2] === 'g') n *= 1000;
  if (m[2] === 'mcg' || m[2] === 'µg') n /= 1000;
  return n;
}

/** "3-4" | "3–4" | 3 | "3 lần/ngày" | "2-3 lần" | "x3" → {label:"3–4", max:4}; không có số → giữ chữ, max null */
export function times(v: unknown): { label: string; max: number | null } {
  const raw = text(v);
  if (!raw) return { label: '', max: null };
  const s = raw.replace(/\s/g, '');
  const range = s.match(/(\d+(?:[.,]\d+)?)(?:[-–—]|den|đến|toi|tới)(\d+(?:[.,]\d+)?)/i);
  if (range) return { label: `${range[1]}–${range[2]}`, max: num(range[2]) };
  const single = s.match(/(\d+(?:[.,]\d+)?)/);
  if (single) return { label: String(num(single[1])), max: num(single[1]) };
  return { label: raw, max: null };
}

/** "60/kg" | "60 mg/kg" | "60mg/kg/ngày" → {perKg:60}; "3000" | "3000 mg" | "3g" → {abs} */
export function maxPerDay(v: unknown): { abs: number | null; perKg: number | null } {
  const s = norm(v).replace(/\s/g, '');
  if (!s) return { abs: null, perKg: null };
  const m = s.match(/(\d+(?:[.,]\d+)?)(mg|g)?(?:\/|per)kg/);
  if (m) return { abs: null, perKg: num(m[1] + (m[2] ?? '')) };
  const a = s.match(/(\d+(?:[.,]\d+)?)(mg|g)?/);
  if (a) return { abs: num(a[1] + (a[2] ?? '')), perKg: null };
  return { abs: null, perKg: null };
}

export function splitActives(active: string): string[] {
  return active.split('+').map((x) => x.trim()).filter(Boolean);
}

/** 0.25 → "¼", 1.5 → "1½" */
export function fmtUnits(u: number): string {
  const whole = Math.floor(u);
  const frac = Math.round((u - whole) * 4) / 4;
  const fracTxt = { 0: '', 0.25: '¼', 0.5: '½', 0.75: '¾' }[frac as 0 | 0.25 | 0.5 | 0.75] ?? '';
  if (whole === 0) return fracTxt || '0';
  return `${whole}${fracTxt}`;
}

export function fmtMg(mg: number): string {
  const r = Math.round(mg * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r).replace('.', ',');
}
