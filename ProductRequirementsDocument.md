# PRD MVP — Tour-op: Kết nối khách du lịch nhóm nhỏ với người địa phương đáng tin cậy

Tour-op là sản phẩm giúp khách du lịch đi một mình hoặc nhóm nhỏ 2–3 người tìm được người địa phương phù hợp, có thông tin/đánh giá đáng tin cậy, đồng thời giảm các nỗi sợ phổ biến như bị chặt chém, bị chăn dắt đến nơi không mong muốn, không hợp gu trải nghiệm, và thiếu an toàn. MVP tập trung vào niềm tin, minh bạch kỳ vọng trước tour, và quy trình kết nối cơ bản giữa khách du lịch và người địa phương.

---

## 1. Problem Statement

### Vấn đề đã có trong Lean Canvas

Khách du lịch gặp các vấn đề sau:

- Muốn tìm người địa phương có nhiều trải nghiệm ở địa phương.
- Không biết làm sao tìm được người thật sự phù hợp với mình.
- Có rủi ro trải nghiệm không tốt vì bị chặt chém.
- Người địa phương muốn nhận công việc dẫn tour dạng thời vụ.
- Người dẫn tour một mình cũng có cảm giác bất an vì khách du lịch.

### Bổ sung từ user request

Khách đi tour một mình hoặc nhóm 2–3 người sợ:

- Sợ bị chăn dắt đến những nơi không mong muốn.
- Sợ bị chặt chém.

### Các nỗi sợ bổ sung để hoàn thiện user story

Các điểm dưới đây là **(Assumption)** vì chưa được xác thực bằng dữ liệu người dùng trong Lean Canvas:

- Sợ người dẫn tour không đúng như mô tả hoặc hồ sơ không đáng tin.
- Sợ bị đưa đến cửa hàng/quán ăn/địa điểm có hoa hồng mà không được báo trước.
- Sợ chi phí phát sinh không rõ ràng: phí di chuyển, vé vào cổng, ăn uống, tip, phụ phí ngoài giờ.
- Sợ lịch trình không phù hợp sở thích cá nhân.
- Sợ giao tiếp khó khăn: khác ngôn ngữ, không hiểu văn hóa, không rõ điểm hẹn.
- Sợ mất an toàn cá nhân khi đi với người lạ.
- Sợ bị lừa đảo, fake review hoặc đánh giá không đáng tin.
- Sợ bị hủy tour phút chót mà không có phương án thay thế.
- Sợ không biết phải xử lý thế nào nếu có tranh chấp.
- Sợ thông tin cá nhân bị lộ hoặc bị làm phiền sau tour.
- Sợ guide thiếu kỹ năng xử lý tình huống: lạc đường, thời tiết xấu, tai nạn, sự cố sức khỏe.
- Với người dẫn tour địa phương: sợ khách không xuất hiện, cư xử không phù hợp, không trả tiền, hoặc gây nguy hiểm **(Assumption)**.

---

## 2. Target Users and Jobs-to-be-done

> Customer Segments trong Lean Canvas hiện đang `_Not provided._`, vì vậy các nhóm người dùng dưới đây là **(Assumption)** dựa trên Problem và user request.

### User Group 1: Khách du lịch đi một mình

**JTBD:**

- Khi tôi đi du lịch một mình, tôi muốn tìm người địa phương đáng tin để dẫn tôi đi theo sở thích, để tôi có trải nghiệm an toàn và không bị chặt chém.
- Khi tôi chọn guide, tôi muốn xem thông tin, đánh giá và kinh nghiệm liên quan, để biết người này có phù hợp với mình không.
- Khi tôi đặt tour, tôi muốn biết rõ giá, lịch trình và chi phí phát sinh, để tránh bị dẫn đến nơi không mong muốn hoặc bị tính tiền bất ngờ.

### User Group 2: Khách du lịch nhóm nhỏ 2–3 người

**JTBD:**

- Khi nhóm tôi muốn trải nghiệm địa phương, chúng tôi muốn tìm guide phù hợp với phong cách nhóm, để có chuyến đi linh hoạt nhưng vẫn an toàn.
- Khi đi theo nhóm nhỏ, chúng tôi muốn thống nhất trước lịch trình, điểm đến và ngân sách, để tránh bị đưa đến nơi không mong muốn.

### User Group 3: Người địa phương muốn dẫn tour thời vụ

**JTBD:**

- Khi tôi có thời gian rảnh và hiểu địa phương, tôi muốn nhận công việc dẫn tour thời vụ, để kiếm thêm thu nhập.
- Khi nhận khách, tôi muốn biết thông tin cơ bản, nhu cầu và lịch trình của khách, để chuẩn bị tốt và cảm thấy an toàn.
- Khi hoàn thành tour, tôi muốn nhận đánh giá tích cực, để tăng uy tín cho các tour sau.

---

## 3. Goals and Non-goals for the MVP

### Goals

1. Giúp khách tìm được người địa phương phù hợp dựa trên thông tin hồ sơ, trải nghiệm và đánh giá.
2. Giảm nỗi sợ bị chặt chém bằng cách hiển thị giá/chi phí dự kiến trước khi xác nhận tour **(Recommendation)**.
3. Giảm nỗi sợ bị chăn dắt đến nơi không mong muốn bằng cách yêu cầu guide và khách thống nhất lịch trình trước tour **(Recommendation)**.
4. Cho phép người địa phương đăng ký hồ sơ để nhận công việc dẫn tour thời vụ.
5. Tăng cảm giác an toàn cho cả khách và guide bằng hồ sơ xác thực cơ bản, đánh giá hai chiều và thông tin tour rõ ràng **(Recommendation)**.
6. Tích hợp hoặc hiển thị thông tin từ các trang mạng và đánh giá cho ứng viên/guide du lịch, theo Solution trong Lean Canvas.

### Non-goals

Các mục sau không nên đưa vào MVP để giữ phạm vi nhỏ:

- Không xây dựng hệ thống thanh toán phức tạp hoặc ví điện tử ngay từ đầu **(Recommendation)**.
- Không xây dựng marketplace đầy đủ với thuật toán matching nâng cao ở MVP.
- Không cam kết kiểm chứng toàn bộ danh tính/pháp lý của guide nếu chưa có quy trình vận hành rõ ràng **(Assumption)**.
- Không triển khai bảo hiểm, tổng đài khẩn cấp 24/7 hoặc bảo lãnh tài chính ở MVP nếu chưa có đối tác/vận hành **(Recommendation)**.
- Không mở rộng sang tour đoàn lớn vì user request tập trung vào khách đi một mình hoặc nhóm 2–3 người.

---

## 4. Success Metrics

> Key Metrics trong Lean Canvas hiện đang `_Not provided._`. Các chỉ số dưới đây là đề xuất và mục tiêu định lượng chỉ là placeholder **(Assumption)**.

### Marketplace Metrics

- Số lượng guide địa phương tạo hồ sơ hoàn chỉnh: **[TBD] guide/tháng (Assumption)**.
- Số lượng khách gửi yêu cầu tìm guide: **[TBD] request/tháng (Assumption)**.
- Tỷ lệ request được guide phản hồi: **[TBD]% (Assumption)**.
- Tỷ lệ request chuyển thành tour được xác nhận: **[TBD]% (Assumption)**.

### Trust & Safety Metrics

- Tỷ lệ tour có lịch trình và giá được xác nhận trước: **[TBD]% (Assumption)**.
- Tỷ lệ khách báo cáo bị phát sinh chi phí không rõ ràng: dưới **[TBD]% (Assumption)**.
- Tỷ lệ khách đánh giá “cảm thấy an toàn”: **[TBD]% (Assumption)**.
- Tỷ lệ khiếu nại liên quan đến chặt chém/chăn dắt: dưới **[TBD]% (Assumption)**.

### Experience Metrics

- Điểm đánh giá trung bình của guide sau tour: **[TBD]/5 (Assumption)**.
- Tỷ lệ khách để lại review sau tour: **[TBD]% (Assumption)**.
- Tỷ lệ khách quay lại đặt tour lần sau: **[TBD]% (Assumption)**.

---

## 5. User Stories

## Epic A — Khám phá và chọn guide phù hợp

### Story A1: Xem danh sách guide địa phương

**As a** khách du lịch đi một mình hoặc nhóm nhỏ,  
**I want** xem danh sách người địa phương có thể dẫn tour,  
**so that** tôi có thể chọn người phù hợp với nhu cầu và cảm thấy yên tâm hơn.

**Acceptance Criteria:**

- Khách có thể xem danh sách guide theo địa điểm **(Recommendation)**.
- Mỗi guide hiển thị tên, ảnh, mô tả ngắn, khu vực am hiểu và ngôn ngữ **(Recommendation)**.
- Guide hiển thị trạng thái hồ sơ đã hoàn thiện/chưa hoàn thiện **(Recommendation)**.
- Guide có khu vực hiển thị đánh giá hoặc liên kết đánh giá từ nguồn bên ngoài, phù hợp với Solution “tích hợp thông tin các trang mạng và đánh giá”.

### Story A2: Xem hồ sơ chi tiết của guide

**As a** khách du lịch,  
**I want** xem hồ sơ chi tiết, kinh nghiệm và đánh giá của guide,  
**so that** tôi tránh chọn nhầm người không phù hợp hoặc không đáng tin.

**Acceptance Criteria:**

- Hồ sơ guide hiển thị mô tả kinh nghiệm địa phương, sở thích, phong cách dẫn tour **(Recommendation)**.
- Hồ sơ hiển thị các đánh giá nội bộ hoặc đường dẫn/ảnh chụp/nguồn tham khảo đánh giá bên ngoài **(Recommendation)**.
- Hồ sơ hiển thị các loại trải nghiệm guide có thể hỗ trợ, ví dụ: ẩm thực, văn hóa, đi bộ, khám phá địa phương **(Assumption)**.
- Nếu thông tin đánh giá chưa được xác minh, hệ thống phải hiển thị trạng thái rõ ràng: “chưa xác minh” **(Recommendation)**.

### Story A3: Lọc guide theo nhu cầu cá nhân

**As a** khách du lịch,  
**I want** lọc guide theo địa điểm, ngôn ngữ, ngân sách và loại trải nghiệm,  
**so that** tôi nhanh chóng tìm được người phù hợp.

**Acceptance Criteria:**

- Khách có thể lọc theo địa điểm **(Recommendation)**.
- Khách có thể lọc theo ngôn ngữ **(Recommendation)**.
- Khách có thể lọc theo khoảng giá hoặc ngân sách dự kiến **(Recommendation)**.
- Khách có thể lọc theo loại trải nghiệm **(Assumption)**.

---

## Epic B — Minh bạch lịch trình và chi phí

### Story B1: Xem giá và chi phí dự kiến trước khi đặt

**As a** khách du lịch,  
**I want** biết trước giá tour và các chi phí có thể phát sinh,  
**so that** tôi không bị chặt chém.

**Acceptance Criteria:**

- Guide phải nhập giá cơ bản hoặc khoảng giá trước khi nhận request **(Recommendation)**.
- Tour request hiển thị rõ chi phí đã bao gồm và chưa bao gồm **(Recommendation)**.
- Các chi phí như vé vào cổng, di chuyển, ăn uống, phụ phí ngoài giờ có trường ghi chú riêng **(Recommendation)**.
- Trước khi xác nhận, khách phải thấy bản tóm tắt chi phí dự kiến **(Recommendation)**.

### Story B2: Thống nhất lịch trình trước tour

**As a** khách du lịch,  
**I want** thống nhất trước các điểm đến và hoạt động với guide,  
**so that** tôi không bị chăn dắt đến những nơi không mong muốn.

**Acceptance Criteria:**

- Guide đề xuất lịch trình gồm điểm hẹn, thời gian, địa điểm chính và hoạt động **(Recommendation)**.
- Khách có thể chấp nhận hoặc yêu cầu chỉnh sửa lịch trình **(Recommendation)**.
- Hệ thống lưu lại phiên bản lịch trình đã được hai bên xác nhận **(Recommendation)**.
- Nếu guide muốn thay đổi lịch trình sau khi xác nhận, cần có sự đồng ý của khách trong ứng dụng **(Recommendation)**.

### Story B3: Cảnh báo điểm đến thương mại/hoa hồng

**As a** khách du lịch,  
**I want** biết trước nếu lịch trình có cửa hàng, nhà hàng hoặc điểm mua sắm,  
**so that** tôi tránh cảm giác bị dẫn dắt vì lợi ích ngầm.

**Acceptance Criteria:**

- Trong lịch trình, guide có thể đánh dấu điểm đến là “mua sắm”, “ăn uống”, hoặc “đối tác/đề xuất cá nhân” **(Recommendation)**.
- Khách có thể từ chối các điểm đến không mong muốn trước khi xác nhận **(Recommendation)**.
- Hệ thống lưu lại lựa chọn của khách về các điểm đến này **(Recommendation)**.
- Sau tour, khách có thể báo cáo nếu bị đưa đến điểm không có trong lịch trình **(Recommendation)**.

---

## Epic C — Đặt tour và giao tiếp trước chuyến đi

### Story C1: Gửi yêu cầu đặt guide

**As a** khách du lịch,  
**I want** gửi yêu cầu đến guide với ngày giờ, số người và mong muốn trải nghiệm,  
**so that** guide có đủ thông tin để phản hồi.

**Acceptance Criteria:**

- Khách nhập ngày, giờ, số lượng người, khu vực muốn đi **(Recommendation)**.
- Khách nhập sở thích hoặc điều muốn tránh, ví dụ: không mua sắm, không đi bar, tránh nơi đông người **(Assumption)**.
- Guide nhận được request với đầy đủ thông tin cơ bản **(Recommendation)**.
- Guide có thể chấp nhận, từ chối hoặc đề xuất chỉnh sửa **(Recommendation)**.

### Story C2: Chat trước tour

**As a** khách du lịch và guide,  
**I want** trao đổi trước tour trong một kênh chung,  
**so that** hai bên thống nhất kỳ vọng, lịch trình và chi phí.

**Acceptance Criteria:**

- Khách và guide có thể nhắn tin sau khi request được tạo **(Recommendation)**.
- Nội dung quan trọng như lịch trình và giá phải được xác nhận bằng form/tóm tắt, không chỉ qua chat **(Recommendation)**.
- Hệ thống lưu lịch sử trao đổi để hỗ trợ xử lý tranh chấp **(Recommendation)**.
- Người dùng có thể báo cáo nội dung không phù hợp **(Recommendation)**.

---

## Epic D — An toàn và niềm tin cho khách

### Story D1: Xác thực hồ sơ guide cơ bản

**As a** khách du lịch,  
**I want** biết guide đã cung cấp thông tin cơ bản và có dấu hiệu đáng tin cậy,  
**so that** tôi giảm lo lắng khi đi cùng người lạ.

**Acceptance Criteria:**

- Guide phải cung cấp ảnh đại diện, tên, khu vực hoạt động, mô tả kinh nghiệm **(Recommendation)**.
- Guide phải cung cấp ít nhất một thông tin liên hệ hoặc kênh xác thực nội bộ **(Recommendation)**.
- Hệ thống hiển thị trạng thái hồ sơ: chưa hoàn thiện, đã hoàn thiện, hoặc đã kiểm tra thủ công **(Assumption)**.
- Không hiển thị badge “đã xác minh” nếu chưa có quy trình xác minh thật sự **(Recommendation)**.

### Story D2: Nút báo cáo sau tour

**As a** khách du lịch,  
**I want** báo cáo vấn đề sau tour,  
**so that** tôi có cách phản ánh nếu bị chặt chém, bị dẫn sai lịch trình hoặc cảm thấy không an toàn.

**Acceptance Criteria:**

- Khách có thể chọn loại vấn đề: chặt chém, sai lịch trình, ứng xử không phù hợp, an toàn, khác **(Recommendation)**.
- Khách có thể mô tả sự việc và đính kèm ảnh/chứng cứ **(Recommendation)**.
- Báo cáo được lưu trong hệ thống để admin xem xét **(Recommendation)**.
- Guide liên quan không được tự ý xóa báo cáo **(Recommendation)**.

### Story D3: Chia sẻ thông tin tour với người thân

**As a** khách đi một mình,  
**I want** chia sẻ thông tin guide và lịch trình cho người thân,  
**so that** tôi cảm thấy an toàn hơn.

**Acceptance Criteria:**

- Khách có thể tạo link hoặc bản tóm tắt thông tin tour **(Recommendation)**.
- Bản tóm tắt gồm tên guide, thời gian, điểm hẹn, lịch trình chính **(Recommendation)**.
- Khách có thể sao chép hoặc gửi thông tin qua kênh bên ngoài ứng dụng **(Recommendation)**.
- Không chia sẻ thông tin nhạy cảm nếu khách chưa đồng ý **(Recommendation)**.

---

## Epic E — An toàn và cơ hội việc làm cho guide địa phương

### Story E1: Guide tạo hồ sơ nhận tour thời vụ

**As a** người địa phương,  
**I want** tạo hồ sơ guide thời vụ,  
**so that** tôi có thể nhận khách khi có thời gian rảnh.

**Acceptance Criteria:**

- Guide có thể đăng ký tài khoản và tạo hồ sơ cá nhân **(Recommendation)**.
- Guide nhập khu vực am hiểu, loại trải nghiệm có thể dẫn, ngôn ngữ và lịch rảnh **(Recommendation)**.
- Guide nhập mức giá hoặc cách tính giá dự kiến **(Recommendation)**.
- Guide có thể thêm liên kết/ảnh chụp đánh giá từ nền tảng khác, phù hợp với Solution trong Lean Canvas.

### Story E2: Guide xem thông tin request trước khi nhận

**As a** guide địa phương,  
**I want** xem thông tin cơ bản của khách và nhu cầu tour trước khi nhận,  
**so that** tôi cảm thấy an toàn và chuẩn bị tốt hơn.

**Acceptance Criteria:**

- Guide thấy số lượng khách, thời gian, khu vực, mong muốn trải nghiệm **(Recommendation)**.
- Guide thấy ghi chú đặc biệt của khách, ví dụ: tránh mua sắm, ngân sách, ngôn ngữ **(Assumption)**.
- Guide có thể từ chối request nếu không phù hợp **(Recommendation)**.
- Guide có thể báo cáo request đáng ngờ hoặc không phù hợp **(Recommendation)**.

### Story E3: Đánh giá hai chiều

**As a** guide và khách,  
**I want** đánh giá lẫn nhau sau tour,  
**so that** cộng đồng có thêm thông tin tin cậy cho các lần đặt sau.

**Acceptance Criteria:**

- Sau tour, khách có thể đánh giá guide bằng điểm số và nhận xét **(Recommendation)**.
- Guide có thể đánh giá khách bằng điểm số và nhận xét nội bộ hoặc công khai theo chính sách **(Assumption)**.
- Đánh giá chỉ được mở sau khi tour đã diễn ra hoặc được đánh dấu hoàn thành **(Recommendation)**.
- Người dùng có thể báo cáo đánh giá sai sự thật hoặc lạm dụng **(Recommendation)**.

---

## 6. MVP Scope

### Must-have

1. **Hồ sơ guide địa phương**
   - Trace: khách muốn tìm người địa phương có trải nghiệm.
   - Bao gồm: tên, ảnh, khu vực, mô tả, ngôn ngữ, kinh nghiệm, loại tour.

2. **Hiển thị/tích hợp thông tin đánh giá**
   - Trace: Solution “tích hợp thông tin các trang mạng và đánh giá”.
   - MVP có thể bắt đầu bằng việc cho guide thêm link/ảnh chụp/nguồn đánh giá bên ngoài **(Recommendation)**.

3. **Tìm kiếm/lọc guide cơ bản**
   - Trace: khách muốn tìm người phù hợp.
   - Lọc theo địa điểm, ngôn ngữ, loại trải nghiệm, khoảng giá **(Recommendation)**.

4. **Request đặt tour**
   - Trace: kết nối khách với người địa phương.
   - Khách gửi ngày giờ, số người, mong muốn, điều không muốn.

5. **Xác nhận lịch trình và giá trước tour**
   - Trace: giảm chặt chém và chăn dắt.
   - Phải có tóm tắt: điểm hẹn, thời lượng, điểm đến chính, giá, chi phí chưa bao gồm.

6. **Chat hoặc kênh trao đổi trước tour**
   - Trace: giúp hai bên thống nhất phù hợp.
   - Nếu làm MVP siêu nhỏ, có thể là chat đơn giản hoặc ghi chú trao đổi trong request **(Recommendation)**.

7. **Đánh giá sau tour**
   - Trace: tăng niềm tin, hỗ trợ lựa chọn guide.

8. **Báo cáo sự cố**
   - Trace: xử lý nỗi sợ chặt chém, lịch trình sai, an toàn.

### Should-have

1. **Chia sẻ thông tin tour cho người thân**
   - Quan trọng cho khách đi một mình nhưng có thể làm sau khi core booking ổn định.

2. **Trạng thái hồ sơ guide**
   - Ví dụ: hồ sơ hoàn chỉnh, đã kiểm tra thủ công **(Assumption)**.

3. **Đánh giá hai chiều**
   - Giúp guide cũng cảm thấy an toàn với khách.

4. **Mẫu lịch trình chuẩn**
   - Giúp guide tạo tour nhanh và minh bạch hơn.

5. **Bộ câu hỏi sở thích khách**
   - Ví dụ: thích ăn uống, văn hóa, nightlife, thiên nhiên; điều muốn tránh **(Assumption)**.

### Later

1. **Thanh toán trong app / giữ tiền / escrow**
   - Cắt khỏi MVP vì Revenue Streams chưa được cung cấp và vận hành thanh toán có độ phức tạp cao.

2. **Xác minh danh tính nâng cao**
   - Cần quy trình pháp lý/vận hành rõ hơn.

3. **Bảo hiểm hoặc hỗ trợ khẩn cấp 24/7**
   - Cần đối tác, chi phí và quy trình xử lý.

4. **Matching tự động bằng thuật toán**
   - MVP nên kiểm chứng nhu cầu trước khi tối ưu.

5. **Gói tour tiêu chuẩn hóa quy mô lớn**
   - User request đang tập trung vào khách đi một mình hoặc nhóm 2–3 người.

6. **Hệ thống xử lý tranh chấp phức tạp**
   - MVP chỉ cần báo cáo và admin review cơ bản **(Recommendation)**.

### Lý do cắt scope

MVP nên tập trung vào ba câu hỏi quan trọng nhất:

1. Khách có tin guide đủ để gửi request không?
2. Lịch trình và giá có đủ minh bạch để giảm sợ bị chặt chém/chăn dắt không?
3. Người địa phương có sẵn sàng tạo hồ sơ và nhận tour thời vụ không?

---

## 7. Key User Flows

### Flow 1: Khách tìm và gửi request cho guide

1. Khách vào Tour-op.
2. Chọn địa điểm muốn trải nghiệm.
3. Xem danh sách guide.
4. Lọc theo ngôn ngữ, loại trải nghiệm, khoảng giá **(Recommendation)**.
5. Mở hồ sơ guide.
6. Xem mô tả, kinh nghiệm, đánh giá/nguồn đánh giá.
7. Gửi request với ngày giờ, số người, sở thích, điều muốn tránh.
8. Guide nhận request và phản hồi.

### Flow 2: Guide tạo hồ sơ

1. Guide đăng ký tài khoản.
2. Nhập thông tin cá nhân cơ bản.
3. Nhập khu vực am hiểu, ngôn ngữ, loại trải nghiệm có thể dẫn.
4. Nhập giá hoặc khoảng giá dự kiến.
5. Thêm nguồn đánh giá/đường dẫn từ trang khác.
6. Gửi hồ sơ để hiển thị hoặc chờ kiểm tra thủ công **(Assumption)**.

### Flow 3: Hai bên thống nhất lịch trình và giá

1. Guide nhận request.
2. Guide đề xuất lịch trình.
3. Guide nhập giá, chi phí bao gồm và chưa bao gồm.
4. Khách xem tóm tắt.
5. Khách yêu cầu chỉnh sửa hoặc xác nhận.
6. Hệ thống lưu phiên bản lịch trình và giá đã xác nhận.
7. Tour chuyển sang trạng thái “đã xác nhận”.

### Flow 4: Sau tour — đánh giá và báo cáo

1. Sau thời gian tour, hệ thống mở form đánh giá.
2. Khách đánh giá guide.
3. Guide đánh giá khách **(Recommendation)**.
4. Nếu có vấn đề, khách hoặc guide gửi báo cáo.
5. Admin xem báo cáo và ghi nhận trạng thái xử lý **(Recommendation)**.

---

## 8. Functional Requirements

### FR1 — Quản lý tài khoản

- Người dùng có thể đăng ký/đăng nhập.
- Người dùng có thể chọn vai trò: khách, guide, hoặc cả hai **(Recommendation)**.
- Người dùng có thể chỉnh sửa hồ sơ cơ bản.

### FR2 — Hồ sơ guide

- Guide có thể tạo và chỉnh sửa hồ sơ.
- Hồ sơ gồm: tên, ảnh, mô tả, khu vực, ngôn ngữ, kinh nghiệm, loại trải nghiệm, giá dự kiến.
- Guide có thể thêm thông tin đánh giá từ nguồn bên ngoài theo Solution trong Lean Canvas.
- Hệ thống hiển thị trạng thái hồ sơ rõ ràng.

### FR3 — Tìm kiếm và lọc guide

- Khách có thể tìm guide theo địa điểm.
- Khách có thể lọc theo ngôn ngữ, giá, loại trải nghiệm **(Recommendation)**.
- Khách có thể mở hồ sơ chi tiết của guide.

### FR4 — Request đặt tour

- Khách có thể gửi request cho guide.
- Request gồm: ngày giờ, số người, khu vực, sở thích, điều muốn tránh, ngân sách dự kiến **(Recommendation)**.
- Guide có thể chấp nhận, từ chối hoặc đề xuất thay đổi.
- Request có trạng thái: mới, đang trao đổi, đã xác nhận, đã hủy, hoàn thành **(Recommendation)**.

### FR5 — Lịch trình và giá xác nhận

- Guide có thể tạo lịch trình đề xuất.
- Lịch trình gồm: điểm hẹn, thời lượng, điểm đến chính, ghi chú.
- Guide phải nhập giá dự kiến và chi phí chưa bao gồm.
- Khách phải xác nhận lịch trình và giá trước khi tour được đánh dấu “đã xác nhận”.

### FR6 — Chat hoặc trao đổi

- Khách và guide có thể trao đổi sau khi request được tạo.
- Hệ thống lưu lịch sử trao đổi.
- Các thông tin quan trọng phải được xác nhận trong form chính thức, không chỉ trong chat **(Recommendation)**.

### FR7 — Đánh giá và báo cáo

- Khách có thể đánh giá guide sau tour.
- Guide có thể đánh giá khách **(Recommendation)**.
- Người dùng có thể báo cáo sự cố.
- Admin có thể xem danh sách báo cáo **(Recommendation)**.

### FR8 — Chia sẻ thông tin tour

- Khách có thể tạo bản tóm tắt tour để chia sẻ ra ngoài app **(Recommendation)**.
- Nội dung gồm guide, thời gian, điểm hẹn, lịch trình chính.
- Chỉ chia sẻ khi khách chủ động thực hiện.

---

## 9. Non-functional Requirements

### Trust & Safety

- Không gắn nhãn “đã xác minh” nếu chưa có quy trình xác minh thật.
- Các thông tin giá và lịch trình đã xác nhận phải được lưu lại để đối chiếu.
- Người dùng phải có cách báo cáo hành vi không phù hợp.

### Privacy

- Chỉ hiển thị thông tin cá nhân cần thiết.
- Không chia sẻ số điện thoại/email nếu chưa có sự đồng ý hoặc chính sách rõ ràng **(Recommendation)**.
- Cần có cơ chế xóa hoặc ẩn thông tin nhạy cảm theo quyền người dùng **(Recommendation)**.

### Usability

- Quy trình gửi request nên hoàn thành trong vài bước ngắn.
- Hồ sơ guide cần dễ đọc, tập trung vào thông tin tạo niềm tin.
- Chi phí và lịch trình cần hiển thị rõ ràng, tránh nằm rải rác trong chat.

### Reliability

- Trạng thái request và xác nhận lịch trình/giá phải nhất quán.
- Lịch sử xác nhận không nên bị chỉnh sửa âm thầm sau khi khách đã đồng ý.

### Admin/Ops

- Cần có màn hình admin cơ bản để xem hồ sơ guide, báo cáo sự cố và đánh giá bị flag **(Recommendation)**.
- Nếu có kiểm tra thủ công hồ sơ, cần có trạng thái xử lý rõ ràng **(Assumption)**.

---

## 10. Risks, Dependencies, and Open Questions

### Risks

1. **Niềm tin chưa đủ mạnh**
   - Nếu chỉ cho guide tự khai thông tin, khách vẫn có thể không yên tâm.

2. **Đánh giá bên ngoài khó xác minh**
   - Solution nói tích hợp thông tin mạng và đánh giá, nhưng chưa rõ nguồn, cách xác thực, hoặc quyền sử dụng.

3. **Rủi ro chặt chém vẫn xảy ra ngoài app**
   - Nếu thanh toán/chi phí phát sinh không được kiểm soát, vẫn có tranh chấp.

4. **Guide và khách đều có rủi ro an toàn**
   - Lean Canvas có nhắc người dẫn tour một mình sợ bất an vì khách du lịch.

5. **Thiếu Customer Segments**
   - Chưa rõ tập khách chính là khách nội địa, khách quốc tế, backpacker, gia đình nhỏ, hay nhóm bạn.

6. **Chưa rõ mô hình doanh thu**
   - Revenue Streams chưa được cung cấp, nên chưa quyết định có thu phí booking, commission hay subscription.

### Dependencies

- Cần nguồn thông tin/đánh giá bên ngoài nếu muốn “tích hợp thông tin các trang mạng và đánh giá”.
- Cần quy trình vận hành xử lý báo cáo/sự cố.
- Cần chính sách nội dung và đánh giá.
- Cần quyết định có xác minh guide thủ công hay không.
- Cần quyết định có thanh toán trong app hay chỉ xác nhận giá trước tour.

### Open Questions

- Customer Segments chính là ai?
- Tour-op phục vụ địa phương/thành phố nào trước?
- Guide là cá nhân tự do hay có thể là đơn vị/tổ chức?
- “Đảm bảo” trong Solution nghĩa là đảm bảo điều gì: giá, an toàn, chất lượng, hoàn tiền, hay xác minh?
- Có tích hợp trực tiếp với nền tảng đánh giá bên ngoài hay chỉ cho guide thêm link?
- Có cho thanh toán trong app ở MVP không?
- Có kiểm tra danh tính guide không? Nếu có, kiểm tra bằng cách nào?
- Ai xử lý khiếu nại và trong thời gian bao lâu?
- Chính sách nếu guide đổi lịch trình hoặc phát sinh chi phí là gì?
- Khách có cần xác minh trước khi gửi request không?

---

## 11. Assumptions and Open Questions

### Assumptions

- Khách mục tiêu ban đầu là người đi một mình hoặc nhóm nhỏ 2–3 người.
- Người dùng cần cảm giác an toàn trước khi gặp người lạ.
- Khách quan tâm đến minh bạch giá và lịch trình trước tour.
- Guide địa phương sẵn sàng làm thời vụ nếu có hồ sơ và request phù hợp.
- Guide cũng cần được bảo vệ khỏi khách không phù hợp hoặc đáng ngờ.
- Các nỗi sợ bổ sung gồm: fake profile, fake review, phát sinh phí, hủy phút chót, giao tiếp khó, mất an toàn, tranh chấp.
- MVP có thể bắt đầu bằng việc hiển thị link/nguồn đánh giá bên ngoài thay vì tích hợp API thật.
- MVP chưa cần thanh toán trong app.
- MVP cần admin review cơ bản cho báo cáo và hồ sơ guide.
- Các chỉ số thành công và mục tiêu định lượng đều là placeholder vì Key Metrics chưa được cung cấp.

### Unknown Facts

- Customer Segments chưa được cung cấp.
- Unique Value Proposition chưa được cung cấp.
- Channels chưa được cung cấp.
- Revenue Streams chưa được cung cấp.
- Cost Structure chưa được cung cấp.
- Key Metrics chưa được cung cấp.
- Unfair Advantage chưa được cung cấp.
- Solution hiện chưa hoàn chỉnh; mục “Đảm bảo” chưa rõ nội dung.
- Chưa rõ thị trường/khu vực triển khai đầu tiên.
- Chưa rõ khách là nội địa, quốc tế hay cả hai.
- Chưa rõ quy trình xác minh guide.
- Chưa rõ có thanh toán trong app hay không.
- Chưa rõ trách nhiệm pháp lý/vận hành khi có sự cố.
- Chưa rõ cách tích hợp thông tin từ các trang mạng và đánh giá.

### Đề xuất user-story trọng tâm từ nỗi sợ của khách đi một mình/nhóm nhỏ

Nếu cần rút gọn để đưa vào MVP, 5 user story quan trọng nhất nên là:

1. **As a khách du lịch, I want xem hồ sơ và đánh giá của guide so that tôi biết người này có đáng tin không.**
2. **As a khách du lịch, I want biết trước giá và chi phí phát sinh so that tôi không bị chặt chém.**
3. **As a khách du lịch, I want xác nhận lịch trình trước tour so that tôi không bị đưa đến nơi không mong muốn.**
4. **As a khách đi một mình, I want chia sẻ thông tin tour cho người thân so that tôi cảm thấy an toàn hơn.**
5. **As a guide địa phương, I want xem thông tin request của khách trước khi nhận so that tôi cảm thấy an toàn khi đi tour một mình.**