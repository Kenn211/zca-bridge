# Zalo-Chatwoot Bridge

![Zalo-Chatwoot Bridge](zalo-chatwoot.png)

Cầu nối sidecar tự host, giúp đồng bộ hội thoại [Zalo](https://zalo.me) hai chiều với
[Chatwoot](https://www.chatwoot.com). Dự án này cho phép hiển thị và xử lý tin nhắn Zalo như một
inbox trong Chatwoot — có thể nhận và gửi tin nhắn từ cùng một giao diện.

Dự án hỗ trợ hai hướng tích hợp:

* **Zalo Official Account (OA)**: sử dụng API chính thức của Zalo.
* **Tài khoản Zalo cá nhân**: sử dụng [`zca-js`](https://github.com/RFS-ADRENO/zca-js), đăng nhập bằng QR. Đây là thư viện không chính thức và có rủi ro riêng.

Tên package/kỹ thuật: `zca-bridge`.

Node 20 · TypeScript (ESM) · Fastify · PostgreSQL.

> Đây là dự án độc lập, không thuộc sở hữu, không được tài trợ và không được xác nhận chính thức bởi Zalo, VNG, Chatwoot hoặc nhóm phát triển `zca-js`.

## ⚠️ Cảnh báo rủi ro

Kênh **tài khoản Zalo cá nhân** hoạt động thông qua [`zca-js`](https://github.com/RFS-ADRENO/zca-js),
một thư viện không chính thức. Việc sử dụng API không chính thức có thể khiến tài khoản Zalo bị hạn chế,
khóa hoặc cấm vĩnh viễn.

Hãy cân nhắc kỹ trước khi sử dụng. Nên dùng tài khoản phụ hoặc tài khoản thử nghiệm, không nên dùng
tài khoản quan trọng, tài khoản kinh doanh chính hoặc tài khoản có dữ liệu nhạy cảm.

Dự án này không đảm bảo an toàn tài khoản và không chịu trách nhiệm cho bất kỳ sự cố nào phát sinh
khi sử dụng kênh tài khoản cá nhân.

> Using unofficial APIs may get your account restricted, locked, or permanently banned. Use it at your own risk.

Riêng kênh **Zalo Official Account (OA)** sử dụng API chính thức của Zalo nên không thuộc nhóm rủi ro
từ `zca-js`.

## Tính năng

* Nhắn tin hai chiều Zalo ↔ Chatwoot.
* Hỗ trợ text, ảnh, file, ghi âm, video, sticker, vị trí…
* Hàng đợi bền: lưu trước rồi mới xử lý, có retry và dead-letter.
* Chống lặp/echo hai chiều bằng `message_map`.
* Lưu trữ media bền: mọi file đính kèm được backup cục bộ; file lớn có thể phục vụ qua link có token.
* Hỗ trợ trả lời trích dẫn, reaction và thu hồi tin nhắn cho tài khoản cá nhân.
* OA hỗ trợ trả lời trích dẫn dạng text.

## Yêu cầu

* Bạn cần tự chuẩn bị một hệ thống Chatwoot đang hoạt động.
* Dự án này **không kèm theo và không phân phối Chatwoot**.
* Cần một PostgreSQL riêng cho bridge, tách khỏi database của Chatwoot.
* Bridge tự chạy migration khi khởi động.
* Node 20+ hoặc Docker.

## Cấu hình

Copy `.env.example` thành `.env` rồi điền giá trị cần thiết. Mỗi biến đều có chú thích trong
`.env.example`.

Tối thiểu cần cấu hình:

* `DATABASE_URL`
* `CHATWOOT_BASE_URL`
* `CREDENTIALS_KEY`
* `PUBLIC_BASE_URL`

Ví dụ:

```bash
cp .env.example .env
```

Sau đó sửa file `.env` theo môi trường của bạn.

## Chạy

### Docker Compose

Khuyến nghị dùng Docker Compose:

```bash
cp .env.example .env
docker compose -f docker-compose.example.yml up -d --build
```

File compose mẫu sẽ khởi động bridge và PostgreSQL riêng cho bridge. Biến `CHATWOOT_BASE_URL` cần trỏ
tới Chatwoot có sẵn của bạn.

### Chạy trực tiếp

```bash
npm ci
npm run build
npm start
```

Bridge sẽ tự chạy migration khi khởi động và lắng nghe trên `$PORT`, mặc định là `4000`.

## Kiểm thử

```bash
npx vitest run
```

## Ghi chú về bên thứ ba

Dự án này tích hợp hoặc phụ thuộc vào một số sản phẩm/dự án bên thứ ba:

* [Chatwoot](https://www.chatwoot.com)
* [Zalo](https://zalo.me)
* [`zca-js`](https://github.com/RFS-ADRENO/zca-js)

Tất cả tên thương hiệu, logo, nhãn hiệu và tên sản phẩm thuộc về chủ sở hữu tương ứng. Việc nhắc đến
các bên thứ ba trong README chỉ nhằm mục đích mô tả khả năng tích hợp kỹ thuật.

## Giấy phép

Copyright 2026 Tom.

Phát hành theo [Apache License 2.0](LICENSE).

Dự án này chỉ là bridge độc lập. Chatwoot, Zalo và `zca-js` thuộc về chủ sở hữu tương ứng của họ.
::: 
