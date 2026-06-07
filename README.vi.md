🇬🇧 English: [README.en.md](README.en.md)

# Zalo-Chatwoot Bridge

![Zalo-Chatwoot Bridge](zalo-chatwoot.png)

[![CI](https://github.com/diendh/zca-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/diendh/zca-bridge/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

`zca-bridge` là sidecar tự host để đồng bộ hội thoại [Zalo](https://zalo.me) hai chiều với
[Chatwoot](https://www.chatwoot.com). Bridge biến Zalo thành một inbox trong Chatwoot để nhân viên
có thể nhận, gửi, ghi chú và theo dõi lịch sử hội thoại ngay trong helpdesk.

Mặc định tài liệu chính dùng tiếng Việt. Bản tiếng Anh nằm ở [README.en.md](README.en.md).

## Tóm tắt

- **Kênh Zalo OA:** dùng API chính thức của Zalo, hỗ trợ OAuth, webhook, gửi/nhận tin, backfill và
  một số luồng xin thông tin khách hàng.
- **Kênh Zalo cá nhân:** dùng [`zca-js`](https://github.com/RFS-ADRENO/zca-js) và đăng nhập QR.
  Đây là API không chính thức, có rủi ro khóa hoặc cấm tài khoản.
- **Chatwoot:** bridge nhận webhook outbound từ Chatwoot và đẩy inbound message vào Chatwoot qua API.
- **Hàng đợi bền:** lưu job trong PostgreSQL, retry lỗi tạm thời và đưa lỗi vĩnh viễn vào dead-letter.
- **Media:** archive file đính kèm cục bộ; file lớn có thể gửi qua link `/media` có token.

Node 24+ · TypeScript ESM · Fastify · PostgreSQL · Vitest · Docker

> Dự án này độc lập, không thuộc sở hữu, không được tài trợ và không được xác nhận chính thức bởi
> Zalo, VNG, Chatwoot hoặc nhóm phát triển `zca-js`.

## Cảnh báo quan trọng

Tài khoản Zalo cá nhân được kết nối qua `zca-js`, một thư viện **không chính thức**. Dùng API không
chính thức có thể khiến tài khoản Zalo bị hạn chế, khóa hoặc cấm vĩnh viễn. Nên dùng tài khoản phụ,
không dùng tài khoản kinh doanh chính hoặc tài khoản có dữ liệu nhạy cảm.

Kênh **Zalo Official Account (OA)** dùng API chính thức của Zalo nên không thuộc nhóm rủi ro từ
`zca-js`. Xem thêm [SECURITY.vi.md](SECURITY.vi.md).

## Tính năng

- Nhắn tin hai chiều Zalo ↔ Chatwoot.
- Hỗ trợ text, ảnh, file, ghi âm, video, sticker, vị trí và fallback cho nội dung chưa nhận diện.
- Chống lặp/echo bằng `message_map`.
- Archive media bền và phục vụ file lớn qua link token hóa.
- Hỗ trợ quote/reply, reaction và thu hồi tin nhắn cho tài khoản cá nhân.
- Hỗ trợ Zalo OA OAuth, webhook, gửi ảnh/file, nén ảnh OA quá lớn trước khi upload, backfill khi khởi động.
- Admin dashboard tại `/admin/` để tạo tài khoản admin, cấu hình Chatwoot/OA, thêm inbox, quét QR và xem log.

## Kiến trúc

- **Inbound:** Zalo cá nhân (`zca-js`) hoặc Zalo OA webhook/backfill → phân loại message → PostgreSQL
  job queue → worker → Chatwoot Application/Platform API.
- **Outbound:** Chatwoot webhook → PostgreSQL job queue → worker → Zalo personal sender hoặc OA sender.
- **Media:** attachment được tải về archive cục bộ; nếu vượt giới hạn upload Chatwoot thì bridge gửi link
  `/media/:token`.
- **Settings:** cấu hình nhạy cảm trong admin UI được mã hóa bằng `CREDENTIALS_KEY`.

### Module chính

- `src/zalo` — adapter Zalo cá nhân, phân loại message, session, đăng nhập QR.
- `src/zalo-oa` — OA OAuth, webhook, sender, backfill, verify chữ ký, nén ảnh.
- `src/chatwoot` — client, Application API, webhook server, tạo inbox.
- `src/handlers` — orchestration inbound/outbound, note lỗi, đồng bộ contact info.
- `src/worker` và `src/store` — queue bền, repository, migration.
- `src/admin` — admin API, đăng nhập, settings, webhook info, log dashboard.
- `src/media` — archive và link media token hóa.

## Yêu cầu

- Chatwoot đang chạy sẵn. Dự án này **không đóng gói hoặc phân phối Chatwoot**.
- PostgreSQL riêng cho bridge, tách khỏi database của Chatwoot.
- Node.js 24+ nếu chạy trực tiếp, hoặc Docker nếu chạy container.
- `PUBLIC_BASE_URL` phải là URL bridge có thể truy cập từ bên ngoài khi dùng webhook/OA/iframe.

## Cấu hình nhanh

Copy `.env.example` thành `.env` rồi điền giá trị thật:

```bash
cp .env.example .env
```

Các biến tối thiểu:

- `DATABASE_URL` — PostgreSQL riêng của bridge.
- `CHATWOOT_BASE_URL` — URL Chatwoot mà bridge truy cập được.
- `CREDENTIALS_KEY` — khóa hex 32 byte để mã hóa secret, tạo bằng `openssl rand -hex 32`.
- `PUBLIC_BASE_URL` — URL public của bridge, ví dụ `https://bridge.example.com`.

Biến nên cấu hình thêm:

- `CHATWOOT_API_ACCESS_TOKEN` và `CHATWOOT_ACCOUNT_ID` — cần cho tạo inbox tự động, import tin tự gửi
  từ app Zalo và ghi private note khi outbound fail vĩnh viễn.
- `WEBHOOK_SECRET` — thêm secret vào URL webhook Chatwoot.
- `MEDIA_ARCHIVE_ROOT`, `MEDIA_TOKEN_TTL_DAYS`, `CHATWOOT_MAX_ATTACHMENT_MB` — kiểm soát lưu trữ media.
- `ZALO_OA_APP_ID`, `ZALO_OA_APP_SECRET`, `ZALO_OA_SECRET_KEY`, `ZALO_OA_OAUTH_REDIRECT` — chỉ cần khi dùng OA.

Không commit `.env`, token thật, app secret, session Zalo hoặc database dump.

## Chạy bằng Docker

### Dùng image dựng sẵn

Tải `docker-compose.full.yml`, chuẩn bị `.env`, rồi chạy:

```bash
cp .env.example .env
docker compose -f docker-compose.full.yml up -d
```

Bridge chạy ở `http://localhost:4000`. File compose này chạy kèm PostgreSQL riêng cho bridge và pull
image `ghcr.io/diendh/zca-bridge:latest`.

### Build từ source

```bash
cp .env.example .env
docker compose -f docker-compose.example.yml up -d --build
```

File compose mẫu chỉ chạy bridge và PostgreSQL của bridge. Bạn vẫn cần Chatwoot riêng và trỏ
`CHATWOOT_BASE_URL` tới Chatwoot đó.

### Container đơn

```bash
docker run --env-file .env -p 4000:4000 ghcr.io/diendh/zca-bridge:latest
```

Khi chạy container đơn, `DATABASE_URL` và `CHATWOOT_BASE_URL` phải trỏ tới dịch vụ truy cập được từ
container.

## Chạy trực tiếp

```bash
npm ci
npm run build
npm start
```

Migration tự chạy khi khởi động. Bridge lắng nghe trên `$PORT`, mặc định là `4000`.

Chạy dev mode:

```bash
npm run dev
```

## Thiết lập sau khi chạy

1. Mở `PUBLIC_BASE_URL/admin/` hoặc `http://localhost:4000/admin/`.
2. Tạo tài khoản admin lần đầu. Mật khẩu tối thiểu 8 ký tự.
3. Vào phần Settings để kiểm tra `CHATWOOT_BASE_URL`, Chatwoot account id/token và cấu hình OA nếu dùng.
4. Tạo tài khoản bridge:
   - Với Zalo cá nhân: thêm account, tạo hoặc gắn Chatwoot inbox, bấm đăng nhập và quét QR.
   - Với Zalo OA: thêm OA account, bấm kết nối OA và hoàn tất OAuth.
5. Copy webhook URL trong admin dashboard:
   - Chatwoot webhook: dùng cho inbox Chatwoot tương ứng.
   - Zalo OA webhook: dùng trong Zalo developer console nếu bật OA.
6. Gửi thử một tin inbound và một tin outbound để kiểm tra mapping và chống echo.

## Kiểm thử

```bash
npm test
```

Bộ test dùng Vitest. Nếu test liên quan `sharp` báo không load được module, chạy lại `npm ci` để cài
dependency native/optional đúng nền tảng rồi chạy test lại.

Một số test repository cần `TEST_DATABASE_URL`; khi biến này không có, các test đó được skip có chủ ý.
Xem [ROADMAP.vi.md](ROADMAP.vi.md) để biết nợ kỹ thuật hiện tại.

## Bảo mật và kiểm tra lộ thông tin

- Không đưa secret thật vào README, issue, PR, log hoặc screenshot.
- `CREDENTIALS_KEY` phải là 64 ký tự hex và được giữ riêng theo môi trường.
- Admin UI dùng tài khoản admin tạo lần đầu và cookie phiên ký bằng secret dẫn xuất từ `CREDENTIALS_KEY`.
- Dùng HTTPS cho `PUBLIC_BASE_URL`, đặc biệt khi expose `/admin/`, `/webhooks/*` và `/media/*`.
- Dùng `WEBHOOK_SECRET` cho Chatwoot webhook và `ZALO_OA_SECRET_KEY` để xác thực webhook OA.
- Trước khi commit tài liệu, nên scan bằng `rg` hoặc secret scanner để đảm bảo chỉ có placeholder/tên biến.

## Tài liệu liên quan

- [SECURITY.vi.md](SECURITY.vi.md) — chính sách bảo mật và vận hành an toàn.
- [CONTRIBUTING.vi.md](CONTRIBUTING.vi.md) — hướng dẫn đóng góp.
- [ROADMAP.vi.md](ROADMAP.vi.md) — lộ trình và nợ kỹ thuật hiện tại.
- [CHANGELOG.md](CHANGELOG.md) — lịch sử phát hành.

## Bên thứ ba

Dự án tích hợp với [Chatwoot](https://www.chatwoot.com), [Zalo](https://zalo.me) và
[`zca-js`](https://github.com/RFS-ADRENO/zca-js). Tất cả tên thương hiệu, logo, nhãn hiệu và tên sản
phẩm thuộc về chủ sở hữu tương ứng; việc nhắc đến chỉ để mô tả tích hợp kỹ thuật.

## Giấy phép

Copyright 2026 Tom.

Phát hành theo [Apache License 2.0](LICENSE).
