🇬🇧 English: [CONTRIBUTING.md](CONTRIBUTING.md)

# Đóng góp cho zca-bridge

Cảm ơn bạn đã quan tâm đến việc cải thiện zca-bridge. Dự án ưu tiên thay đổi nhỏ, rõ phạm vi và có
kiểm chứng.

## Yêu cầu

- Node.js 24+
- npm dùng theo `package-lock.json`
- PostgreSQL riêng nếu chạy hoặc test repository thật
- Docker nếu muốn chạy compose/container

## Cài đặt local

```bash
npm ci
cp .env.example .env
npm run build
npm test
```

Sau khi copy `.env`, điền tối thiểu `DATABASE_URL`, `CHATWOOT_BASE_URL`, `CREDENTIALS_KEY` và
`PUBLIC_BASE_URL`. Tạo `CREDENTIALS_KEY` bằng:

```bash
openssl rand -hex 32
```

Không commit `.env` hoặc giá trị secret thật.

## Chạy phát triển

```bash
npm run dev
```

Bridge tự chạy migration khi khởi động. Có thể chạy migration thủ công bằng:

```bash
npm run migrate
```

## Kiểm thử

- Chạy toàn bộ suite bằng `npm test`.
- Một số test repository cần `TEST_DATABASE_URL`; nếu không có biến này, chúng được skip có chủ ý.
- Nếu các test liên quan `sharp` báo không load được module, chạy lại `npm ci` để cài native/optional
  dependency đúng nền tảng rồi chạy lại test.
- Thêm test cho hành vi mới. Ưu tiên unit test thuần, mock dependency ngoài khi hợp lý.

## Pull request

1. Tạo branch từ `main`.
2. Dùng Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `ci:`, `perf:`.
3. Chạy `npm run build` và `npm test` trước khi mở PR, hoặc ghi rõ lý do nếu chưa pass.
4. Giữ PR tập trung; mô tả vấn đề, cách sửa và phạm vi ảnh hưởng.
5. Không đưa token, secret, log chứa dữ liệu khách hàng hoặc screenshot nhạy cảm vào PR.

## Phong cách code

- TypeScript ESM, Node 24.
- Bám theo style quanh file đang sửa.
- Validate input tại ranh giới hệ thống và xử lý lỗi rõ ràng.
- Không nuốt lỗi im lặng; nếu lỗi được bỏ qua có chủ ý, ghi log hoặc comment ngắn.
- Với docs, giữ README mặc định bằng tiếng Việt và cập nhật bản tiếng Anh tương ứng khi nội dung thay đổi.
