# Vai dược sĩ: sửa file mẫu như người thật hay làm, kể cả vài lỗi thường gặp
from openpyxl import load_workbook
wb = load_workbook('CatLieuNhanh_mau.xlsx')
d = wb['Thuốc']; r = wb['Luật cắt liều']; s = wb['Triệu chứng']
# 1. thêm thuốc mới quầy đang có
d.append(['Decolgen Forte', 'Paracetamol + Phenylephrin + Chlorpheniramin', '500 + 10 + 2', 'viên', 'United', 'Người lớn', 'cảm cúm'])
d.append(['Tiffy', 'Paracetamol + Phenylephrin + Chlorpheniramin', '500 + 10 + 2', 'viên', 'Thai Nakorn', 'Người lớn', ''])
d.append(['Coldacmin Flu', 'Paracetamol + Clorpheniramin', '325 + 2', 'viên', 'DHG', 'Người lớn', ''])
d.append(['Augmentin 625', 'Amoxicillin + Acid clavulanic', '500 + 125', 'viên', 'GSK', 'Người lớn', 'KÊ ĐƠN'])
# 2. gõ sai chính tả hoạt chất ở luật (lỗi hay gặp)
r.append(['Cảm cúm', 'Người lớn', 'Cảm cúm', 'Paracetamol + Phenylephrin + Chlorpheniramin', '', '', 3, '', '1 viên × 3 lần/ngày sau ăn', '', 'Buồn ngủ, không lái xe', 1])
r.append(['Cảm cúm', 'Trẻ em', 'Hạ sốt, giảm đau', 'Paracetamol', 12.5, '', '3-4', '60/kg', '', '', '', 1])
r.append(['Cảm cúm', 'Trẻ em', 'Kháng dị ứng', 'Loratadine', '', 5, 1, '', '', '', '', 1])   # sai chính tả: Loratadine vs Loratadin
# 3. điền cả 2 cột mg
r.append(['Đau đầu', 'Trẻ em', 'Hạ sốt, giảm đau', 'Ibuprofen', 7.5, 200, 3, '30/kg', '', 'sau ăn', '', 2])
# 4. quên đối tượng
r.append(['Sốt', '', 'Hạ sốt, giảm đau', 'Paracetamol', '', 650, 3, '', '', '', '', 3])
# 5. thiếu liều hoàn toàn
r.append(['Mệt mỏi', 'Trẻ em', 'Bổ trợ', 'Kẽm', '', '', '', '', '', '', '', 2])
# 6. thuốc mới không có cột Dạng
d.append(['Siro ho Bảo Thanh', 'Thảo dược', '', '', 'Hoa Linh', 'Cả hai', ''])
# 7. triệu chứng mới không thêm vào sheet Triệu chứng (Cảm cúm) - app tự thêm?
# 8. nhập số kiểu Việt "12,5" dạng chữ
r.append(['Đau răng', 'Trẻ em', 'Hạ sốt, giảm đau', 'Ibuprofen', '7,5', '', 3, '30/kg', '', 'sau ăn', '', 2])
wb.save('/private/tmp/claude-501/-Users-docongminh-Desktop-AICC/0d694266-42d4-46f9-afc8-76032dd8525c/scratchpad/duocsi_sua.xlsx')
print('saved')
