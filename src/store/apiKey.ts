import * as SecureStore from 'expo-secure-store';

const KEY = 'catlieu.claude_api_key';

export async function getApiKey(): Promise<string | null> {
  try { return await SecureStore.getItemAsync(KEY); } catch { return null; }
}
export async function setApiKey(v: string): Promise<void> {
  const t = v.trim();
  if (!t) { await SecureStore.deleteItemAsync(KEY); return; }
  await SecureStore.setItemAsync(KEY, t);
}
export function maskKey(k: string): string {
  return k.length <= 12 ? '••••' : `${k.slice(0, 7)}…${k.slice(-4)}`;
}
