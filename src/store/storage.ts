import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DataSet } from '../engine/types';
import { fromSample } from '../engine/parse';
import sample from '../data/sample.json';

const KEY = 'catlieu.dataset.v1';

export function sampleDataSet(): DataSet {
  return fromSample(sample as never);
}

export async function loadDataSet(): Promise<DataSet> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const ds = JSON.parse(raw) as DataSet;
      if (ds && Array.isArray(ds.drugs) && Array.isArray(ds.rules)) return ds;
    }
  } catch {
    // hỏng thì dùng mẫu
  }
  return sampleDataSet();
}

export async function saveDataSet(ds: DataSet): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(ds));
}

export async function clearDataSet(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
