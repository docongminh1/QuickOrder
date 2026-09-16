# -*- coding: utf-8 -*-
"""Sinh file Excel mẫu (3 sheet + Hướng dẫn), JSON dữ liệu mẫu và file TS chứa template base64.
Chạy: python3 tools/make_template.py
"""
import json, base64, io, os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.comments import Comment

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------- Thuốc
# Tên thuốc | Hoạt chất | mg | Dạng | Hãng | Đối tượng | Còn hàng | Kê đơn | Vị trí | Ghi chú
DRUGS = [
 ("Panadol", "Paracetamol", 500, "viên", "GSK", "Người lớn", "Có", "", "Kệ A1", ""),
 ("Hapacol 500", "Paracetamol", 500, "viên", "DHG", "Người lớn", "Có", "", "Kệ A2", ""),
 ("Efferalgan 500", "Paracetamol", 500, "viên sủi", "UPSA", "Người lớn", "Có", "", "Kệ A3", ""),
 ("Tylenol 500", "Paracetamol", 500, "viên", "Janssen", "Người lớn", "Có", "", "Kệ B1", ""),
 ("Partamol 500", "Paracetamol", 500, "viên", "Stella", "Người lớn", "Có", "", "Kệ B2", ""),
 ("Hapacol 250", "Paracetamol", 250, "gói", "DHG", "Trẻ em", "Có", "", "Kệ B3", "bột sủi vị cam"),
 ("Hapacol 150", "Paracetamol", 150, "gói", "DHG", "Trẻ em", "Có", "", "Kệ C1", ""),
 ("Efferalgan 150", "Paracetamol", 150, "gói", "UPSA", "Trẻ em", "Có", "", "Kệ C2", ""),
 ("Panadol Extra", "Paracetamol + Caffein", "500 + 65", "viên", "GSK", "Người lớn", "Có", "", "Tủ kính", "có caffein"),
 ("Brufen 400", "Ibuprofen", 400, "viên", "Abbott", "Người lớn", "Có", "", "Ngăn kéo 1", ""),
 ("Ibuprofen 400 Stella", "Ibuprofen", 400, "viên", "Stella", "Người lớn", "Có", "", "Ngăn kéo 2", ""),
 ("Brufen siro 100mg/5ml", "Ibuprofen", 100, "siro", "Abbott", "Trẻ em", "Có", "", "Kệ D1", "mg ghi theo 5 ml"),
 ("Acemuc 200", "Acetylcystein", 200, "gói", "Sanofi", "Người lớn", "Có", "", "Kệ A1", ""),
 ("Acemuc 100", "Acetylcystein", 100, "gói", "Sanofi", "Trẻ em", "Có", "", "Kệ A2", ""),
 ("Mitux 200", "Acetylcystein", 200, "gói", "DHG", "Người lớn", "Có", "", "Kệ A3", ""),
 ("Bisolvon 8", "Bromhexin", 8, "viên", "Boehringer", "Người lớn", "Có", "", "Kệ B1", ""),
 ("Bromhexin 4 (siro 4mg/5ml)", "Bromhexin", 4, "siro", "Nadyphar", "Trẻ em", "Có", "", "Kệ B2", "mg ghi theo 5 ml"),
 ("Mucosolvan 30", "Ambroxol", 30, "viên", "Boehringer", "Người lớn", "Có", "", "Kệ B3", ""),
 ("Ambroxol 15 siro 15mg/5ml", "Ambroxol", 15, "siro", "Imexpharm", "Trẻ em", "Có", "", "Kệ C1", "mg ghi theo 5 ml"),
 ("Dextromethorphan 15", "Dextromethorphan", 15, "viên", "Traphaco", "Người lớn", "Có", "", "Kệ C2", ""),
 ("Prospan", "Cao khô lá thường xuân", "", "siro", "Engelhard", "Cả hai", "Có", "", "Tủ lạnh", "thảo dược, liều theo ml"),
 ("Clarityne 10", "Loratadin", 10, "viên", "Bayer", "Cả hai", "Có", "", "Ngăn kéo 1", "không buồn ngủ"),
 ("Loratadin 10 Stella", "Loratadin", 10, "viên", "Stella", "Cả hai", "Có", "", "Ngăn kéo 2", ""),
 ("Loratadin siro 5mg/5ml", "Loratadin", 5, "siro", "Imexpharm", "Trẻ em", "Có", "", "Kệ D2", "mg ghi theo 5 ml"),
 ("Zyrtec 10", "Cetirizin", 10, "viên", "UCB", "Người lớn", "Có", "", "Kệ A1", ""),
 ("Cetirizin 10 Stella", "Cetirizin", 10, "viên", "Stella", "Người lớn", "Có", "", "Kệ A2", ""),
 ("Chlorpheniramin 4", "Chlorpheniramin", 4, "viên", "Nadyphar", "Cả hai", "Có", "", "Kệ A3", "gây buồn ngủ"),
 ("Telfast 60", "Fexofenadin", 60, "viên", "Sanofi", "Người lớn", "Có", "", "Kệ B1", ""),
 ("Telfast 180", "Fexofenadin", 180, "viên", "Sanofi", "Người lớn", "Có", "", "Kệ B2", ""),
 ("Alphachymotrypsin 4,2", "Alphachymotrypsin", 4.2, "viên", "Traphaco", "Người lớn", "Có", "", "Kệ B3", "ngậm dưới lưỡi"),
 ("Strepsils", "Amylmetacresol + Dichlorobenzyl alcohol", "", "viên ngậm", "Reckitt", "Cả hai", "Có", "", "Kệ C1", "trên 6 tuổi"),
 ("Betadine súc họng 1%", "Povidon iod", "", "chai", "Mundipharma", "Người lớn", "Có", "", "Kệ C2", ""),
 ("Nước muối sinh lý 0,9%", "Natri clorid", "", "chai", "Nhiều hãng", "Cả hai", "Có", "", "Tủ kính", "nhỏ mũi, súc miệng"),
 ("Otrivin 0,1%", "Xylometazolin", "", "chai xịt", "GSK", "Người lớn", "Có", "", "Ngăn kéo 1", "không quá 5 ngày"),
 ("Otrivin 0,05%", "Xylometazolin", "", "chai xịt", "GSK", "Trẻ em", "Có", "", "Ngăn kéo 2", "trên 6 tuổi"),
 ("Oresol", "Oresol", "", "gói", "Nhiều hãng", "Cả hai", "Có", "", "Kệ D3", "pha đúng lượng nước"),
 ("Smecta", "Diosmectit", 3000, "gói", "Ipsen", "Cả hai", "Có", "", "Kệ A1", "gói 3 g"),
 ("Hidrasec 10", "Racecadotril", 10, "gói", "Ferrer", "Trẻ em", "Có", "", "Kệ A2", ""),
 ("Hidrasec 30", "Racecadotril", 30, "gói", "Ferrer", "Trẻ em", "Có", "", "Kệ A3", ""),
 ("Hidrasec 100", "Racecadotril", 100, "viên", "Ferrer", "Người lớn", "Có", "", "Kệ B1", ""),
 ("Loperamid 2", "Loperamid", 2, "viên", "Stella", "Người lớn", "Có", "", "Kệ B2", "không dùng trẻ dưới 12 tuổi"),
 ("Enterogermina", "Bacillus clausii", "", "ống", "Sanofi", "Cả hai", "Có", "", "Kệ B3", "men vi sinh"),
 ("Zinc 10", "Kẽm", 10, "viên", "DHG", "Cả hai", "Có", "", "Kệ C1", ""),
 ("Domperidon 10", "Domperidon", 10, "viên", "Stella", "Người lớn", "Có", "", "Kệ C2", ""),
 ("Omeprazol 20", "Omeprazol", 20, "viên", "Stella", "Người lớn", "Có", "", "Tủ kính", "uống trước ăn sáng"),
 ("Phosphalugel", "Aluminium phosphat", "", "gói", "Sanofi", "Cả hai", "Có", "", "Ngăn kéo 1", ""),
 ("Simethicon 80", "Simethicon", 80, "viên", "Traphaco", "Người lớn", "Có", "", "Ngăn kéo 2", ""),
 ("Sorbitol 5g", "Sorbitol", 5000, "gói", "Sanofi", "Người lớn", "Có", "", "Kệ D1", ""),
 ("Duphalac", "Lactulose", "", "gói", "Abbott", "Cả hai", "Có", "", "Kệ A1", "10 g/15 ml"),
 ("Spasmaverine 40", "Alverin", 40, "viên", "Sanofi", "Người lớn", "Có", "", "Kệ A2", ""),
 ("Dimenhydrinat 50", "Dimenhydrinat", 50, "viên", "Nadyphar", "Cả hai", "Có", "", "Kệ A3", ""),
 ("Rotundin 30", "Rotundin", 30, "viên", "Traphaco", "Người lớn", "Có", "", "Kệ B1", ""),
 ("Vitamin C 500", "Vitamin C", 500, "viên", "DHG", "Cả hai", "Có", "", "Kệ B2", ""),
 ("Vitamin 3B", "Vitamin B1 + B6 + B12", "", "viên", "DHG", "Người lớn", "Có", "", "Kệ B3", ""),
 ("Hydrocortison 1% kem", "Hydrocortison", "", "tuýp", "Nhiều hãng", "Cả hai", "Có", "", "Kệ C1", "bôi ngoài"),
 ("Alaxan", "Ibuprofen + Paracetamol", "200 + 325", "viên", "United", "Người lớn", "Hết", "", "Kệ C2", "khách hay hỏi"),
 ("Decolgen Forte", "Paracetamol + Phenylephrin + Chlorpheniramin", "500 + 10 + 2", "viên", "United", "Người lớn", "Có", "", "Tủ kính", "cảm cúm"),
 ("Tiffy", "Paracetamol + Phenylephrin + Chlorpheniramin", "500 + 10 + 2", "viên", "Thai Nakorn", "Người lớn", "Hết", "", "Ngăn kéo 1", ""),
 ("Augmentin 625", "Amoxicillin + Acid clavulanic", "500 + 125", "viên", "GSK", "Người lớn", "Có", "Có", "Ngăn kéo 2", "kháng sinh, phải có toa"),
]

# ---------------------------------------------------------------- Triệu chứng
# Triệu chứng | Nhóm hiển thị | Thứ tự
SYMPTOMS = [
 ("Sốt", "Toàn thân", 1, "nóng, hâm hấp, sốt cao, nóng trong người, ớn lạnh"),
 ("Cảm cúm", "Toàn thân", 5, "cảm, cúm, trúng gió, cảm lạnh, cảm mạo"),
 ("Đau đầu", "Toàn thân", 2, "nhức đầu, đau nửa đầu, đau nhức đầu, choáng"),
 ("Đau nhức mình", "Toàn thân", 3, "nhức mỏi, ê ẩm, đau mình, mỏi người, đau cơ"),
 ("Mệt mỏi", "Toàn thân", 4, "uể oải, mệt, không có sức, chán ăn"),
 ("Ho khan", "Hô hấp", 10, "ho không đờm, ho ngứa cổ, ho về đêm, ho sù sụ"),
 ("Ho có đờm", "Hô hấp", 11, "ho đàm, ho có đàm, ho khạc, đờm xanh, đờm vàng, khò khè"),
 ("Sổ mũi", "Hô hấp", 12, "chảy mũi, chảy nước mũi, mũi nước, sụt sịt"),
 ("Nghẹt mũi", "Hô hấp", 13, "ngạt mũi, tịt mũi, khó thở bằng mũi, nghẹt"),
 ("Hắt hơi", "Hô hấp", 14, "hắt xì, nhảy mũi, ách xì"),
 ("Đau họng", "Hô hấp", 15, "rát họng, đau cổ họng, nuốt đau, viêm họng, ngứa họng"),
 ("Khàn tiếng", "Hô hấp", 16, "mất tiếng, khàn giọng, tắt tiếng"),
 ("Tiêu chảy", "Tiêu hoá", 20, "đi ngoài, đi lỏng, đi cầu lỏng, tào tháo, ỉa chảy, đi phân lỏng"),
 ("Buồn nôn", "Tiêu hoá", 21, "ói, nôn, mắc ói, ọe, nôn ói"),
 ("Đầy hơi, khó tiêu", "Tiêu hoá", 22, "đầy bụng, chướng bụng, ăn không tiêu, ợ hơi, sình bụng"),
 ("Ợ nóng, đau dạ dày", "Tiêu hoá", 23, "đau bao tử, xót ruột, ợ chua, nóng rát ngực, đau thượng vị, đau bụng trên"),
 ("Táo bón", "Tiêu hoá", 24, "bón, khó đi cầu, đi cầu không được, phân cứng"),
 ("Đau bụng quặn", "Tiêu hoá", 25, "đau bụng từng cơn, quặn bụng, đau quặn, co thắt bụng"),
 ("Nổi mề đay", "Da, dị ứng", 30, "nổi mẩn, nổi sẩn, nổi ngứa, dị ứng da, nổi đỏ, mẩn ngứa"),
 ("Ngứa", "Da, dị ứng", 31, "ngứa da, ngứa ngáy, ngứa người"),
 ("Ngứa mắt, chảy nước mắt", "Da, dị ứng", 32, "cay mắt, đỏ mắt, chảy nước mắt, dị ứng mắt"),
 ("Đau răng", "Đau", 40, "nhức răng, sâu răng, đau nướu, sưng nướu"),
 ("Đau bụng kinh", "Đau", 41, "đau bụng tới tháng, đau bụng kinh nguyệt, hành kinh đau"),
 ("Đau lưng, đau khớp", "Đau", 42, "nhức lưng, đau khớp gối, mỏi lưng, đau vai gáy, nhức xương"),
 ("Say tàu xe", "Khác", 50, "say xe, chóng mặt đi xe, đi xe bị ói"),
 ("Mất ngủ nhẹ", "Khác", 51, "khó ngủ, ngủ không được, trằn trọc"),
]

# Dấu hiệu | Đối tượng | Làm gì
RED_FLAGS = [
 ("Khó thở, thở gấp, thở rít", "Cả hai", "Đi khám ngay. Không bán thuốc."),
 ("Đau ngực, tức ngực", "Cả hai", "Đi khám ngay."),
 ("Sốt trên 39,5° không hạ / sốt co giật", "Cả hai", "Đi cấp cứu."),
 ("Trẻ dưới 3 tháng tuổi bị sốt", "Trẻ em", "Đi khám ngay, không tự hạ sốt."),
 ("Trẻ lừ đừ, bỏ bú, khóc không dỗ được", "Trẻ em", "Đi khám ngay."),
 ("Nôn ra máu / đi cầu ra máu / phân đen", "Cả hai", "Đi khám ngay."),
 ("Đau bụng dữ dội, bụng cứng", "Cả hai", "Đi khám ngay, không cho thuốc giảm đau."),
 ("Tiêu chảy kèm sốt cao hoặc mất nước (khô môi, tiểu ít)", "Cả hai", "Đi khám."),
 ("Cứng cổ, nhức đầu dữ dội, nhìn mờ", "Cả hai", "Đi khám ngay."),
 ("Phát ban kèm sốt, hoặc sưng môi/mặt, khó thở", "Cả hai", "Đi khám ngay, nghi dị ứng nặng."),
 ("Bệnh đã kéo dài trên 1 tuần, uống thuốc không đỡ", "Cả hai", "Khuyên đi khám, không cắt tiếp."),
 ("Đang mang thai và có sốt / đau bụng", "Người lớn", "Hỏi dược sĩ hoặc đi khám."),
]

# ---------------------------------------------------------------- Luật
# Triệu chứng | Đối tượng | Nhóm | Hoạt chất | mg/kg/lần | mg cố định/lần | Lần/ngày | Tối đa mg/ngày | Liều ghi tay | Cách uống | Cảnh báo | Ưu tiên
NL, TE = "Người lớn", "Trẻ em"
RULES = [
 # Sốt
 ("Sốt", NL, "Hạ sốt, giảm đau", "Paracetamol", "", 500, "3-4", 3000, "", "cách nhau ít nhất 4 giờ", "Sốt quá 3 ngày → khuyên đi khám", 1),
 ("Sốt", TE, "Hạ sốt, giảm đau", "Paracetamol", 12.5, "", "3-4", "60/kg", "", "cách nhau ít nhất 4 giờ", "Sốt quá 3 ngày hoặc trẻ dưới 3 tháng → đi khám", 1),
 ("Sốt", NL, "Hạ sốt, giảm đau", "Ibuprofen", "", 400, 3, 1200, "", "sau ăn", "Không dùng khi đau dạ dày, mang thai", 2),
 ("Sốt", TE, "Hạ sốt, giảm đau", "Ibuprofen", 7.5, "", 3, "30/kg", "", "sau ăn", "Không dùng trẻ dưới 6 tháng, đang sốt xuất huyết", 2),
 ("Sốt", TE, "Bù nước", "Oresol", "", "", "", "", "Pha 1 gói đúng lượng nước ghi trên bao, cho uống từng ít", "", "", 9),
 # Đau đầu / đau nhức / đau răng / lưng khớp / bụng kinh
 ("Đau đầu", NL, "Hạ sốt, giảm đau", "Paracetamol", "", 500, "3-4", 3000, "", "cách nhau ít nhất 4 giờ", "", 1),
 ("Đau đầu", TE, "Hạ sốt, giảm đau", "Paracetamol", 12.5, "", "3-4", "60/kg", "", "cách nhau ít nhất 4 giờ", "", 1),
 ("Đau đầu", NL, "Hạ sốt, giảm đau", "Paracetamol + Caffein", "", "500 + 65", 3, "", "", "", "Không uống thêm cà phê đậm", 2),
 ("Đau nhức mình", NL, "Hạ sốt, giảm đau", "Paracetamol", "", 500, "3-4", 3000, "", "", "", 1),
 ("Đau nhức mình", TE, "Hạ sốt, giảm đau", "Paracetamol", 12.5, "", "3-4", "60/kg", "", "", "", 1),
 ("Đau răng", NL, "Hạ sốt, giảm đau", "Ibuprofen", "", 400, 3, 1200, "", "sau ăn", "Không dùng khi đau dạ dày", 1),
 ("Đau răng", NL, "Hạ sốt, giảm đau", "Paracetamol", "", 500, "3-4", 3000, "", "", "", 2),
 ("Đau răng", TE, "Hạ sốt, giảm đau", "Paracetamol", 12.5, "", "3-4", "60/kg", "", "", "Sưng mặt, sốt cao → nha sĩ", 1),
 ("Đau lưng, đau khớp", NL, "Hạ sốt, giảm đau", "Ibuprofen", "", 400, 3, 1200, "", "sau ăn", "Không dùng khi đau dạ dày", 1),
 ("Đau lưng, đau khớp", NL, "Hạ sốt, giảm đau", "Paracetamol", "", 500, "3-4", 3000, "", "", "", 2),
 ("Đau bụng kinh", NL, "Hạ sốt, giảm đau", "Ibuprofen", "", 400, 3, 1200, "", "sau ăn, uống sớm khi mới đau", "", 1),
 ("Đau bụng kinh", NL, "Chống co thắt", "Alverin", "", 40, 3, 240, "", "", "", 1),
 # Ho
 ("Ho khan", NL, "Giảm ho", "Dextromethorphan", "", 15, "3-4", 120, "", "", "Không dùng cho ho có đờm", 1),
 ("Ho khan", TE, "Giảm ho", "Cao khô lá thường xuân", "", "", "", "", "2–5 tuổi: 2,5 ml × 3 lần/ngày · 6–12 tuổi: 5 ml × 3 lần/ngày", "", "Ho quá 2 tuần → đi khám", 1),
 ("Ho khan", NL, "Giảm ho", "Cao khô lá thường xuân", "", "", "", "", "5–7,5 ml × 3 lần/ngày", "", "", 2),
 ("Ho có đờm", NL, "Long đờm", "Acetylcystein", "", 200, 3, 600, "", "pha nước, sau ăn", "", 1),
 ("Ho có đờm", TE, "Long đờm", "Acetylcystein", "", 100, 2, 200, "", "pha nước, sau ăn", "Trẻ dưới 2 tuổi hỏi bác sĩ", 1),
 ("Ho có đờm", NL, "Long đờm", "Bromhexin", "", 8, 3, 24, "", "", "", 2),
 ("Ho có đờm", TE, "Long đờm", "Bromhexin", "", 4, 2, 8, "", "", "", 2),
 ("Ho có đờm", NL, "Long đờm", "Ambroxol", "", 30, 3, 90, "", "sau ăn", "", 3),
 ("Ho có đờm", TE, "Long đờm", "Ambroxol", "", 15, 2, 30, "", "sau ăn", "", 3),
 # Sổ mũi / hắt hơi / dị ứng
 ("Sổ mũi", NL, "Kháng dị ứng", "Loratadin", "", 10, 1, 10, "", "", "", 1),
 ("Sổ mũi", TE, "Kháng dị ứng", "Loratadin", "", 5, 1, 5, "", "", "Trẻ dưới 2 tuổi hỏi bác sĩ", 1),
 ("Sổ mũi", NL, "Kháng dị ứng", "Chlorpheniramin", "", 4, 3, 24, "", "tối, trước ngủ", "Gây buồn ngủ, không lái xe", 2),
 ("Sổ mũi", TE, "Kháng dị ứng", "Chlorpheniramin", 0.1, "", 2, "0.35/kg", "", "tối, trước ngủ", "Gây buồn ngủ", 2),
 ("Hắt hơi", NL, "Kháng dị ứng", "Loratadin", "", 10, 1, 10, "", "", "", 1),
 ("Hắt hơi", TE, "Kháng dị ứng", "Loratadin", "", 5, 1, 5, "", "", "", 1),
 ("Nổi mề đay", NL, "Kháng dị ứng", "Cetirizin", "", 10, 1, 10, "", "tối", "Có thể buồn ngủ nhẹ", 1),
 ("Nổi mề đay", TE, "Kháng dị ứng", "Cetirizin", "", 5, 1, 5, "", "tối", "Trẻ dưới 2 tuổi hỏi bác sĩ", 1),
 ("Nổi mề đay", NL, "Kháng dị ứng", "Fexofenadin", "", 180, 1, 180, "", "", "", 2),
 ("Nổi mề đay", NL, "Bôi ngoài", "Hydrocortison", "", "", "", "", "Bôi mỏng vùng ngứa 2 lần/ngày, không quá 7 ngày", "", "Không bôi lên mặt, vết thương hở", 5),
 ("Nổi mề đay", TE, "Bôi ngoài", "Hydrocortison", "", "", "", "", "Bôi mỏng vùng ngứa 1–2 lần/ngày, không quá 5 ngày", "", "Không bôi lên mặt", 5),
 ("Ngứa", NL, "Kháng dị ứng", "Loratadin", "", 10, 1, 10, "", "", "", 1),
 ("Ngứa", TE, "Kháng dị ứng", "Loratadin", "", 5, 1, 5, "", "", "", 1),
 ("Ngứa mắt, chảy nước mắt", NL, "Kháng dị ứng", "Loratadin", "", 10, 1, 10, "", "", "", 1),
 ("Ngứa mắt, chảy nước mắt", TE, "Kháng dị ứng", "Loratadin", "", 5, 1, 5, "", "", "", 1),
 # Nghẹt mũi
 ("Nghẹt mũi", NL, "Thông mũi", "Xylometazolin", "", "", "", "", "Xịt 1 nhát mỗi bên, 2–3 lần/ngày", "", "Không quá 5 ngày liên tục", 1),
 ("Nghẹt mũi", TE, "Thông mũi", "Natri clorid", "", "", "", "", "Nhỏ 2–3 giọt mỗi bên rồi hút mũi, 3–4 lần/ngày", "", "", 1),
 ("Nghẹt mũi", TE, "Thông mũi", "Xylometazolin", "", "", "", "", "Trên 6 tuổi: xịt 1 nhát mỗi bên, 1–2 lần/ngày", "", "Không quá 5 ngày, không dùng dưới 6 tuổi", 2),
 ("Nghẹt mũi", NL, "Thông mũi", "Natri clorid", "", "", "", "", "Xịt hoặc nhỏ rửa mũi 3–4 lần/ngày", "", "", 2),
 # Đau họng / khàn tiếng
 ("Đau họng", NL, "Giảm đau họng", "Amylmetacresol + Dichlorobenzyl alcohol", "", "", "", "", "Ngậm 1 viên mỗi 2–3 giờ, tối đa 8 viên/ngày", "", "", 1),
 ("Đau họng", TE, "Giảm đau họng", "Amylmetacresol + Dichlorobenzyl alcohol", "", "", "", "", "Trên 6 tuổi: ngậm 1 viên mỗi 3–4 giờ, tối đa 6 viên/ngày", "", "Không dùng dưới 6 tuổi", 1),
 ("Đau họng", NL, "Súc họng", "Povidon iod", "", "", "", "", "Pha loãng 1:1, súc họng 30 giây, 2–4 lần/ngày", "", "Không nuốt", 2),
 ("Đau họng", NL, "Chống viêm, giảm sưng", "Alphachymotrypsin", "", 4.2, "3-4", 16.8, "", "ngậm dưới lưỡi", "", 3),
 ("Khàn tiếng", NL, "Chống viêm, giảm sưng", "Alphachymotrypsin", "", 4.2, "3-4", 16.8, "", "ngậm dưới lưỡi", "Khàn quá 2 tuần → đi khám", 1),
 ("Khàn tiếng", NL, "Súc họng", "Natri clorid", "", "", "", "", "Súc họng 3–4 lần/ngày", "", "", 2),
 ("Khàn tiếng", TE, "Súc họng", "Natri clorid", "", "", "", "", "Súc họng 2–3 lần/ngày nếu trẻ biết súc", "", "", 1),
 # Tiêu hoá
 ("Tiêu chảy", NL, "Bù nước", "Oresol", "", "", "", "", "1 gói pha 200 ml, uống dần sau mỗi lần đi", "", "", 1),
 ("Tiêu chảy", TE, "Bù nước", "Oresol", "", "", "", "", "Pha đúng lượng nước; uống 50–100 ml sau mỗi lần đi", "", "Đi cầu ra máu, sốt cao, lừ đừ → đi khám ngay", 1),
 ("Tiêu chảy", NL, "Cầm tiêu chảy", "Loperamid", "", 2, "", 16, "Uống 2 viên lần đầu, sau đó 1 viên sau mỗi lần đi lỏng, tối đa 8 viên/ngày", "", "Không dùng khi sốt, đi cầu ra máu", 2),
 ("Tiêu chảy", TE, "Cầm tiêu chảy", "Racecadotril", 1.5, "", 3, "", "", "trước ăn", "Không quá 7 ngày", 2),
 ("Tiêu chảy", NL, "Hấp phụ", "Diosmectit", "", 3000, 3, 9000, "", "pha nửa ly nước, xa bữa ăn", "", 3),
 ("Tiêu chảy", TE, "Hấp phụ", "Diosmectit", "", 3000, 2, 6000, "", "pha nước, xa bữa ăn", "Trẻ dưới 2 tuổi: 1 gói/ngày", 3),
 ("Tiêu chảy", TE, "Bổ trợ", "Kẽm", "", 20, 1, 20, "", "sau ăn", "Dưới 6 tháng: 10 mg/ngày", 4),
 ("Tiêu chảy", NL, "Men vi sinh", "Bacillus clausii", "", "", "", "", "1 ống × 2–3 lần/ngày", "", "", 5),
 ("Tiêu chảy", TE, "Men vi sinh", "Bacillus clausii", "", "", "", "", "1 ống × 1–2 lần/ngày", "", "", 5),
 ("Buồn nôn", NL, "Chống nôn", "Domperidon", "", 10, 3, 30, "", "trước ăn 15–30 phút", "Không dùng quá 1 tuần", 1),
 ("Buồn nôn", TE, "Chống nôn", "Domperidon", 0.25, "", 3, "0.75/kg", "", "trước ăn 15–30 phút", "Trẻ dưới 12 tuổi hoặc dưới 35 kg: hỏi bác sĩ", 1),
 ("Đầy hơi, khó tiêu", NL, "Chống đầy hơi", "Simethicon", "", 80, 3, 320, "", "sau ăn", "", 1),
 ("Đầy hơi, khó tiêu", NL, "Trung hoà acid", "Aluminium phosphat", "", "", "", "", "1 gói × 2–3 lần/ngày, sau ăn 1–2 giờ", "", "", 2),
 ("Đầy hơi, khó tiêu", TE, "Trung hoà acid", "Aluminium phosphat", "", "", "", "", "Trên 6 tuổi: ½ gói × 2 lần/ngày", "", "Không dùng dưới 6 tuổi", 1),
 ("Ợ nóng, đau dạ dày", NL, "Giảm tiết acid", "Omeprazol", "", 20, 1, 20, "", "trước ăn sáng 30 phút", "Đau quá 2 tuần, sụt cân, nôn ra máu → đi khám", 1),
 ("Ợ nóng, đau dạ dày", NL, "Trung hoà acid", "Aluminium phosphat", "", "", "", "", "1 gói khi đau, tối đa 3 gói/ngày", "", "", 2),
 ("Táo bón", NL, "Nhuận tràng", "Sorbitol", "", 5000, "1-3", 15000, "", "pha nước, sáng lúc đói", "Không dùng khi đau bụng chưa rõ nguyên nhân", 1),
 ("Táo bón", TE, "Nhuận tràng", "Lactulose", "", "", "", "", "1–6 tuổi: 5–10 ml/ngày · 7–14 tuổi: 15 ml/ngày", "", "", 1),
 ("Táo bón", NL, "Nhuận tràng", "Lactulose", "", "", "", "", "15–45 ml/ngày, uống 1 lần buổi sáng", "", "", 2),
 ("Đau bụng quặn", NL, "Chống co thắt", "Alverin", "", 40, 3, 240, "", "", "Đau dữ dội, sốt, nôn → đi khám ngay", 1),
 # Khác
 ("Say tàu xe", NL, "Chống say", "Dimenhydrinat", "", 50, 1, 200, "", "uống 30 phút trước khi đi", "Gây buồn ngủ", 1),
 ("Say tàu xe", TE, "Chống say", "Dimenhydrinat", 1.25, "", 1, "5/kg", "", "uống 30 phút trước khi đi", "Không dùng dưới 2 tuổi", 1),
 ("Mất ngủ nhẹ", NL, "An thần nhẹ", "Rotundin", "", 30, 1, 60, "", "trước ngủ 30 phút", "Không dùng quá 2 tuần", 1),
 ("Mệt mỏi", NL, "Bổ trợ", "Vitamin C", "", 500, 1, 1000, "", "sau ăn sáng", "", 1),
 ("Mệt mỏi", TE, "Bổ trợ", "Vitamin C", "", 250, 1, 250, "", "sau ăn sáng", "", 1),
 ("Mệt mỏi", NL, "Bổ trợ", "Vitamin B1 + B6 + B12", "", "", "", "", "1 viên × 1–2 lần/ngày", "", "", 2),
 ("Cảm cúm", NL, "Cảm cúm phối hợp", "Paracetamol + Phenylephrin + Chlorpheniramin", "", "", 3, "", "1 viên × 3 lần/ngày, sau ăn", "", "Gây buồn ngủ, không lái xe; không uống thêm Paracetamol khác", 1),
 ("Cảm cúm", TE, "Hạ sốt, giảm đau", "Paracetamol", 12.5, "", "3-4", "60/kg", "", "cách nhau ít nhất 4 giờ", "Sốt quá 3 ngày → đi khám", 1),
 ("Cảm cúm", TE, "Kháng dị ứng", "Loratadin", "", 5, 1, 5, "", "", "", 2),
]

DRUG_HDR = ["Tên thuốc", "Hoạt chất", "mg", "Dạng", "Hãng", "Đối tượng", "Còn hàng", "Kê đơn", "Vị trí", "Ghi chú"]
RULE_HDR = ["Triệu chứng", "Đối tượng", "Nhóm", "Hoạt chất", "mg/kg/lần", "mg cố định/lần", "Lần/ngày", "Tối đa mg/ngày", "Liều ghi tay", "Cách uống", "Cảnh báo", "Ưu tiên"]
SYM_HDR = ["Triệu chứng", "Nhóm hiển thị", "Thứ tự", "Khách hay nói"]
FLAG_HDR = ["Dấu hiệu", "Đối tượng", "Làm gì"]
REQUIRED = {"Thuốc": {0, 1, 3}, "Luật cắt liều": {0, 1, 3}, "Triệu chứng": {0}}

DRUG_NOTES = {
 "Tên thuốc": "Tên thương mại in trên hộp. App hiện tên này.",
 "Hoạt chất": "Chìa khoá nối với sheet Luật. Thuốc phối hợp ghi nối bằng dấu + (vd Paracetamol + Caffein).",
 "mg": "Hàm lượng 1 viên / 1 gói. Siro: ghi mg trong 5 ml. Để trống nếu không tính theo mg (nước muối, siro thảo dược...).",
 "Dạng": "viên, gói, siro, viên sủi, viên ngậm, chai, chai xịt, ống, tuýp.",
 "Đối tượng": "Người lớn / Trẻ em / Cả hai. App ưu tiên thuốc đúng đối tượng.",
 "Còn hàng": "Có / Hết. Để trống = Có. Thuốc khách hay hỏi mà quầy chưa nhập cũng nên ghi vào và đánh Hết, để app chỉ ra thuốc thay thế đang có.",
 "Kê đơn": "Ghi Có nếu là thuốc kê đơn (kháng sinh, corticoid...). App sẽ không tự gợi ý và nhắc hỏi dược sĩ.",
 "Vị trí": "Chỗ để thuốc ở quầy, ghi đúng nhãn dán trên kệ: Kệ A3, Ngăn kéo 2, Tủ lạnh... App in dưới tên thuốc để nhân viên mới tìm được. Gõ mã kệ ở tab Tra thuốc sẽ ra hết thuốc kệ đó.",
}
RULE_NOTES = {
 "Triệu chứng": "Đúng tên trong sheet Triệu chứng (app tự thêm nếu chưa có).",
 "Đối tượng": "Người lớn hoặc Trẻ em. Mỗi đối tượng 1 dòng.",
 "Nhóm": "Nhóm tác dụng (Hạ sốt, Long đờm...). Nhiều triệu chứng cùng Nhóm chỉ ra 1 thuốc, thuốc còn lại thành gợi ý 'hoặc'.",
 "Hoạt chất": "Phải khớp cột Hoạt chất trong sheet Thuốc.",
 "mg/kg/lần": "App nhân với số kg. Điền cột này HOẶC 'mg cố định/lần', không điền cả hai.",
 "mg cố định/lần": "Liều 1 lần không phụ thuộc cân nặng.",
 "Lần/ngày": "Số hoặc khoảng, vd 3 hoặc 3-4.",
 "Tối đa mg/ngày": "Số (vd 3000) hoặc theo kg (vd 60/kg). Vượt là app hạ liều và báo.",
 "Liều ghi tay": "Dùng khi không tính theo mg (xịt, nhỏ, ml, ống). App hiện nguyên câu này.",
 "Cảnh báo": "Hiện khung vàng dưới danh sách.",
 "Ưu tiên": "1 là ưu tiên nhất. Cùng Nhóm thì Ưu tiên nhỏ hơn được chọn.",
}

HEAD_FILL = PatternFill("solid", fgColor="0F7B6C")
REQ_FILL = PatternFill("solid", fgColor="0A5A4F")
HEAD_FONT = Font(bold=True, color="FFFFFF")
THIN = Side(style="thin", color="D3DDD8")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

HINT_FONT = Font(italic=True, color="7B8A85", size=10)
HINT_FILL = PatternFill("solid", fgColor="F5F8F6")
ZEBRA = PatternFill("solid", fgColor="F2F6F4")
from openpyxl.formatting.rule import FormulaRule

HINTS = {
 "Thuốc": ["↳ vd: Panadol", "Paracetamol", "500", "viên", "GSK", "Người lớn", "Có", "", "Kệ A1", "ghi chú tuỳ ý"],
 "Luật cắt liều": ["↳ vd: Sốt", "Trẻ em", "Hạ sốt, giảm đau", "Paracetamol", "12,5", "(hoặc điền cột này)", "3-4", "60/kg", "(khi không tính mg)", "cách ≥ 4h", "Sốt quá 3 ngày → đi khám", "1"],
 "Triệu chứng": ["↳ vd: Sốt", "Toàn thân", "1", "nóng, hâm hấp, ớn lạnh"],
 "Dấu hiệu nguy hiểm": ["↳ vd: Khó thở", "Cả hai", "Đi khám ngay"],
}

def sheet(wb, title, hdr, rows, notes, widths):
    ws = wb.create_sheet(title)
    ws.append(hdr)
    for i, h in enumerate(hdr, 1):
        c = ws.cell(row=1, column=i)
        c.font = HEAD_FONT
        c.fill = REQ_FILL if (i - 1) in REQUIRED.get(title, set()) else HEAD_FILL
        c.alignment = Alignment(vertical="center", wrap_text=True, horizontal="center")
        if h in notes:
            c.comment = Comment(notes[h], "Cắt Liều Nhanh")
        ws.column_dimensions[get_column_letter(i)].width = widths[i - 1]
    # dòng 2: ví dụ mờ, app bỏ qua dòng bắt đầu bằng ↳
    hint = HINTS.get(title)
    if hint:
        ws.append(hint)
        for c in ws[2]:
            c.font = HINT_FONT; c.fill = HINT_FILL
    for r in rows:
        ws.append(list(r))
    last = ws.max_row
    for row in ws.iter_rows(min_row=1, max_row=last, max_col=len(hdr)):
        for c in row:
            c.border = BORDER
            if c.row > 1:
                c.alignment = Alignment(vertical="center", wrap_text=True)
            if c.row > 2 and c.row % 2 == 1:
                c.fill = ZEBRA
    for r in range(2, last + 1):
        ws.row_dimensions[r].height = 22
    ws.row_dimensions[1].height = 34
    ws.freeze_panes = "B2" if title in ("Thuốc", "Luật cắt liều") else "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(hdr))}{max(last, 3)}"
    # ô bắt buộc để trống (trên dòng có dữ liệu) → tô đỏ nhạt
    end = last + 300
    for idx in REQUIRED.get(title, set()):
        col = get_column_letter(idx + 1)
        first = get_column_letter(1)
        ws.conditional_formatting.add(f"{col}3:{col}{end}",
            FormulaRule(formula=[f'AND(COUNTA($A3:${get_column_letter(len(hdr))}3)>0,{col}3="")'], fill=PatternFill("solid", fgColor="F8D0CC")))
    return ws

def build_workbook():
    wb = Workbook()
    ws = wb.active
    ws.title = "Hướng dẫn"
    ws.column_dimensions["A"].width = 110
    lines = [
     ("CẮT LIỀU NHANH · File dữ liệu mẫu", True),
     ("", False),
     ("File này có 4 sheet dữ liệu: Thuốc, Luật cắt liều, Triệu chứng, Dấu hiệu nguy hiểm. Sửa xong lưu lại (.xlsx) rồi vào app → tab Dữ liệu → Nạp file Excel.", False),
     ("Ô tiêu đề màu đậm hơn là cột BẮT BUỘC. Di chuột lên tiêu đề để xem chú thích từng cột. Dòng 2 màu mờ là ví dụ, app bỏ qua, đừng xoá.", False),
     ("Các ô có mũi tên thả xuống (Triệu chứng, Hoạt chất, Đối tượng, Dạng, Còn hàng) → CHỌN thay vì gõ để không sai chính tả. Ô bắt buộc để trống sẽ tự tô đỏ.", False),
     ("Cách thêm 1 bài cắt liều mới: (1) sheet Thuốc: bảo đảm thuốc và Hoạt chất có sẵn; (2) sheet Triệu chứng: thêm triệu chứng nếu chưa có; (3) sheet Luật: 1 dòng cho Người lớn, 1 dòng cho Trẻ em.", False),
     ("", False),
     ("Sheet Thuốc: mỗi dòng một thuốc. Cột Hoạt chất là chìa khoá để tab Tra thuốc tìm thuốc thay thế và để sheet Luật nối vào.", False),
     ("Cột Vị trí: ghi đúng nhãn dán trên kệ (Kệ A3, Ngăn kéo 2, Tủ lạnh) để nhân viên mới tìm được thuốc. Nên dán nhãn kệ theo chữ+số rồi ghi y vậy.", False),
     ("Cột Còn hàng: Có / Hết. Thuốc khách hay hỏi mà quầy chưa nhập cũng ghi vào và đánh Hết → nhân viên tra được và app chỉ thuốc thay thế đang có. Cột Kê đơn: ghi Có với kháng sinh, corticoid... app sẽ không tự gợi ý.", False),
     ("Sheet Luật cắt liều: mỗi dòng = 1 triệu chứng + 1 đối tượng + 1 hoạt chất. Điền mg/kg/lần (app nhân số kg) HOẶC mg cố định/lần. Không tính theo mg thì viết vào Liều ghi tay.", False),
     ("Sheet Triệu chứng: xếp chip trên màn hình + cột 'Khách hay nói' để nhân viên gõ lời khách là ra chip đúng.", False),
     ("Sheet Dấu hiệu nguy hiểm: danh sách nhân viên phải hỏi khách trước. Chấm 1 dấu hiệu là app không ra thuốc, chỉ bảo đi khám / gọi dược sĩ. Sửa theo ý dược sĩ.", False),
     ("", False),
     ("Cách app đổi mg ra gói / viên: mg cần uống ÷ mg của thuốc, làm tròn về ¼, ½, ¾, 1, 1½, 2... Siro: đổi ra ml theo mg/5 ml.", False),
     ("Chấm nhiều triệu chứng: cùng hoạt chất chỉ ra 1 dòng; cùng Nhóm thì lấy dòng Ưu tiên nhỏ nhất, dòng còn lại thành gợi ý 'hoặc'.", False),
     ("", False),
     ("Dữ liệu trong file là VÍ DỤ tham khảo theo liều OTC thông dụng. Dược sĩ kiểm tra và chịu trách nhiệm trước khi dùng thật.", True),
    ]
    for i, (t, b) in enumerate(lines, 1):
        c = ws.cell(row=i, column=1, value=t)
        c.font = Font(bold=b, size=13 if i == 1 else 11)
        c.alignment = Alignment(wrap_text=True, vertical="top")
    wsd = sheet(wb, "Thuốc", DRUG_HDR, DRUGS, DRUG_NOTES, [26, 30, 11, 11, 14, 12, 10, 8, 14, 26])
    wsr = sheet(wb, "Luật cắt liều", RULE_HDR, RULES, RULE_NOTES, [22, 11, 20, 26, 10, 12, 9, 12, 44, 24, 40, 8])
    sheet(wb, "Triệu chứng", SYM_HDR, SYMPTOMS, {"Khách hay nói": "Các cách khách hay gọi, cách nhau bằng dấu phẩy. Nhân viên gõ vào ô tìm là ra chip đúng."}, [26, 16, 8, 60])
    wsf = sheet(wb, "Dấu hiệu nguy hiểm", FLAG_HDR, RED_FLAGS, {"Dấu hiệu": "Nhân viên hỏi khách trước khi cắt. Chấm 1 dấu hiệu là app KHÔNG ra thuốc, chỉ hiện Làm gì."}, [50, 12, 44])
    # ---- Danh mục cho ô chọn (sheet ẩn)
    dm = wb.create_sheet("Danh mục"); dm.sheet_state = "hidden"
    forms = ["viên", "gói", "siro", "viên sủi", "viên ngậm", "chai", "chai xịt", "ống", "tuýp"]
    groups = sorted({r[2] for r in RULES})
    dm["A1"] = "Dạng";     [dm.cell(row=i + 2, column=1, value=v) for i, v in enumerate(forms)]
    dm["B1"] = "Nhóm";     [dm.cell(row=i + 2, column=2, value=v) for i, v in enumerate(groups)]
    dm["C1"] = "Đối tượng"; [dm.cell(row=i + 2, column=3, value=v) for i, v in enumerate(["Người lớn", "Trẻ em", "Cả hai"])]
    dm["D1"] = "Còn hàng"; [dm.cell(row=i + 2, column=4, value=v) for i, v in enumerate(["Có", "Hết"])]

    def dd(ws, col, formula, last, msg):
        dv = DataValidation(type="list", formula1=formula, allow_blank=True, showErrorMessage=False)
        dv.promptTitle = "Chọn từ danh sách"; dv.prompt = msg; dv.showInputMessage = True
        ws.add_data_validation(dv); dv.add(f"{col}3:{col}{last}")
    R = 400
    # Thuốc
    dd(wsd, "D", "='Danh mục'!$A$2:$A$20", R, "Chọn dạng, hoặc gõ dạng khác")
    dd(wsd, "F", "='Danh mục'!$C$2:$C$4", R, "Người lớn / Trẻ em / Cả hai")
    dd(wsd, "G", "='Danh mục'!$D$2:$D$3", R, "Có / Hết (trống = Có)")
    dd(wsd, "H", "='Danh mục'!$D$2:$D$2", R, "Ghi Có nếu là thuốc kê đơn")
    # Luật: Triệu chứng lấy từ sheet Triệu chứng, Hoạt chất lấy từ sheet Thuốc
    dd(wsr, "A", "='Triệu chứng'!$A$3:$A$300", R, "Chọn triệu chứng đã khai ở sheet Triệu chứng (hoặc gõ tên mới)")
    dd(wsr, "B", "='Danh mục'!$C$2:$C$3", R, "Người lớn / Trẻ em")
    dd(wsr, "C", "='Danh mục'!$B$2:$B$60", R, "Nhóm tác dụng, gõ mới cũng được")
    dd(wsr, "D", "='Thuốc'!$B$3:$B$400", R, "Chọn hoạt chất ĐÚNG như sheet Thuốc để app nối được")
    # Dấu hiệu
    dd(wsf, "B", "='Danh mục'!$C$2:$C$4", R, "Cả hai / Trẻ em / Người lớn")
    return wb

def to_json():
    def clean(v):
        return "" if v is None else v
    return {
        "source": "sample",
        "drugs": [dict(zip(["name", "active", "mg", "form", "brand", "audience", "inStock", "rx", "location", "note"], map(clean, r))) for r in DRUGS],
        "rules": [dict(zip(["symptom", "audience", "group", "active", "mgPerKg", "mgFixed", "timesPerDay", "maxPerDay", "freeText", "howTo", "warning", "priority"], map(clean, r))) for r in RULES],
        "symptoms": [dict(zip(["name", "group", "order", "synonyms"], map(clean, r))) for r in SYMPTOMS],
        "redFlags": [dict(zip(["text", "audience", "action"], map(clean, r))) for r in RED_FLAGS],
    }

if __name__ == "__main__":
    wb = build_workbook()
    out_xlsx = os.path.join(ROOT, "CatLieuNhanh_mau.xlsx")
    wb.save(out_xlsx)
    buf = io.BytesIO(); wb.save(buf)
    b64 = base64.b64encode(buf.getvalue()).decode()
    with open(os.path.join(ROOT, "src/data/templateBase64.ts"), "w", encoding="utf-8") as f:
        f.write("// Sinh tự động bởi tools/make_template.py — file Excel mẫu dạng base64\n")
        f.write("export const TEMPLATE_BASE64 =\n  '" + b64 + "';\n")
    with open(os.path.join(ROOT, "src/data/sample.json"), "w", encoding="utf-8") as f:
        json.dump(to_json(), f, ensure_ascii=False, indent=1)
    print("xlsx", os.path.getsize(out_xlsx), "bytes;", len(DRUGS), "thuốc;", len(RULES), "luật;", len(SYMPTOMS), "triệu chứng")
