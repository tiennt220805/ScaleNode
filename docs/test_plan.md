# ScaleNode Test Plan & Verification Checklist

Tài liệu này cung cấp lộ trình kiểm thử hệ thống nhằm xác minh các tính năng cốt lõi: **Load Balancing**, **Read/Write Splitting**, và **Fault Tolerance**. Thực hiện theo các bước dưới đây để kiểm chứng chất lượng đồ án.

---

## 1. Infrastructure Readiness (Kiểm tra hạ tầng)

Đảm bảo môi trường khởi động đúng trình tự và các dịch vụ đã sẵn sàng kết nối.

- [x] **Thao tác**: Chạy lệnh `docker ps`.
  - **Ý nghĩa**: Xác nhận trạng thái của các Container.
  - **Kết quả**: Đủ **5 container** (`nginx`, `api-01`, `api-02`, `db-master`, `db-slave`) đang ở trạng thái **Up (healthy)**.
- [x] **Thao tác**: Kiểm tra log API qua `docker logs scnode-api-01`.
  - **Ý nghĩa**: Kiểm tra khả năng **Health Check** chủ động của hệ thống.
  - **Kết quả**: API không bị crash lúc khởi động, log hiển thị đã kết nối thành công tới **Write Pool** và **Read Pool**.

---

## 2. Database Replication (Kiểm tra nhân bản dữ liệu)

Xác minh cơ chế **Streaming Replication** giữa Master và Slave hoạt động ổn định.

- [x] **Thao tác**: Gửi request **POST** tạo sản phẩm mới, sau đó truy vấn trực tiếp vào Container **Slave**.
  - **Ý nghĩa**: Kiểm tra dữ liệu có được đồng bộ tức thì hay không.
  - **Kết quả**: Sản phẩm tạo từ Master phải xuất hiện ngay trong bảng của **Slave** với độ trễ gần như bằng 0.

---

## 3. Load Balancing (Kiểm tra cân bằng tải)

Xác minh **Nginx** điều phối lưu lượng truy cập đồng đều giữa các Instance.

- [x] **Thao tác**: Gửi liên tiếp 10 request `GET /api/products` qua cổng 80.
  - **Ý nghĩa**: Kiểm chứng thuật toán **Round Robin**.
  - **Kết quả**: Giá trị `meta.processed_by` trong kết quả trả về phải **thay đổi luân phiên** giữa `ScaleNode-API-01` và `ScaleNode-API-02`.

---

## 4. Read/Write Splitting (Kiểm tra phân tách Đọc/Ghi)

Xác minh logic ứng dụng tự động định tuyến yêu cầu đến đúng Node Database.

- [x] **Thao tác**: Gửi request **POST** để tạo sản phẩm.
  - **Ý nghĩa**: Kiểm tra dữ liệu được ghi vào đâu.
  - **Kết quả**: Response trả về phải có `meta.db_source: "Master"`.
- [x] **Thao tác**: Gửi request **GET** để lấy danh sách sản phẩm.
  - **Ý nghĩa**: Kiểm tra dữ liệu được đọc từ đâu để giảm tải cho Master.
  - **Kết quả**: Response trả về phải có `meta.db_source: "Slave"`.

---

## 5. Chaos Test & High Availability (Kiểm tra chịu lỗi)

Chứng minh hệ thống vẫn hoạt động bình thường ngay cả khi một phần hạ tầng gặp sự cố.

- [x] **Thao tác**: Chạy lệnh `docker stop scnode-api-01` và thực hiện gọi API.
  - **Ý nghĩa**: Kiểm tra cơ chế **Failover** của Load Balancer.
  - **Kết quả**: Request vẫn thành công. Nginx tự động chuyển toàn bộ tải sang **Node 02** mà không gây lỗi cho người dùng.
- [x] **Thao tác**: Chạy lệnh `docker start scnode-api-01` và đợi sau 30 giây.
  - **Ý nghĩa**: Kiểm tra khả năng tự phục hồi (**Auto-Recovery**).
  - **Kết quả**: Nginx tự động đưa Node 01 quay trở lại danh sách điều phối tải.

---

## Báo cáo tổng kết kiểm thử

- **Hạ tầng sẵn sàng**: [x] Pass | [ ] Fail
- **Đồng bộ dữ liệu**: [x] Pass | [ ] Fail
- **Điều phối tải**: [x] Pass | [ ] Fail
- **Chịu lỗi hệ thống**: [x] Pass | [ ] Fail

> **Ghi chú**: Nếu tất cả các mục trên đều được đánh dấu **[x]**, hệ thống đã đạt tiêu chuẩn **Scalable & Highly Available**.
