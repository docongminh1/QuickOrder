import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { DataSet } from '../engine/types';
import { clearDataSet, loadDataSet, sampleDataSet, saveDataSet } from './storage';

interface Ctx {
  data: DataSet;
  ready: boolean;
  replace: (ds: DataSet) => Promise<void>;
  resetToSample: () => Promise<void>;
}

const DataContext = createContext<Ctx | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<DataSet>(() => sampleDataSet());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadDataSet().then((ds) => { setData(ds); setReady(true); });
  }, []);

  const value = useMemo<Ctx>(() => ({
    data,
    ready,
    replace: async (ds) => { setData(ds); await saveDataSet(ds); },
    resetToSample: async () => { await clearDataSet(); setData(sampleDataSet()); },
  }), [data, ready]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): Ctx {
  const c = useContext(DataContext);
  if (!c) throw new Error('useData ngoài DataProvider');
  return c;
}
