Tôi nghĩ **không nên để nút “Gọi” của Tour-op thực hiện cuộc gọi điện thoại trực tiếp giữa hai số thật** nếu mục tiêu của bạn là bảo vệ thông tin và kiểm soát an toàn.

Thay vào đó, nên phân biệt 3 mức:

| Cách gọi                 | Số thật có lộ? | Tour-op kiểm soát? | Phù hợp |
| ------------------------ | -------------: | ------------------: | ------- |
| 📞 Gọi điện trực tiếp    |             Có |                Thấp | ❌       |
| 🔒 Gọi qua app/VoIP      |          Không |                 Cao | ✅       |
| 🔀 Số trung gian/masking |          Không |      Trung bình–cao | ✅       |

### Tôi khuyên Tour-op dùng **in-app calling**

Luồng sẽ là:

```text
Traveler
   │
   │ [📞 Call]
   ▼
Tour-op
   │
   ├── xác định Booking/Conversation
   ├── kiểm tra quyền gọi
   └── thiết lập cuộc gọi
           │
           ├──────────────┐
           ▼              ▼
       Traveler          Local
       Mobile            Mobile
```

Hai bên **không nhìn thấy số điện thoại của nhau**.

Điều này rất hợp với nguyên tắc bạn đặt ra:

> Email + phone là thông tin private, không công khai cho đối phương.

---

### Nhưng có một điểm rất quan trọng

Nếu bạn nói:

> “Bấm gọi → điện thoại đến điện thoại”

thì **vẫn có thể làm được**, nhưng nên dùng **số điện thoại trung gian (number masking)**.

Ví dụ:

```text
Traveler
09xx xxx 111
       │
       │ Call
       ▼
Tour-op virtual number
       │
       ▼
Local
09xx xxx 222
```

Hai bên nghe như một cuộc gọi điện thoại bình thường, nhưng:

```text
Traveler không biết 09xx xxx 222
Local không biết 09xx xxx 111
```

Tour-op biết cuộc gọi thuộc:

```text
Booking #123
Conversation #456
```

và có thể ghi nhận:

```text
Call started
Call ended
Duration
Participants
Booking
```

**Không nhất thiết phải ghi âm.** Ghi âm cuộc gọi là một vấn đề privacy/pháp lý riêng và không nên mặc định bật.

---

## Tôi sẽ chọn gì cho Tour-op?

**MVP:** Messaging trước.

**Phase 2:** In-app VoIP.

**Nếu có nhu cầu “gọi như điện thoại bình thường”:** Number masking.

Tôi sẽ tránh:

```text
[Call]
   ↓
window.location = "tel:+849..."
```

vì lúc đó Tour-op gần như mất lớp bảo vệ quan trọng nhất:

```text
Privacy
   ↓
Communication control
   ↓
Evidence
   ↓
Dispute handling
```

Một thiết kế khá đẹp là trong Conversation:

```text
┌─────────────────────────────────┐
│ Nguyễn A                        │
│ Local Guide · Verified          │
│                                 │
│  [ 💬 Message ]   [ 📞 Call ]   │
│                                 │
│  Booking #TO-10291               │
│  Saigon Food Experience          │
└─────────────────────────────────┘
```

Khi bấm **Call**, hệ thống kiểm tra **hai bên có một booking/conversation hợp lệ hay không**, rồi mới cho phép gọi.

Như vậy cuộc gọi không chỉ là communication feature; nó trở thành **một phần của trust & safety architecture của Tour-op**.
