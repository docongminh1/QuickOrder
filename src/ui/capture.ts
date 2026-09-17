import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import type { ImageInput } from '../engine/vision';

/** Chụp hoặc chọn 1 ảnh, thu nhỏ còn tối đa 1600px, trả base64 JPEG. null = người dùng huỷ. */
export async function captureImage(source: 'camera' | 'library'): Promise<ImageInput | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Chưa cho phép dùng máy ảnh. Vào Cài đặt điện thoại → Ứng dụng → Cắt Liều Nhanh → Quyền → Máy ảnh.');
  }
  const res = source === 'camera'
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: false })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: false, selectionLimit: 1 });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  const longest = Math.max(a.width ?? 0, a.height ?? 0);
  const scale = longest > 1600 ? 1600 / longest : 1;
  const out = await manipulateAsync(
    a.uri,
    scale < 1 ? [{ resize: { width: Math.round((a.width ?? 0) * scale), height: Math.round((a.height ?? 0) * scale) } }] : [],
    { compress: 0.82, format: SaveFormat.JPEG, base64: true },
  );
  if (!out.base64) throw new Error('Không lấy được dữ liệu ảnh.');
  return { base64: out.base64, mediaType: 'image/jpeg' };
}
