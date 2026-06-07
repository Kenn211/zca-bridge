🇬🇧 English: [SECURITY.md](SECURITY.md)

# Chính sách bảo mật

## Báo cáo lỗ hổng

Vui lòng báo cáo vấn đề bảo mật riêng tư tới **diendh2014@gmail.com**. Không mở issue công khai cho
lỗ hổng bảo mật. Hãy gửi các bước tái hiện, phạm vi ảnh hưởng, log đã che thông tin nhạy cảm và phiên
bản/commit đang dùng; maintainer sẽ phản hồi trong vòng vài ngày.

## Phiên bản được hỗ trợ

Đây là dự án giai đoạn đầu. Bản vá bảo mật nhắm vào `main` mới nhất và bản release/tag gần nhất.

## Rủi ro Zalo cá nhân

Kênh tài khoản Zalo cá nhân dùng [`zca-js`](https://github.com/RFS-ADRENO/zca-js), một thư viện
**không chính thức**. Dùng API không chính thức có thể khiến tài khoản Zalo bị hạn chế, khóa hoặc cấm
vĩnh viễn. Nên dùng tài khoản phụ, không dùng tài khoản quan trọng hoặc có dữ liệu nhạy cảm.

Kênh Zalo Official Account (OA) dùng API chính thức của Zalo và không thuộc rủi ro từ `zca-js`.

## Secret và dữ liệu nhạy cảm

- **Không commit secret:** không đưa `.env`, token thật, app secret, session Zalo, cookie, private key,
  database dump hoặc log chứa dữ liệu khách hàng vào git.
- **Mã hóa credentials:** session Zalo và setting nhạy cảm được mã hóa lúc lưu bằng AES-256-GCM thông
  qua `CREDENTIALS_KEY`. Khóa này phải là 64 ký tự hex, tạo bằng `openssl rand -hex 32`.
- **Admin UI:** admin dashboard dùng tài khoản admin tạo lần đầu và cookie phiên ký bằng secret dẫn
  xuất từ `CREDENTIALS_KEY`. Mật khẩu admin phải tối thiểu 8 ký tự; vẫn nên đặt bridge sau HTTPS và
  reverse proxy có kiểm soát truy cập nếu expose ra Internet.
- **Webhook Chatwoot:** dùng `WEBHOOK_SECRET` để URL webhook có secret path riêng.
- **Webhook Zalo OA:** dùng `ZALO_OA_SECRET_KEY` để verify MAC signature của webhook OA.
- **Media:** attachment được archive cục bộ; file lớn phục vụ qua `/media/:token` với TTL tùy chọn
  (`MEDIA_TOKEN_TTL_DAYS`). Không chia sẻ link media ra ngoài phạm vi cần thiết.
- **Database:** dùng PostgreSQL riêng cho bridge, tách khỏi database của Chatwoot.

## Hướng dẫn vận hành an toàn

- Dùng HTTPS cho `PUBLIC_BASE_URL`.
- Giữ `/admin/`, `/webhooks/*` và `/media/*` sau reverse proxy đáng tin cậy.
- Rotate `CREDENTIALS_KEY`, `WEBHOOK_SECRET`, `ZALO_OA_APP_SECRET`, `ZALO_OA_SECRET_KEY` và
  `CHATWOOT_API_ACCESS_TOKEN` nếu nghi ngờ bị lộ.
- Nếu rotate `CREDENTIALS_KEY`, cần kế hoạch đăng nhập lại hoặc migrate lại các secret đã mã hóa cũ.
- Giới hạn quyền của Chatwoot access token ở mức cần thiết cho bridge.
- Backup PostgreSQL và media archive theo cùng chính sách retention.

## Kiểm tra lộ thông tin trước khi commit

Chạy scan tối thiểu trước khi commit tài liệu hoặc cấu hình:

```bash
rg -n "BEGIN (RSA|OPENSSH|PRIVATE)|AKIA|ghp_|github_pat_|xox[baprs]-|sk-[A-Za-z0-9]|AIza" .
rg -n "(password|secret|token|api[_-]?key|credential)" *.md .env.example docker-compose*.yml
```

Kết quả hợp lệ trong tài liệu chỉ nên là tên biến, placeholder hoặc test fixture giả. Nếu thấy giá trị
thật, hãy xóa khỏi git history nếu đã commit và rotate secret ngay.
