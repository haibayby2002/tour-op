Được. Tôi sẽ tính theo **chi phí hạ tầng + tài khoản phát hành**, giả định **bạn tự code Tour-op** bằng stack đã chọn: **Django + DRF + PostgreSQL/PostGIS + Redis/Celery/Channels + React Web + React Native/Expo**.

Tôi tách thành **MVP** và **5.000 users**, vì 5.000 registered users chưa đồng nghĩa với 5.000 người hoạt động cùng lúc.

### Giả định

* MVP: khoảng **100–500 registered users**, vài chục đến vài trăm booking/tháng.
* Scale: **5.000 registered users**, khoảng **1.000–3.000 MAU**.
* Ảnh profile/service có upload; chưa tính video.
* Messaging realtime.
* Chưa tính chi phí nhân sự vì bạn tự phát triển.
* Chưa tính SMS/OTP, bản đồ, payment gateway, VoIP/number masking, identity verification vì đây là **usage-based cost** và phụ thuộc provider.
* 1 USD ≈ **26.000 VND** để quy đổi dễ tính.
* Giá cloud dưới đây là **ước tính ngân sách**, không phải báo giá cố định.

Apple Developer hiện là **$99/năm**; Google Play Console là **$25 một lần**. ([Apple Developer][1])

---

# 1. Chi phí MVP

Tôi sẽ chọn kiến trúc tiết kiệm:

```text
Cloudflare
     │
     ├── Web
     │
     ▼
Railway
 ├── Django
 ├── Celery
 ├── Redis
 └── PostgreSQL
     
Cloudflare R2
 └── Images / files

Expo
 └── iOS / Android builds
```

Railway hiện có Hobby từ **$5/tháng**, tính thêm theo resource thực tế; đây là lựa chọn khá phù hợp cho MVP Django. ([Railway Docs][2])

| Hạng mục           | MVP / tháng |     MVP / năm | Ghi chú                             |
| ------------------ | ----------: | ------------: | ----------------------------------- |
| Domain             |           — |       ~$15–25 | tùy domain                          |
| Cloudflare Web/CDN |        $0–5 |         $0–60 | Có thể dùng Free                    |
| Django API         |      ~$5–15 |      ~$60–180 | Railway                             |
| PostgreSQL/PostGIS |      ~$5–15 |      ~$60–180 | Railway                             |
| Redis              |         ~$5 |          ~$60 | Có thể chạy cùng infrastructure nhỏ |
| Celery Worker      |      ~$5–10 |      ~$60–120 | background jobs                     |
| Object Storage     |       ~$0–3 |        ~$0–36 | R2                                  |
| Monitoring/logging |          $0 |            $0 | dùng basic                          |
| Expo/EAS           |          $0 |            $0 | Free đủ để bắt đầu                  |
| Apple Developer    |           — |       **$99** | bắt buộc để publish                 |
| Google Play        |           — |       **$25** | phí đăng ký một lần                 |
| **Tổng**           | **~$20–56** | **~$339–745** | ≈ **8,8–19,4 triệu VND/năm**        |

Cloudflare R2 hiện có **10 GB storage miễn phí**, sau đó Standard Storage là $0.015/GB-month và không tính phí egress Internet. ([Cloudflare Docs][3])

Expo hiện có Free plan với **15 Android + 15 iOS builds/tháng**, submit lên App Store/Google Play và OTA updates cho tối đa 1.000 MAU. ([Expo][4])

### → Tôi sẽ dự trù MVP khoảng **15 triệu VND/năm**

Không cần tiêu hết; đây là ngân sách an toàn.

---

# 2. Khi Tour-op đạt 5.000 users

Lúc này tôi sẽ không còn chạy mọi thứ trên một instance nhỏ.

Kiến trúc:

```text
                   Cloudflare
                       │
             ┌─────────┴─────────┐
             │                   │
          React Web          Mobile Apps
             │                   │
             └─────────┬─────────┘
                       │
                    Django
                  API servers
                       │
          ┌────────────┼────────────┐
          │            │            │
       Postgres      Redis       Celery
       PostGIS                    workers
          │
          │
      Object Storage
          │
       R2 / S3
```

Render chẳng hạn hiện có web service từ cấu hình 0.5 CPU/512 MB và có thể scale lên các cấu hình lớn hơn; Postgres cũng có các tier riêng. ([Render][5])

### Ngân sách tôi đề xuất:

| Hạng mục                 | 5.000 users / tháng |             / năm |
| ------------------------ | ------------------: | ----------------: |
| Domain                   |                 ~$2 |              ~$24 |
| Cloudflare               |                 ~$5 |              ~$60 |
| Django API               |              $25–50 |          $300–600 |
| PostgreSQL/PostGIS       |              $25–50 |          $300–600 |
| Redis                    |              $10–20 |          $120–240 |
| Celery/background worker |              $15–30 |          $180–360 |
| Object Storage           |               $2–10 |           $24–120 |
| Monitoring/logging       |               $0–20 |            $0–240 |
| Backup                   |               $5–15 |           $60–180 |
| Expo/EAS                 |              $19–50 |          $228–600 |
| Apple Developer          |                   — |               $99 |
| Google Play              |                   — |      $25 one-time |
| **Tổng**                 |       **~$108–252** | **~$1,400–3,100** |

Tương đương khoảng:

### **36–81 triệu VND/năm**

Đây là mức tôi sẽ **budget**, chứ không phải nói rằng Tour-op chắc chắn sẽ tiêu đúng số đó.

---

# 3. Vì sao 5.000 users chưa cần infrastructure quá lớn?

5.000 users thực ra **rất nhỏ đối với PostgreSQL/Django** nếu traffic chưa cao.

Ví dụ:

```text
5,000 registered users

        ↓

1,500 MAU

        ↓

500 active travelers

        ↓

100–300 bookings/month
```

thì một PostgreSQL vài GB và Django 1–2 instances vẫn có thể xử lý được nếu code tốt.

Thứ có thể làm chi phí tăng nhanh hơn database là:

```text
Messaging
Image uploads
Maps
SMS
VoIP
Identity verification
Push notifications
Payment
```

Đặc biệt nếu Tour-op bắt đầu có **gọi điện qua app**, đó sẽ là một khoản riêng.

---

# 4. Chi phí Mobile

Phần này thực ra khá rẻ nếu bạn tự phát triển.

| Khoản           |           MVP |      5K users |
| --------------- | ------------: | ------------: |
| React Native    |            $0 |            $0 |
| Expo            |            $0 | ~$19–50/tháng |
| Apple Developer |      $99/year |      $99/year |
| Google Play     |  $25 one-time |  $25 one-time |
| CI/CD           |         $0–20 |        $20–50 |
| **Năm đầu**     | **~$124–365** | **~$350–775** |

Expo Starter hiện là $19/tháng và Production $199/tháng; Starter bao gồm 3.000 MAU cho EAS Update, trong khi Production bao gồm 50.000 MAU. ([Expo][4])

**Nhưng:** 5.000 registered users không nhất thiết cần Production. Nếu bạn không phụ thuộc nhiều vào Expo OTA Update, có thể tiếp tục tối ưu chi phí bằng build/CI phù hợp.

---

# 5. Một cấu hình tôi thực sự khuyên bạn dùng

## MVP

```text
Frontend
└── React + Vite
       │
Cloudflare
       │
Backend
└── Django + DRF
       │
       ├── PostgreSQL + PostGIS
       ├── Redis
       ├── Celery
       └── Django Channels
       
Storage
└── Cloudflare R2

Mobile
└── React Native + Expo
```

### Budget:

**~1–1.5 triệu VND/tháng**

hoặc:

**~12–18 triệu VND/năm**

bao gồm cả developer accounts.

---

# 6. Scale 5.000 users

Tôi sẽ chuyển sang:

```text
Cloudflare
     │
     ▼
Load Balancer
     │
 ┌───┴────┐
 ▼        ▼
Django   Django
 #1       #2
 │        │
 └───┬────┘
     │
 ┌───┴─────────────┐
 │                 │
PostgreSQL       Redis
 │                 │
 │              Celery
 │                 │
 ▼                 ▼
Backup          Workers
     
     +
     
R2 Object Storage
```

Budget:

**~3–7 triệu VND/tháng**

là mức tôi cho rằng hợp lý để bạn dự trù cho 5.000 users.

---

# 7. Nhưng có 4 khoản chưa nên đưa vào con số trên

Đây là phần quan trọng.

### ① SMS / OTP

Nếu bạn bắt buộc:

```text
Phone
 ↓
OTP
 ↓
Verify
```

thì mỗi SMS có chi phí.

5.000 users × nhiều lần OTP có thể bắt đầu đáng kể.

---

### ② Map / Geocoding

Bạn có thể cần:

```text
Address
 ↓
Geocoding
 ↓
Coordinates
 ↓
PostGIS
```

Chi phí phụ thuộc provider và số request.

MVP nên **không gọi geocoding liên tục**.

---

### ③ VoIP / Phone masking

Nếu bạn triển khai:

```text
Traveler
     ↓
[Call]
     ↓
Tour-op
     ↓
Local
```

thì có thể phát sinh:

* số điện thoại ảo
* phút gọi
* SIP/VoIP
* recording nếu có
* routing

Đây có thể là khoản đáng kể khi volume tăng.

---

### ④ Identity verification

Nếu Tour-op yêu cầu:

```text
ID Card
Passport
Selfie
Liveness
```

thì thường tính theo verification.

**Tôi sẽ không đưa khoản này vào MVP budget.**

---

# 8. Tổng ngân sách tôi khuyên bạn chuẩn bị

|                       |       **MVP** | **5.000 users** |
| --------------------- | ------------: | --------------: |
| Web                   |   ~0–1M/tháng | ~0.2–0.5M/tháng |
| Django/API            |     ~0.2–0.4M |       ~0.7–1.3M |
| PostgreSQL            |     ~0.2–0.4M |       ~0.7–1.3M |
| Redis/Celery          |     ~0.2–0.4M |       ~0.6–1.3M |
| Storage               |       ~0–0.1M |      ~0.05–0.3M |
| Monitoring/backup     |       ~0–0.2M |       ~0.2–0.6M |
| Mobile infrastructure |            ~0 |       ~0.5–1.3M |
| Apple/Google          |    ~0.27M/năm |      ~0.27M/năm |
| **Ước tính/tháng**    | **~0.8–1.5M** |       **~3–7M** |
| **Ước tính/năm**      |   **~12–18M** |     **~36–84M** |

### Tôi sẽ đặt ngân sách thực tế là:

**MVP: ~20 triệu VND/năm**

**5.000 users: ~60 triệu VND/năm**

và giữ thêm **20–30% contingency**.

=> khoảng **25 triệu cho MVP** và **75 triệu/năm khi đạt 5.000 users**.

Đây là **chi phí vận hành kỹ thuật**, chưa bao gồm nhân sự, marketing, pháp lý, bảo hiểm, payment fees, SMS/OTP, map API, identity verification và VoIP.

---

## 9. Có một điểm tôi muốn điều chỉnh so với kiến trúc trước

Với Tour-op, **đừng mua server lớn ngay từ đầu**.

Tôi sẽ triển khai theo 3 nấc:

```text
                 COST
                   │
                   │
       ┌───────────┴───────────┐
       │                       │
     MVP                   1,000 users
   ~1M/month               ~2M/month
       │                       │
       └───────────┬───────────┘
                   │
               5,000 users
               ~3–7M/month
```

Điều này phù hợp với bản chất Tour-op: **chi phí infrastructure nên tăng theo usage, không phải theo tham vọng.**

Và hiện tại tôi nghiêng về **Railway cho MVP** vì mô hình pay-as-you-use khá hợp với giai đoạn đầu; khi cần kiểm soát infrastructure chặt hơn, có thể chuyển Django/Postgres sang Render hoặc cloud riêng. Railway hiện có Hobby $5/tháng và Pro $20/tháng trước resource usage; Render Pro workspace là $25/tháng trước compute. ([Railway Docs][2])

[1]: https://developer.apple.com/help/account/membership/program-enrollment/?utm_source=chatgpt.com "Enrollment - Membership - Account - Help - Apple Developer"
[2]: https://docs.railway.com/pricing?utm_source=chatgpt.com "Pricing | Railway Docs"
[3]: https://developers.cloudflare.com/r2/pricing/?ref=renewalrecord.com&utm_source=chatgpt.com "Pricing · Cloudflare R2 docs"
[4]: https://expo.dev/pricing?utm_source=chatgpt.com "Expo Application Services pricing — Expo"
[5]: https://render.com/pricing?utm_source=chatgpt.com "Pricing | Render"

