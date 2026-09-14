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

/** "12,5" | 12.5 | "500" → số; chữ khác → null */
export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "3-4" | "3–4" | 3 → {label:"3–4", max:4} */
export function times(v: unknown): { label: string; max: number | null } {
  const s = text(v).replace(/\s/g, '');
  if (!s) return { label: '', max: null };
  const m = s.match(/^(\d+(?:[.,]\d+)?)[-–—](\d+(?:[.,]\d+)?)$/);
  if (m) return { label: `${m[1]}–${m[2]}`, max: num(m[2]) };
  const n = num(s);
  return { label: n === null ? s : String(n), max: n };
}

/** "60/kg" → {perKg:60}; "3000" → {abs:3000} */
export function maxPerDay(v: unknown): { abs: number | null; perKg: number | null } {
  const s = text(v).replace(/\s/g, '').toLowerCase();
  if (!s) return { abs: null, perKg: null };
  const m = s.match(/^(\d+(?:[.,]\d+)?)\/kg$/);
  if (m) return { abs: null, perKg: num(m[1]) };
  return { abs: num(s), perKg: null };
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
