🇬🇧 English: [README.md](README.md)

# Zalo-Chatwoot Bridge

![Zalo-Chatwoot Bridge](zalo-chatwoot.png)

Cầu nối (sidecar) tự host, đồng bộ hội thoại [Zalo](https://zalo.me) hai chiều với
[Chatwoot](https://www.chatwoot.com). Hỗ trợ cả tài khoản Zalo cá nhân (qua `zca-js`, đăng nhập bằng
QR) lẫn Official Account (OA, dùng REST API), hiển thị tin nhắn như một inbox trong Chatwoot — gửi và
nhận đều được. Tên package/kỹ thuật: `zca-bridge`.

Node 20 · TypeScript (ESM) · Fastify · PostgreSQL.

## Tại sao quan trọng

Đội ngũ chăm sóc khách hàng ở Việt Nam gắn liền với Zalo, nhưng Zalo không có tích hợp Chatwoot gốc,
nên nhân viên phải dùng app Zalo tách rời khỏi helpdesk của họ. Cầu nối này đưa Zalo vào Chatwoot như
một inbox bình thường, tự host nên dữ liệu hội thoại nằm trên hạ tầng do bạn kiểm soát.

## Tình huống sử dụng

- Đội hỗ trợ của SMB và agency muốn gom các kênh về Chatwoot.
- Đội đã dùng Chatwoot, muốn thêm Zalo mà không qua dịch vụ SaaS trung gian.
- Doanh nghiệp dùng Zalo OA, muốn cộng tác giữa nhân viên, ghi chú và lịch sử trong Chatwoot.
- Tự host để đáp ứng data residency và quyền riêng tư.

## ⚠️ Cảnh báo rủi ro

Tài khoản Zalo **cá nhân** được kết nối qua [`zca-js`](https://github.com/RFS-ADRENO/zca-js) — một
thư viện **không chính thức**. Dùng API không chính thức có thể khiến tài khoản Zalo bị **khóa hoặc
cấm vĩnh viễn**. Hãy cân nhắc kỹ và **tự chịu rủi ro** — nên dùng tài khoản phụ, không dùng cho tài
khoản quan trọng. Dự án này không đảm bảo và không chịu trách nhiệm nếu tài khoản gặp sự cố.

> Using this API could get your account locked or banned. We are not responsible for any issues that
> may happen. Use it at your own risk.

Riêng kênh **Official Account (OA)** dùng API chính thức của Zalo nên **không** thuộc rủi ro này. Xem
[SECURITY.vi.md](SECURITY.vi.md).

## Tính năng

- Nhắn tin hai chiều Zalo ↔ Chatwoot (text, ảnh, file, ghi âm, video, sticker, vị trí…).
- Hàng đợi bền (lưu trước rồi mới xử lý) có retry + dead-letter, nên tin không mất khi restart.
- Chống lặp/echo hai chiều bằng `message_map`.
- Lưu trữ media bền (mọi file đính kèm được backup cục bộ; file quá lớn phục vụ qua link có token).
- Trả lời trích dẫn (quote/reply), thả cảm xúc (reaction), thu hồi tin cho tài khoản cá nhân; OA hỗ
  trợ trả lời trích dẫn dạng text.

## Kiến trúc

Cầu nối luân chuyển tin nhắn theo hai luồng bền, cả hai đều dựa trên hàng đợi job trong PostgreSQL.

- **Inbound:** sự kiện Zalo cá nhân (qua adapter `zca-js`) và webhook OA → phân loại (classify) →
  hàng đợi job bền (PostgreSQL) → worker → Chatwoot Application/Platform API.
- **Outbound:** webhook Chatwoot → hàng đợi → worker → Zalo (personal sender / OA sender).
- `message_map` chống lặp echo giữa hai hệ thống; media được archive cục bộ và phục vụ qua link có
  token khi cần.

### Module map

- `src/zalo` — personal adapter, classify, session, QR login.
- `src/zalo-oa` — OA OAuth, webhook, sender, backfill.
- `src/chatwoot` — client, webhook server.
- `src/worker` + `src/store` — durable queue, repos, migrations.
- `src/handlers` — inbound/outbound orchestration.
- `src/admin` — admin API + dashboard.
- `src/media` — archive + tokenized serving.

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

### Image dựng sẵn (ghcr.io)

```bash
docker run --env-file .env -p 4000:4000 ghcr.io/diendh/zca-bridge:latest
```

Lưu ý: bạn vẫn cần một PostgreSQL và Chatwoot truy cập được. Hoặc, trong `docker-compose.example.yml`
thay `build: .` bằng `image: ghcr.io/diendh/zca-bridge:latest` để chạy image đã publish.

### Chạy trực tiếp

```bash
npm ci
npm run build
npm start          # tự chạy migration khi khởi động, rồi lắng nghe trên $PORT (mặc định 4000)
```

## Kiểm thử

```bash
npm test
```

Test chạy trên Vitest. Một vài test đang bị cách ly vì đã lệch khỏi `src`; xem [ROADMAP.vi.md](ROADMAP.vi.md).

## Lưu ý bảo mật

Thông tin đăng nhập được mã hóa khi lưu (`CREDENTIALS_KEY`, AES-256-GCM). Bảo vệ các endpoint admin và
webhook bằng `ADMIN_TOKEN` / `WEBHOOK_SECRET` / `ZALO_OA_SECRET_KEY`, và dùng một database riêng. Xem
[SECURITY.vi.md](SECURITY.vi.md).

## Lộ trình bảo trì

Xem [ROADMAP.vi.md](ROADMAP.vi.md).

## Cách Codex được sử dụng

Tôi sẽ dùng Codex để bảo trì zca-bridge hiệu quả hơn: review pull request, sinh test, cải thiện chất
lượng code TypeScript, refactor logic đồng bộ Zalo/Chatwoot, kiểm tra độ tin cậy của webhook và hàng
đợi, cải thiện việc triển khai Docker, viết tài liệu, phân loại issue, và review các khu vực nhạy cảm
về bảo mật như token, webhook, upload media, retry, và tích hợp API.

## Giấy phép

Copyright 2026 Tom. Phát hành theo [Apache License 2.0](LICENSE).
