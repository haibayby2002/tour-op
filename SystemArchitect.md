# Tour-op — Đặc tả hệ thống kết nối du khách và người địa phương

## 1. Mục tiêu và phạm vi

Tour-op là hệ thống **môi giới, đề xuất và kết nối du khách với người địa phương**, lấy **niềm tin hai chiều** làm trọng tâm:

- Du khách cần tìm người địa phương phù hợp, có năng lực và thông tin đáng tin cậy; hạn chế trải nghiệm bị chặt chém.
- Người địa phương cần tiếp nhận công việc thời vụ và có đủ thông tin để an tâm khi dẫn khách.
- Hai bên phải trao đổi qua ứng dụng; thông tin liên lạc không được công khai hoặc chia sẻ cho đối phương.

**Nguyên tắc thiết kế:** Hồ sơ đầy đủ, thông tin được xác minh và lịch sử tương tác là những tín hiệu khác nhau. Hồ sơ đầy đủ không đồng nghĩa với danh tính đã được xác minh hoặc một người chắc chắn an toàn.

(Recommendation) Xây dựng phiên bản đầu tiên theo hành trình: **Tạo hồ sơ → Tìm kiếm và đề xuất → Gửi yêu cầu kết nối → Trao đổi trong app → Xác nhận nội dung trải nghiệm → Đánh giá hoặc báo cáo sự cố.**

---

## 2. Vai trò trong hệ thống

| Vai trò | Chức năng |
|---|---|
| Du khách | Tạo và quản lý hồ sơ; cung cấp thông tin giúp người địa phương đánh giá mức độ phù hợp; trao đổi trong app. |
| Người địa phương | Tạo và quản lý hồ sơ, thể hiện khả năng và hình ảnh; xem thông tin du khách; trao đổi trong app. |
| Quản trị viên (Recommendation) | Kiểm duyệt hồ sơ, xử lý báo cáo, hỗ trợ tranh chấp và quản lý các trường hợp vi phạm. |

(Assumption) Một tài khoản có thể đồng thời là du khách và người địa phương; từng vai trò có phần thông tin bổ sung riêng.

---

## 3. Hồ sơ và quyền riêng tư

### 3.1. Thông tin bắt buộc

Áp dụng cho cả du khách và người địa phương:

| Trường dữ liệu | Bắt buộc | Hiển thị công khai |
|---|---:|---|
| Tên | Có | Có |
| Năm sinh | Có | Hiển thị tuổi |
| Email | Có | Không |
| Số điện thoại | Có | Không |

(Recommendation) Tuổi hiển thị được tính theo năm hiện tại trừ năm sinh và ghi là **“Tuổi theo năm sinh”**, do hệ thống chưa thu thập ngày sinh đầy đủ.

Thông tin công khai theo yêu cầu gồm:

- Tên và tuổi.
- Khả năng.
- Đánh giá từ các bên.
- Hình ảnh người dùng xây dựng trên hồ sơ trong app.

(Recommendation) Mở rộng hồ sơ bằng các trường sau:

| Nhóm | Thông tin bổ sung | Quyền hiển thị đề xuất |
|---|---|---|
| Chung | Giới thiệu bản thân, ngôn ngữ, sở thích, ảnh đại diện | Công khai khi người dùng lựa chọn đăng |
| Người địa phương | Khu vực am hiểu, khả năng hỗ trợ, loại trải nghiệm có thể dẫn, lịch có thể nhận khách | Công khai, không bao gồm địa chỉ nhà hoặc vị trí chính xác |
| Du khách | Phong cách du lịch, mong muốn trải nghiệm | Công khai hoặc chỉ chia sẻ với người nhận yêu cầu |
| Từng yêu cầu kết nối | Điểm đến, thời gian dự kiến, quy mô nhóm, nhu cầu cụ thể | Chỉ các bên tham gia yêu cầu |

### 3.2. Quy tắc bảo vệ thông tin liên lạc

- Email và số điện thoại dùng cho hoạt động tài khoản, không hiển thị cho đối phương.
- Hai bên phải nhắn tin, trao đổi qua ứng dụng.
- Không có chức năng gửi thông tin liên lạc trực tiếp cho đối phương.

(Recommendation) Triển khai bảo vệ ở cả giao diện và máy chủ:

- API hồ sơ công khai không trả về email, số điện thoại hoặc dữ liệu riêng tư.
- Không cho đưa thông tin liên lạc vào tên hiển thị, mô tả và ảnh hồ sơ.
- Phát hiện, cảnh báo và chặn nội dung chia sẻ số điện thoại, email hoặc lời mời chuyển sang kênh bên ngoài.
- Có chức năng báo cáo hành vi lôi kéo liên hệ ngoài app.

**Giới hạn cần thể hiện rõ:** Trao đổi trong app hỗ trợ lưu vết và xử lý sự cố, nhưng không bảo đảm tuyệt đối an toàn. Bộ lọc cũng không thể phát hiện mọi cách che giấu thông tin liên lạc.

---

## 4. Mức độ hoàn thiện và tín hiệu niềm tin

### 4.1. Mức độ hoàn thiện hồ sơ

Hệ thống cần hiển thị mức độ hoàn thiện hồ sơ, đặc biệt giúp du khách biết cần bổ sung gì để người địa phương an tâm hơn.

(Recommendation) Hiển thị:

- Phần trăm hoàn thiện.
- Danh sách thông tin còn thiếu.
- Nút bổ sung trực tiếp từng mục.
- Giải thích lợi ích: “Thông tin về sở thích và phong cách du lịch giúp người địa phương hiểu nhu cầu của bạn.”

(Recommendation) Công thức phiên bản đầu:

> Mức độ hoàn thiện = Số mục hồ sơ hợp lệ đã hoàn thành / Tổng số mục được tính × 100%.

Danh sách mục được tính cần thống nhất riêng cho từng vai trò. Không cộng điểm chỉ vì người dùng đăng nhiều ảnh hoặc viết mô tả dài.

### 4.2. Tách biệt các tín hiệu niềm tin

(Recommendation) Không gộp tất cả thành một “điểm an toàn”. Hiển thị riêng:

| Tín hiệu | Ý nghĩa |
|---|---|
| Hồ sơ hoàn thiện | Đã cung cấp đủ các mục thông tin |
| Email đã xác minh | Người dùng đã xác nhận quyền truy cập email |
| Số điện thoại đã xác minh | Người dùng đã xác nhận quyền sử dụng số điện thoại |
| Danh tính đã xác minh | Chỉ hiển thị nếu có quy trình xác minh danh tính riêng |
| Đánh giá từ trải nghiệm | Phản hồi gắn với một kết nối/trải nghiệm có ghi nhận trên hệ thống |

(Recommendation) Không sử dụng nhãn “đã xác minh danh tính” khi mới xác minh email hoặc số điện thoại.

---

## 5. Luồng nghiệp vụ chính

### 5.1. Đăng ký và tạo hồ sơ

1. Người dùng nhập tên, năm sinh, email và số điện thoại.
2. (Recommendation) Xác minh email và số điện thoại trước khi gửi hoặc nhận yêu cầu kết nối.
3. Người dùng tạo hồ sơ, bổ sung khả năng và hình ảnh.
4. Hệ thống hiển thị mức độ hoàn thiện.
5. (Recommendation) Kiểm duyệt nội dung công khai có dấu hiệu chứa thông tin liên lạc hoặc nội dung vi phạm.

### 5.2. Tìm kiếm và đề xuất người địa phương

(Recommendation) Du khách cung cấp điểm đến, thời gian, ngôn ngữ và loại trải nghiệm mong muốn. Hệ thống đề xuất dựa trên:

- Khu vực người địa phương am hiểu.
- Lịch có thể nhận khách.
- Ngôn ngữ chung.
- Khả năng và sở thích phù hợp.
- Mức độ hoàn thiện, trạng thái xác minh và đánh giá.

(Recommendation) Mỗi kết quả nên giải thích lý do phù hợp, chẳng hạn: “Có ngôn ngữ chung và phù hợp với sở thích ẩm thực của bạn.”

(Recommendation) Khi người dùng mới chưa có đánh giá, hiển thị “Chưa có đánh giá”, không coi đó là đánh giá kém.

### 5.3. Yêu cầu kết nối và trao đổi

(Recommendation) Luồng kết nối:

1. Du khách gửi yêu cầu kèm nhu cầu trải nghiệm.
2. Người địa phương xem hồ sơ du khách và thông tin yêu cầu.
3. Người địa phương chấp nhận trao đổi, từ chối hoặc yêu cầu bổ sung thông tin.
4. Khi chấp nhận trao đổi, hệ thống mở hội thoại trong app.
5. Hai bên thống nhất nội dung trải nghiệm.

**Chấp nhận trao đổi không đồng nghĩa với xác nhận nhận dẫn khách.**

(Recommendation) Trước khi xác nhận trải nghiệm, hai bên cùng duyệt một bản thống nhất gồm:

- Nội dung, thời gian và điểm gặp.
- Số người tham gia.
- Phạm vi công việc của người địa phương.
- Chi phí và các khoản bao gồm/không bao gồm, nếu có.
- Điều kiện thay đổi hoặc hủy.

Đây là cơ chế đề xuất để giảm hiểu nhầm và hạn chế tranh chấp về chi phí; chưa mặc định Tour-op xử lý thanh toán.

### 5.4. Hoàn thành, đánh giá và báo cáo

(Recommendation)

- Ghi nhận trạng thái hoàn thành trải nghiệm.
- Cho phép hai bên đánh giá lẫn nhau khi có trải nghiệm đủ điều kiện trên hệ thống.
- Tách đánh giá công khai khỏi báo cáo sự cố riêng tư.
- Cho phép chặn người dùng và báo cáo ở hồ sơ, hội thoại hoặc trang trải nghiệm.
- Lưu lịch sử xử lý tranh chấp mà không công khai dữ liệu nhạy cảm.

---

## 6. Các mô-đun cần xây dựng

Toàn bộ cấu trúc kỹ thuật dưới đây là đề xuất triển khai (Recommendation).

| Mô-đun | Trách nhiệm |
|---|---|
| Tài khoản và phân quyền | Đăng ký, đăng nhập, xác minh liên lạc, quản lý vai trò |
| Hồ sơ | Thông tin riêng tư/công khai, hình ảnh, khả năng, mức độ hoàn thiện |
| Tìm kiếm và đề xuất | Lọc người địa phương và giải thích mức độ phù hợp |
| Yêu cầu kết nối | Gửi, nhận, từ chối, hủy và theo dõi trạng thái |
| Nhắn tin | Hội thoại trong app, kiểm soát truy cập, phát hiện chia sẻ liên lạc |
| Xác nhận trải nghiệm | Ghi nhận nội dung hai bên đã thống nhất và lịch sử thay đổi |
| Đánh giá | Phản hồi hai chiều gắn với trải nghiệm |
| An toàn và tranh chấp | Báo cáo, chặn, lưu bằng chứng, xử lý vi phạm |
| Quản trị | Kiểm duyệt và truy vết thao tác quản trị |

### Mô hình dữ liệu cốt lõi

(Recommendation)

- **Account:** thông tin bắt buộc, trạng thái tài khoản, trạng thái xác minh.
- **Profile:** thông tin công khai, vai trò, khả năng, hình ảnh, mức độ hoàn thiện.
- **LocalAvailability:** lịch người địa phương có thể nhận khách.
- **ConnectionRequest:** người gửi, người nhận, nhu cầu và trạng thái.
- **Conversation / Message:** thành viên hội thoại, nội dung, thời gian, trạng thái kiểm duyệt.
- **ExperienceAgreement:** nội dung thống nhất, phiên bản và xác nhận của mỗi bên.
- **Review:** người viết, người nhận, trải nghiệm liên quan, nội dung đánh giá.
- **Report / Dispute:** nội dung báo cáo, bằng chứng, trạng thái và kết quả xử lý.
- **AuditLog:** lịch sử truy cập nhạy cảm và thao tác quản trị.

(Recommendation) Tách dữ liệu tài khoản riêng tư khỏi dữ liệu hồ sơ công khai; chỉ thành viên hợp lệ được đọc hội thoại. Nhân sự xử lý tranh chấp chỉ truy cập nội dung theo quyền và vụ việc được giao, có lưu nhật ký truy cập.

(Recommendation) Xác định chính sách lưu trữ, xóa tài khoản và giữ bằng chứng tranh chấp trước khi triển khai thực tế.

---

## 7. Phạm vi phiên bản đầu và tiêu chí nghiệm thu

### Phạm vi MVP

(Recommendation) Ưu tiên:

1. Đăng ký và xác minh thông tin liên lạc.
2. Hồ sơ hai phía và mức độ hoàn thiện.
3. Tìm kiếm, lọc và đề xuất theo quy tắc.
4. Yêu cầu kết nối và nhắn tin trong app.
5. Xác nhận nội dung trải nghiệm.
6. Đánh giá hai chiều.
7. Báo cáo, chặn và công cụ quản trị cơ bản.

(Recommendation) Chưa đưa vào MVP: thuật toán đề xuất phức tạp, thanh toán tích hợp hoặc tự động tổng hợp đánh giá bên ngoài. Canvas có đề cập tích hợp thông tin từ các trang mạng, nhưng chưa xác định nguồn dữ liệu, quyền sử dụng và cách đối chiếu đúng người.

### Tiêu chí nghiệm thu chính

(Recommendation)

- Không thể hoàn tất đăng ký nếu thiếu tên, năm sinh, email hoặc số điện thoại.
- Hồ sơ công khai và API tương ứng không làm lộ thông tin liên lạc.
- Thay đổi thông tin hồ sơ làm cập nhật mức độ hoàn thiện.
- Người ngoài hội thoại không thể đọc tin nhắn bằng cách thay đổi đường dẫn hoặc mã định danh.
- Việc đồng ý trao đổi không tự động chuyển thành xác nhận trải nghiệm.
- Đánh giá phải gắn với trải nghiệm đủ điều kiện; người dùng không thể tự đánh giá mình.
- Báo cáo sự cố tạo hồ sơ xử lý riêng, không tự động đăng công khai.
- Các mẫu chia sẻ liên lạc thuộc bộ quy tắc kiểm thử được cảnh báo hoặc chặn đúng thiết kế.

---

## Assumptions and Open Questions

- (Assumption) Một tài khoản có thể sử dụng cả hai vai trò; founder cần xác nhận mô hình này.
- Phân khúc khách hàng và địa bàn khởi đầu chưa được cung cấp; cần bổ sung để thiết kế tiêu chí đề xuất phù hợp.
- Canvas ghi “Đảm bảo” nhưng chưa xác định phạm vi. Cần làm rõ đây là hỗ trợ tranh chấp, xác minh, bảo vệ giao dịch hay cam kết khác; chưa nên công bố bảo đảm tuyệt đối.
- Cần xác định chính sách độ tuổi, quy trình xác minh danh tính, quy tắc đánh giá và thời hạn xử lý báo cáo.
- Mô hình doanh thu, thanh toán và cơ cấu chi phí chưa được cung cấp; thiết kế hiện tại chưa giả định phí môi giới hoặc cơ chế hoàn tiền.
- (Recommendation) Founder cần chốt danh sách trường công khai, cách tính hoàn thiện và chính sách lưu trữ hội thoại trước khi phát triển.