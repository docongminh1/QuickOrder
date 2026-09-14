export type Audience = 'Người lớn' | 'Trẻ em';
export type DrugAudience = Audience | 'Cả hai';

export interface Drug {
  name: string;
  active: string;          // như trong Excel, vd "Paracetamol + Caffein"
  actives: string[];       // tách theo dấu +
  isCombo: boolean;
  mg: number | null;       // hàm lượng 1 đơn vị (siro: mg / 5 ml)
  mgText: string;          // giữ nguyên chữ để hiện ("500 + 65")
  form: string;            // viên, gói, siro...
  brand: string;
  audience: DrugAudience;
  inStock: boolean;        // Còn hàng (mặc định có)
  rx: boolean;             // Kê đơn → không tự gợi ý
  note: string;
}

export interface Rule {
  row: number;
  symptom: string;
  audience: Audience;
  group: string;
  active: string;
  mgPerKg: number | null;
  mgFixed: number | null;
  mgFixedText: string;
  timesLabel: string;      // "3–4"
  timesMax: number | null; // 4
  maxAbs: number | null;   // 3000
  maxPerKg: number | null; // 60
  freeText: string;
  howTo: string;
  warning: string;
  priority: number;
}

export interface Symptom {
  name: string;
  group: string;
  order: number;
  synonyms: string[];      // "Khách hay nói"
}

export interface RedFlag {
  text: string;
  audience: DrugAudience;  // Cả hai / Trẻ em / Người lớn
  action: string;
}

export interface ImportError {
  sheet: string;
  row: number;
  message: string;
}

export interface DataSet {
  source: 'sample' | 'import';
  importedAt?: string;
  fileName?: string;
  drugs: Drug[];
  rules: Rule[];
  symptoms: Symptom[];
  redFlags: RedFlag[];
  errors: ImportError[];
}
