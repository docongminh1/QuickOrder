import { norm } from './normalize';
import type { DataSet, Drug } from './types';

export interface LookupResult {
  drug: Drug;
  sameMg: Drug[];     // cùng hoạt chất, cùng mg
  otherMg: Drug[];    // cùng hoạt chất, khác mg
  combos: Drug[];     // có chứa hoạt chất này + chất khác
}

export function searchDrugs(data: DataSet, q: string, limit = 30): Drug[] {
  const n = norm(q);
  if (!n) return [];
  const starts: Drug[] = [];
  const contains: Drug[] = [];
  for (const d of data.drugs) {
    const name = norm(d.name);
    const act = norm(d.active);
    if (name.startsWith(n)) starts.push(d);
    else if (name.includes(n) || act.includes(n)) contains.push(d);
  }
  return [...starts, ...contains].slice(0, limit);
}

/** Khoảng cách chỉnh sửa (gõ sai 1–2 ký tự) */
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

/** "Có phải bạn tìm…": tên thuốc / hoạt chất gần giống khi tìm không ra */
export function suggestDrugs(data: DataSet, q: string, limit = 5): Drug[] {
  const n = norm(q).replace(/\s+/g, '');
  if (n.length < 3) return [];
  const scored: { d: Drug; s: number }[] = [];
  for (const d of data.drugs) {
    const cands = [norm(d.name).replace(/\s+/g, ''), ...norm(d.name).split(' '), ...norm(d.active).split(/[ +]/)].filter((x) => x.length >= 3);
    let best = 99;
    for (const c of cands) {
      const head = c.slice(0, n.length);
      best = Math.min(best, lev(n, c), lev(n, head));
    }
    const tol = n.length <= 5 ? 1 : 2;
    if (best <= tol) scored.push({ d, s: best });
  }
  const seen = new Set<string>();
  return scored.sort((a, b) => a.s - b.s).map((x) => x.d).filter((d) => (seen.has(d.name) ? false : (seen.add(d.name), true))).slice(0, limit);
}

export function lookup(data: DataSet, drug: Drug): LookupResult {
  const a = norm(drug.active);
  const sameMg: Drug[] = [];
  const otherMg: Drug[] = [];
  const combos: Drug[] = [];
  for (const d of data.drugs) {
    if (d === drug) continue;
    if (norm(d.active) === a) {
      if (d.mg !== null && drug.mg !== null && Math.abs(d.mg - drug.mg) < 1e-9) sameMg.push(d);
      else if (d.mg === null && drug.mg === null && norm(d.mgText) === norm(drug.mgText)) sameMg.push(d);
      else otherMg.push(d);
    } else if (!drug.isCombo && d.actives.some((x) => norm(x) === a)) {
      combos.push(d);
    } else if (drug.isCombo && drug.actives.some((x) => norm(d.active) === norm(x))) {
      // thuốc đang tra là phối hợp → thuốc đơn chất của từng thành phần
      otherMg.push(d);
    }
  }
  const stockFirst = (a: Drug, b: Drug) => Number(b.inStock) - Number(a.inStock);
  return { drug, sameMg: sameMg.sort(stockFirst), otherMg: otherMg.sort(stockFirst), combos: combos.sort(stockFirst) };
}
