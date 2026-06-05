🇬🇧 English: [CONTRIBUTING.md](CONTRIBUTING.md)

# Đóng góp cho zca-bridge

Cảm ơn bạn đã quan tâm đến việc cải thiện zca-bridge.

## Yêu cầu trước khi bắt đầu

- Node.js 24+
- Một instance PostgreSQL để chạy cục bộ (tách biệt khỏi DB của Chatwoot)
- Docker (tùy chọn, cho quy trình làm việc với container)

## Cài đặt

```bash
npm ci
cp .env.example .env   # fill in DATABASE_URL, CHATWOOT_BASE_URL, CREDENTIALS_KEY, PUBLIC_BASE_URL
npm run build
npm test
```

Chạy dev server bằng `npm run dev` (chế độ watch). Migration chạy tự động khi khởi động; bạn cũng có thể chạy thủ công bằng `npm run migrate`.

## Kiểm thử

- Chạy bộ kiểm thử bằng `npm test` (Vitest). Các test nằm trong `test/` phản chiếu cấu trúc `src/`.
- Thêm test cho các hành vi mới. Ưu tiên các unit test thuần túy, không phụ thuộc bên ngoài khi có thể; bộ test hiện tại mock `pg` thay vì kết nối database thật.
- Một số test đã bị cách ly do bị lạc hậu so với `src` — xem [ROADMAP.md](ROADMAP.md). Không bỏ skip chúng mà không giải quyết code phía dưới trước.

## Pull request

1. Tạo branch từ `main`.
2. Dùng [Conventional Commits](https://www.conventionalcommits.org/) cho commit message (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `ci:`, `perf:`).
3. Đảm bảo `npm run build` và `npm test` đều pass trước khi mở PR (CI sẽ kiểm tra điều này).
4. Giữ các thay đổi tập trung; mô tả rõ cái gì và tại sao trong phần mô tả PR.

## Phong cách code

- TypeScript (ESM), Node 24. Giữ các file nhỏ và tập trung; ưu tiên cập nhật bất biến (immutable updates).
- Tuân theo các quy ước của code xung quanh. Kiểm tra đầu vào tại các ranh giới hệ thống và xử lý lỗi rõ ràng — không bao giờ bỏ qua lỗi một cách thầm lặng.
