# Cắt Liều Nhanh — hướng dẫn cho Claude

App Android (Expo SDK 57, React Native, TypeScript) cho quầy thuốc: nhân viên **không phải dược sĩ** chấm triệu chứng
→ app ra thuốc + liều theo dữ liệu **dược sĩ điền trong Excel**. Không backend, không lưu khách, không lưu lịch sử.

## Nguyên tắc đã chốt với chủ app (đừng làm ngược lại)
- Chỉ Android. Không iOS. Không dùng dịch vụ đám mây của Expo (EAS Build / Updates).
- Bộ não là luật rõ ràng trong Excel (`CatLieuNhanh_mau.xlsx`), không AI, không tự bịa liều. Dữ liệu mẫu chỉ là ví dụ.
- App phải ép người mới đi đúng luồng: 1 ai uống → 2 tình trạng đặc biệt → 3 dấu hiệu nguy hiểm (chấm là KHÔNG ra thuốc)
  → 4 chấm triệu chứng (tìm theo "Khách hay nói") → 5 kết quả (số gói/viên mỗi lần, tổng theo ngày) → "Khách mới".
  Chưa trả lời bước 2 và 3 thì không hiện thuốc. Giữ nguyên hành vi này khi sửa.
- Màu đỏ = dừng tay, gọi dược sĩ. Đừng làm mềm các câu chặn.

## Cấu trúc
- `src/engine/` — parse Excel (`parse.ts`), tính liều (`dosing.ts`), tra thuốc (`lookup.ts`), soát dữ liệu (`audit.ts`). Thuần TS, test được bằng `npx tsx`.
- `src/screens/` — 3 tab: Cắt liều, Tra thuốc, Dữ liệu. `src/ui/` — component + màu.
- `src/data/sample.json` + `src/data/templateBase64.ts` + `CatLieuNhanh_mau.xlsx` đều **sinh từ** `tools/make_template.py`.
  Muốn đổi dữ liệu mẫu hay cột Excel: sửa script rồi `python3 tools/make_template.py`, không sửa tay 3 file kia.
- Excel 4 sheet: Thuốc (Còn hàng, Kê đơn) · Luật cắt liều (mg/kg/lần HOẶC mg cố định HOẶC Liều ghi tay) · Triệu chứng (Khách hay nói)
  · Dấu hiệu nguy hiểm. Dòng bắt đầu bằng `↳` là ví dụ, parser bỏ qua.

## Đọc ảnh bằng Claude (`src/engine/vision.ts`)
- SDK `@anthropic-ai/sdk`, model `claude-opus-5`, `messages.parse` + `zodOutputFormat`. Khoá do dược sĩ dán vào app, lưu `expo-secure-store`; KHÔNG nhúng khoá vào code hay Excel.
- Ảnh chỉ dùng để trả lời "thuốc nằm đâu" (kệ) và "toa ghi gì" (toa). KHÔNG bao giờ để AI quyết liều: liều luôn từ sheet Luật.
- Phần khớp tên/áp dụng (`matchDrug`, `proposeFromShelf`, `applyShelfProposals`, `proposeFromPrescription`) thuần TS, test offline `npx tsx tools/test-vision.ts`.

## Test trước khi đẩy code
```bash
npx tsc --noEmit -p .
npx tsx tools/engine-test.ts      # luồng cơ bản + parse xlsx mẫu
npx tsx tools/test-roles.ts       # vai dược sĩ sửa Excel có lỗi + vai nhân viên
npx tsx tools/sim-500.ts          # 500 khách ngẫu nhiên
npx tsx tools/sim-novice.ts       # lời khách nói → chip, gõ sai tên thuốc
npx tsx tools/audit-test.ts       # soát dữ liệu file mẫu
npx tsx tools/test-vision.ts      # khớp kết quả đọc ảnh (giả lập, không gọi mạng)
npx tsx tools/test-vision-deep.ts # 20 ca khớp tên + áp dụng → xuất Excel → nạp lại + SDK qua fetch giả (từ chối, 401, JSON hỏng)
```

## Phát hành
- Đẩy lên `main` là GitHub Actions (`.github/workflows/build-apk.yml`) tự build APK ký sẵn và chép vào Google Drive
  `My Drive/CatLieuNhanh/` (xoá APK bản cũ, kèm xlsx + HUONG_DAN.md). Khoảng 13–15 phút. File `*.md` không kích hoạt build.
- Mỗi lần đổi code chạy được phải tăng `version` và `android.versionCode` trong `app.json`.
- Keystore và mật khẩu nằm trong GitHub Secrets, không bao giờ commit `android/`, `*.keystore`, `keystore.properties`.
- Khi làm trên Mac của chủ app: `tools/build-apk.sh` build local, có máy ảo Android `cln_test` để bấm thử bằng adb.
  Bẫy adb: phím BACK trên tab khác sẽ nhảy về tab đầu; `input text` không nhận dấu cách.
- Cập nhật `HUONG_DAN.md` mỗi khi đổi luồng dùng.
