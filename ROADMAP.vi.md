🇬🇧 English: [ROADMAP.md](ROADMAP.md)

# Lộ trình maintainer

Lộ trình này phản ánh trạng thái hiện tại của maintainer và không phải cam kết phát hành.

## Trạng thái hiện tại

- README mặc định là tiếng Việt; bản tiếng Anh nằm ở [README.en.md](README.en.md).
- Bridge đã có admin dashboard, setup admin lần đầu, settings mã hóa, logs, quản lý tài khoản Zalo cá
  nhân/OA, webhook URL helper và xóa account.
- Zalo OA đã có OAuth, webhook verify, token refresh, backfill, gửi ảnh/file, nén ảnh lớn và luồng xin
  thông tin khách hàng.
- Tài khoản cá nhân đã có proxy theo từng tài khoản, supervisor tự kết nối lại với backoff lũy thừa và
  đặt Chatwoot account id riêng cho từng tài khoản.
- Cảnh báo vận hành cơ bản qua Telegram/webhook (mất đăng nhập, kẹt reconnecting, job dead-letter) đã
  có trong codebase.
- Media archive, link token hóa, queue bền và dead-letter đã có trong codebase.

## Ngắn hạn

- Chuẩn hóa hướng dẫn production: reverse proxy, HTTPS, backup PostgreSQL/media archive và rotate secret.
- Rà lại `.env.example` và compose comment để đồng bộ hoàn toàn với flow admin UI hiện tại.
- Mở rộng coverage cho các luồng outbound lỗi, OA media upload và Chatwoot inbox provisioning.
- Thêm profile test integration có database cho các test repository hiện cần `TEST_DATABASE_URL`.

## Trung hạn

- Bổ sung health/readiness chi tiết hơn ngoài `/healthz`.
- Tăng observability cho queue, retry, dead-letter và webhook latency.
- Cải thiện quản lý đa tài khoản trong admin dashboard.
- Hoàn thiện chính sách media retention và lựa chọn storage backend.

## Dài hạn

- Mở rộng parity cho Zalo OA khi API chính thức hỗ trợ thêm reaction/recall hoặc metadata tương đương.
- Tối ưu vận hành production: migration strategy, backup/restore drill, dashboard metric và mở rộng cảnh báo.
- Rà soát bảo mật định kỳ cho token, webhook, media link và session admin.

## Trạng thái kiểm thử

Kết quả kiểm tra gần nhất trên code v1.0.4 ngày 2026-06-17:

- 70 test file pass.
- 7 test file skipped có chủ ý vì cần `TEST_DATABASE_URL`.
- 426 test pass, 29 test skipped.
- `npm run build` pass.

Lỗi local trước đó khi Vitest/Vite không load được `sharp` đã được xử lý bằng cách cài lại dependency
với `npm ci`.

Nợ kiểm thử còn lại tập trung ở nhóm repository test cần cấu hình `TEST_DATABASE_URL`.

## Cách sử dụng Codex

Xem phần "Cách Codex được sử dụng" trong [README.md](README.md).
