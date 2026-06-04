# zca-bridge

Cầu nối (sidecar) tự host, đồng bộ hội thoại [Zalo](https://zalo.me) hai chiều với
[Chatwoot](https://www.chatwoot.com). Hỗ trợ cả tài khoản Zalo cá nhân (qua `zca-js`, đăng nhập bằng
QR) lẫn Official Account (OA, dùng REST API), hiển thị tin nhắn như một inbox trong Chatwoot — gửi và
nhận đều được.

Node 20 · TypeScript (ESM) · Fastify · PostgreSQL.

## Tính năng

- Nhắn tin hai chiều Zalo ↔ Chatwoot (text, ảnh, file, ghi âm, video, sticker, vị trí…).
- Hàng đợi bền (lưu trước rồi mới xử lý) có retry + dead-letter, nên tin không mất khi restart.
- Chống lặp/echo hai chiều bằng `message_map`.
- Lưu trữ media bền (mọi file đính kèm được backup cục bộ; file quá lớn phục vụ qua link có token).
- Trả lời trích dẫn (quote/reply), thả cảm xúc (reaction), thu hồi tin cho tài khoản cá nhân; OA hỗ
  trợ trả lời trích dẫn dạng text.

## Yêu cầu

- **Tự chuẩn bị Chatwoot** — dự án này KHÔNG kèm và không phân phối Chatwoot. Bạn trỏ bridge tới
  Chatwoot có sẵn của mình.
- Một PostgreSQL riêng cho bridge (tách khỏi DB của Chatwoot). Bridge tự chạy migration khi khởi động.
- Node 20+ (hoặc Docker).

## Cấu hình

Copy `.env.example` thành `.env` rồi điền giá trị (mỗi biến đều có chú thích ngay trong
`.env.example`). Tối thiểu cần: `DATABASE_URL`, `CHATWOOT_BASE_URL`, `CREDENTIALS_KEY`,
`PUBLIC_BASE_URL`.

## Chạy

### Docker Compose (khuyến nghị)

```bash
cp .env.example .env   # rồi sửa .env
docker compose -f docker-compose.example.yml up -d --build
```

File compose mẫu khởi động bridge và Postgres của nó. Đặt `CHATWOOT_BASE_URL` trong `.env` trỏ tới
Chatwoot của bạn.

### Chạy trực tiếp

```bash
npm ci
npm run build
npm start          # tự chạy migration khi khởi động, rồi lắng nghe trên $PORT (mặc định 4000)
```

## Kiểm thử

```bash
npx vitest run
```

## Giấy phép

Copyright 2026 Tom. Phát hành theo [Apache License 2.0](LICENSE).
