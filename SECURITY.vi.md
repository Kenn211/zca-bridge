🇬🇧 English: [SECURITY.md](SECURITY.md)

# Chính sách bảo mật

## Báo cáo lỗ hổng bảo mật

Vui lòng báo cáo các vấn đề bảo mật một cách riêng tư tới **c@vietts.dev**. Không mở issue công khai cho các lỗ hổng bảo mật. Hãy cung cấp các bước tái hiện và mức độ ảnh hưởng; bạn sẽ nhận được phản hồi trong vòng vài ngày.

## Các phiên bản được hỗ trợ

Đây là dự án đang trong giai đoạn đầu. Các bản vá bảo mật nhắm vào `main` mới nhất và bản tagged release gần nhất.

## Rủi ro khi dùng API Zalo không chính thức (đọc trước)

Tài khoản Zalo cá nhân được kết nối qua [`zca-js`](https://github.com/RFS-ADRENO/zca-js) — một thư viện **không chính thức**. Dùng API không chính thức có thể khiến tài khoản Zalo bị **khóa hoặc cấm vĩnh viễn**. Hãy cân nhắc kỹ và **tự chịu rủi ro** — nên dùng tài khoản phụ, không dùng cho tài khoản quan trọng. Riêng kênh Official Account (OA) dùng API chính thức của Zalo nên không thuộc rủi ro này.

## Xử lý thông tin bí mật và dữ liệu nhạy cảm

- **Mã hóa thông tin xác thực:** Thông tin xác thực phiên Zalo được mã hóa lúc lưu trữ bằng AES-256-GCM thông qua `CREDENTIALS_KEY` (một khóa hex 32 byte, tạo bằng `openssl rand -hex 32`). Không bao giờ commit khóa thật; `.env` đã được gitignore.
- **Admin API:** Bảo vệ `/admin/api/*` bằng `ADMIN_TOKEN`.
- **Xác thực webhook:** Dùng `WEBHOOK_SECRET` cho đường dẫn webhook Chatwoot và `ZALO_OA_SECRET_KEY` để xác minh chữ ký MAC của các OA webhook đến.
- **Media:** Các tệp đính kèm được lưu trữ cục bộ; media quá lớn được phục vụ qua các link `/media` có token với TTL tùy chọn (`MEDIA_TOKEN_TTL_DAYS`).
- **Cơ sở dữ liệu:** Chạy một PostgreSQL riêng cho bridge, tách biệt khỏi DB của Chatwoot.

## Hướng dẫn vận hành

- Đặt bridge sau HTTPS tại `PUBLIC_BASE_URL`.
- Xoay vòng `CREDENTIALS_KEY`, `ADMIN_TOKEN`, và `WEBHOOK_SECRET` nếu chúng có thể đã bị lộ.
- Hàng đợi bền sẽ thử lại các lỗi tạm thời và chuyển vào dead-letter các lỗi vĩnh viễn, do đó một sự cố hoặc khởi động lại sẽ không làm mất hoặc bỏ sót tin nhắn.
