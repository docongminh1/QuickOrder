# Cắt Liều Nhanh · hướng dẫn nhanh

## Cài trên Android
1. Chép file `CatLieuNhanh-v1.0.6.apk` vào điện thoại (hoặc mở thẳng từ Google Drive trên điện thoại).
2. Bấm vào file, Android hỏi "Cho phép cài ứng dụng từ nguồn này" → Cho phép → Cài đặt.
3. Mở app. Lúc đầu app đã có sẵn bộ dữ liệu mẫu (59 thuốc, 81 dòng luật, 26 triệu chứng) để bấm thử ngay.

## Màn Cắt liều có 5 bước, làm theo thứ tự
1. **Ai uống?** Người lớn hay Trẻ em (dưới 12 tuổi). Trẻ em thì hỏi cân nặng, gõ vào ô Cân.
2. **Khách có gì đặc biệt?** Hỏi: có thai/cho bú, đau dạ dày, dị ứng thuốc, trên 65 tuổi, đang uống thuốc khác. Không có thì bấm "Không có gì đặc biệt". Chấm cái nào có → app bắt gọi dược sĩ duyệt và đánh dấu đỏ thuốc cần tránh. **Chưa trả lời bước này thì app chưa hiện thuốc.**
3. **Dấu hiệu nguy hiểm?** Bấm "Xem câu hỏi", hỏi khách. Không có thì bấm "✓ Không có dấu hiệu nào". Chấm 1 dấu hiệu là app KHÔNG ra thuốc, chỉ hiện "đi khám / gọi dược sĩ". Danh sách này dược sĩ sửa trong sheet *Dấu hiệu nguy hiểm*. **Chưa trả lời bước này thì app chưa hiện thuốc.**
4. **Khách bị gì?** Gõ lời khách nói ("đi ngoài", "nhức đầu", "nổi mẩn") vào ô tìm, app lọc ra chip đúng, bấm chip. Từ khách hay nói dược sĩ điền ở cột *Khách hay nói* sheet Triệu chứng.
5. **Thuốc cần cắt.** Dòng đen ghi rõ đang tính cho ai, mấy ngày. Đọc từng thẻ, lấy đúng số "Cắt đủ N ngày". Xong bấm **Khách mới** để xoá sạch, khỏi dính cân nặng khách trước.

## 3 tab trong app
- **Cắt liều**: chọn Người lớn / Trẻ em, gõ số kg (trẻ em), chấm triệu chứng, chọn cắt cho mấy ngày → danh sách thuốc, hàm lượng, số gói/viên mỗi lần, số lần/ngày và **tổng số gói/viên cần cắt**. Dòng xanh nhỏ là phép tính để kiểm lại. Quên nhập kg thì app nhắc đỏ.
- **Tra thuốc**: gõ tên thuốc (vd Panadol) → hoạt chất + các thuốc cùng hoạt chất, chia cùng mg / khác mg / có thêm chất khác. Thuốc đánh **Hết** trong Excel hiện nhãn đỏ và app gợi câu trả lời khách kèm thuốc thay. Thuốc **Kê đơn** hiện nhãn đỏ, không tự gợi ý ở tab Cắt liều.
- **Dữ liệu**: nạp file Excel của bạn, tải file mẫu, xuất dữ liệu đang dùng, về lại mẫu.

## Đọc ảnh bằng Claude (tuỳ chọn, cần mạng)
Hai việc app có thể đọc từ ảnh, đều phải người xác nhận trước khi dùng:
- **Chụp kệ → cập nhật vị trí** (tab Dữ liệu): ghi tên kệ, chụp một tấm thẳng đủ sáng. App liệt kê từng hộp đọc được, khớp với thuốc trong Excel, đề nghị vị trí "Kệ 1 · hàng 2 · trái". Dược sĩ chấm ✓ dòng đúng, sửa chữ vị trí nếu cần, bấm Lưu. Dòng "độ chắc thấp" mặc định bỏ qua. Lưu xong nhớ **Xuất dữ liệu đang dùng ra Excel** để giữ bản mới.
- **Đọc toa / hộp thuốc khách đưa** (nút 📷 ở tab Tra thuốc): app đọc tên và số lượng ghi trên toa, chỉ chỗ lấy, báo hết hàng hoặc kê đơn. KHÔNG tự tính liều. Hỏi lại khách "đúng thuốc này không?" trước khi lấy.

Cần một **khoá Claude** của quầy: tạo tại console.anthropic.com → API Keys, dán vào tab Dữ liệu → "Khoá Claude". Khoá nằm trong vùng bảo mật của máy. Mỗi tấm ảnh tốn vài trăm đồng, trả cho Anthropic theo lượng dùng.

## Điền file Excel (dành cho dược sĩ)
- Ô có mũi tên thả xuống (Triệu chứng, Hoạt chất, Đối tượng, Dạng, Còn hàng) → **chọn**, đừng gõ, để khỏi sai chính tả. Hoạt chất trong sheet Luật lấy thẳng từ sheet Thuốc.
- Dòng 2 màu mờ là ví dụ, app bỏ qua, đừng xoá. Ô bắt buộc để trống sẽ tự tô đỏ.
- Thêm bài mới theo thứ tự: sheet Thuốc có thuốc + hoạt chất → sheet Triệu chứng có tên + "Khách hay nói" → sheet Luật 1 dòng Người lớn, 1 dòng Trẻ em.
- Nạp xong vào app, tab Dữ liệu → "Soát dữ liệu cho dược sĩ" liệt kê chỗ app sẽ lúng túng: triệu chứng thiếu luật trẻ em, hoạt chất không có thuốc còn hàng, luật theo kg thiếu tối đa/ngày…

File `CatLieuNhanh_mau.xlsx` có 4 sheet: Hướng dẫn, Thuốc, Luật cắt liều, Triệu chứng.
Ô tiêu đề màu đậm là cột bắt buộc. Di chuột lên tiêu đề để xem chú thích cột.

- **Thuốc**: 1 dòng 1 thuốc. Cột *Hoạt chất* phải viết giống nhau giữa các thuốc (Paracetamol, không lúc Paracetamol lúc Para). Cột *Còn hàng*: Có / Hết; thuốc khách hay hỏi mà quầy chưa nhập cũng ghi vào và đánh Hết để nhân viên tra được. Cột *Kê đơn*: ghi Có với kháng sinh, corticoid… Cột *Vị trí*: ghi đúng nhãn dán trên kệ (Kệ A3, Ngăn kéo 2, Tủ lạnh); app in 📍 dưới tên thuốc, và gõ mã kệ ở tab Tra thuốc sẽ ra hết thuốc kệ đó.
- **Luật cắt liều**: 1 dòng = 1 triệu chứng + 1 đối tượng + 1 hoạt chất. Điền **mg/kg/lần** (app nhân với số kg) HOẶC **mg cố định/lần**. Thuốc không tính theo mg (xịt, nhỏ, ml) thì ghi vào **Liều ghi tay**.
- **Triệu chứng**: chỉ để xếp chip cho gọn.

Sửa xong → lưu .xlsx → gửi vào điện thoại (Drive / Zalo) → app → tab Dữ liệu → **Nạp file Excel**.
App báo bao nhiêu dòng nạp được và dòng nào lỗi vì sao; dòng lỗi bị bỏ qua, dòng còn lại vẫn chạy.

## Kịch bản cho nhân viên mới
- Khách xin cắt liều: hỏi người lớn hay trẻ em, trẻ em thì hỏi cân nặng, hỏi bị gì → chấm chip → đọc theo từng thẻ thuốc: tên, số gói/viên mỗi lần, mấy lần/ngày, dòng "Cắt đủ N ngày" là số lượng lấy ra. Đọc khung vàng cảnh báo cho khách. Khung vàng cuối nhắc hỏi có thai / dị ứng / dạ dày, có thì gọi dược sĩ.
- Khách hỏi "có thuốc X không": qua Tra thuốc gõ X. Còn hàng → có. Hết → app gợi sẵn câu trả lời và thuốc thay cùng hoạt chất. Không tìm thấy → "em chưa có", hỏi khách thuốc trị gì rồi qua Cắt liều.
- Khách hỏi "thuốc X thay bằng gì": Tra thuốc → mục "Cùng hoạt chất, cùng mg" là thay được nguyên xi; "khác mg" phải chỉnh số viên → hỏi dược sĩ nếu không chắc.

## Lưu ý
- Dữ liệu mẫu trong file là ví dụ theo liều OTC thông dụng, dược sĩ kiểm lại trước khi dùng thật.
- App không lưu khách, không cần mạng, không gửi dữ liệu đi đâu.
- Muốn đổi dữ liệu thì nạp Excel mới, không cần cài lại app.
