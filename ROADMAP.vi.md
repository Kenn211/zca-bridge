🇬🇧 English: [ROADMAP.md](ROADMAP.md)

# Lộ trình của maintainer

Lộ trình này phản ánh ý định hiện tại của maintainer và không phải là cam kết.

## Ngắn hạn
- Điều chỉnh và khôi phục các test bị cách ly (xem phần Nợ kỹ thuật kiểm thử bên dưới).
- Mở rộng phạm vi unit test cho các handler và worker/queue.
- Viết tài liệu hướng dẫn triển khai production (reverse proxy, HTTPS, backup).

## Trung hạn
- Observability: metrics có cấu trúc và các endpoint health/readiness.
- Tính bền vững cho hàng đợi bền (visibility timeout, xử lý poison-message).
- Cân bằng tính năng OA rộng hơn với tài khoản cá nhân (reaction, thu hồi tin khi được hỗ trợ).

## Dài hạn
- Cải thiện quản lý đa tài khoản trong admin dashboard.
- Kiểm soát vòng đời media (chính sách lưu giữ, storage backend).

## Nợ kỹ thuật kiểm thử (bị cách ly)

Các test này đã bị lạc hậu so với `src` và bị loại khỏi bộ test đã commit. Khôi phục chúng khi code phía dưới được điều chỉnh:
- `test/worker/worker.test.ts` — "invokes onPermanentFailure when a job dead-letters" (skipped).
- `test/handlers/outbound.test.ts` — "archives the file and sends the customer a download link when Zalo rejects it" (skipped).
- `test/handlers/outbound.test.ts` — "falls back to the agent note when the customer link message also fails" (skipped).
- `test/handlers/outboundNotes.test.ts` — references a removed `src/handlers/outboundNotes` module (kept local, not committed).
- `test/zalo-oa/sender.test.ts` — requires `sharp`, which `src` does not use (kept local, not committed).
- `test/zalo-oa/imageCompress.test.ts` — requires `sharp`, which `src` does not use (kept local, not committed).

## Cách sử dụng Codex

Xem phần "How Codex will be used" trong [README](README.md).
