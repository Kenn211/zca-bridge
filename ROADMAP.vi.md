🇬🇧 English: [ROADMAP.md](ROADMAP.md)

# Lộ trình maintainer

Lộ trình này phản ánh trạng thái hiện tại của maintainer và không phải cam kết phát hành.

## Trạng thái hiện tại

- README mặc định là tiếng Việt; bản tiếng Anh nằm ở [README.en.md](README.en.md).
- Bridge đã có admin dashboard, setup admin lần đầu, settings mã hóa, logs, quản lý tài khoản Zalo cá
  nhân/OA, webhook URL helper và xóa account.
- Zalo OA đã có OAuth, webhook verify, token refresh, backfill, gửi ảnh/file, nén ảnh lớn và luồng xin
  thông tin khách hàng.
- Media archive, link token hóa, queue bền và dead-letter đã có trong codebase.

## Ngắn hạn

- Khôi phục trạng thái test xanh trên môi trường local/CI, đặc biệt nhóm test đang fail khi module
  native `sharp` không được load.
- Chuẩn hóa hướng dẫn production: reverse proxy, HTTPS, backup PostgreSQL/media archive và rotate secret.
- Rà lại `.env.example` và compose comment để đồng bộ hoàn toàn với flow admin UI hiện tại.
- Mở rộng coverage cho các luồng outbound lỗi, OA media upload và Chatwoot inbox provisioning.

## Trung hạn

- Bổ sung health/readiness chi tiết hơn ngoài `/healthz`.
- Tăng observability cho queue, retry, dead-letter và webhook latency.
- Cải thiện quản lý đa tài khoản trong admin dashboard.
- Hoàn thiện chính sách media retention và lựa chọn storage backend.

## Dài hạn

- Mở rộng parity cho Zalo OA khi API chính thức hỗ trợ thêm reaction/recall hoặc metadata tương đương.
- Tối ưu vận hành production: migration strategy, backup/restore drill, dashboard metric và alert.
- Rà soát bảo mật định kỳ cho token, webhook, media link và session admin.

## Nợ kỹ thuật kiểm thử

Kết quả kiểm tra gần nhất bằng `npm test` trên môi trường local ngày 2026-06-07:

- 62 test file pass.
- 5 test file skipped có chủ ý vì cần `TEST_DATABASE_URL`.
- 5 suite fail khi Vitest/Vite không load được module `sharp`.
- 353 test pass, 20 test skipped.

Các file fail do lỗi load `sharp`:

- `test/handlers/outbound.test.ts`
- `test/handlers/outboundConsult.test.ts`
- `test/handlers/outboundLog.test.ts`
- `test/zalo-oa/sender.test.ts`
- `test/zalo-oa/imageCompress.test.ts`

`sharp` hiện là dependency trong `package.json` và được dùng bởi `src/zalo-oa/imageCompress.ts`, nên
hướng xử lý là sửa môi trường cài dependency/native optional hoặc cấu hình test runner, không xóa các
test này.

## Cách sử dụng Codex

Xem phần "Cách Codex được sử dụng" trong [README.md](README.md).
