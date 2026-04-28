<div align="center">
  <h1>ScaleNode Development Guide</h1>
  <sub>April, 2026</sub>
</div>

## Table of Contents

- [1. Project Overview](#1-project-overview)
- [2. Technology Stack](#2-technology-stack)
- [3. Prerequisites](#3-prerequisites)
- [4. Project Structure](#4-project-structure)
- [5. Technical Implementation Steps](#5-technical-implementation-steps)
  - [5.1. Phase 1: Database Replication Setup](#51-phase-1-database-replication-setup)

---

# 1. Project Overview

**ScaleNode** là một đồ án hệ thống backend có khả năng mở rộng (Scalable Backend System) nhằm mục đích thực hành các kỹ thuật hạ tầng nâng cao. Mục tiêu trọng tâm của dự án là xây dựng một môi trường có khả năng **_điều phối lưu lượng truy cập (Load Balancing)_** và đảm bảo tính toàn vẹn cũng như hiệu suất dữ liệu thông qua cơ chế **_phân tách đọc/ghi (Read/Write Splitting) trên cụm cơ sở dữ liệu nhân bản (Replication)_**.

Dự án này giúp người thực hiện làm quen với việc:

- Phân phối tải giữa nhiều thực thể ứng dụng.
- Thiết lập cơ chế Master-Slave cho Database.
- Xử lý logic ứng dụng để tự động chuyển đổi kết nối giữa các node DB tùy theo loại truy vấn.

---

# 2. Technology Stack

Để đạt được mục tiêu **Advanced Implementation (2.0 points)**, ScaleNode sử dụng các công nghệ sau:

| Layer             | Technology               | Description                                               |
| :---------------- | :----------------------- | :-------------------------------------------------------- |
| **Load Balancer** | **Nginx**                | Reverse Proxy cấu hình Round Robin, hỗ trợ Health Check.  |
| **Application**   | **Node.js (Express)**    | API xử lý logic, đóng gói dưới dạng Docker Containers.    |
| **Database**      | **PostgreSQL (Bitnami)** | Cấu hình Master-Slave (Streaming Replication).            |
| **Orchestration** | **Docker Compose**       | Quản lý toàn bộ hạ tầng trong một file cấu hình duy nhất. |

---

# 3. Prerequisites

Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt các công cụ sau:

- **Docker & Docker Compose**: Để chạy các container hạ tầng.
- **Node.js (v18+)**: Để phát triển và kiểm thử API cục bộ.
- **Postman / cURL**: Để thực hiện các yêu cầu (requests) kiểm thử hệ thống.
- **Git**: Để quản lý mã nguồn.

---

# 4. Project Structure

Tổ chức thư mục cho ScaleNode:

```text
ScaleNode/
├── server/
│   ├── src/                # Mã nguồn Express.js
│   │   ├── config/         # Cấu hình kết nối DB (Pool Master/Slave)
│   │   ├── controllers/    # Điều hướng yêu cầu, nhận input và trả về response
│   │   ├── services/       # Xử lý logic nghiệp vụ (Business Logic) chính và thực hiện truy vấn
│   │   ├── models/         # Định nghĩa **Schema**
│   │   ├── middlewares/    # Kiểm tra dữ liệu (Validation), xử lý lỗi (Error Handling)
│   │   ├── routes/         # Định nghĩa các tuyến đường API
│   │   └── app.js          # Khởi tạo Express và gắn kết các thành phần
│   ├── Dockerfile
│   ├── package.json
│   └── .env
├── nginx/
│   └── nginx.conf          # Cấu hình Load Balancer
├── docker-compose.yml      # File điều phối toàn bộ hệ thống
├── docs/                   # Tài liệu hướng dẫn và sơ đồ
└── README.md
```

---

# 5. Technical Implementation Steps

## 📝 5.1. Phase 1: Database Replication Setup

Phase này tập trung vào việc thiết lập hạ tầng lưu trữ bền vững với `PostgreSQL`. Chúng ta sử dụng `Docker Compose` để quản lý các biến môi trường và mạng nội bộ giúp hai node DB giao tiếp với nhau theo cơ chế **_Streaming Replication_**.

### 🔹 Step 1: Khởi tạo tệp cấu hình hạ tầng `docker-compose.yml`

Tạo file `docker-compose.yml` tại thư mục gốc của dự án. File này sẽ định nghĩa cách các node DB được khởi tạo và kết nối với nhau.

```yaml
version: "3.8"

services:
  # --- Master Database Node ---
  pg-master:
    image: bitnami/postgresql:latest
    container_name: scnode-db-master
    environment:
      - POSTGRESQL_REPLICATION_MODE=master
      - POSTGRESQL_REPLICATION_USER=repl_user
      - POSTGRESQL_REPLICATION_PASSWORD=repl_password
      - POSTGRESQL_USERNAME=myuser
      - POSTGRESQL_PASSWORD=mypassword
      - POSTGRESQL_DATABASE=scnode_db
    ports:
      - "5432:5432"
    volumes:
      - ./pg_master_data:/bitnami/postgresql

  # --- Slave Database Node (Read Replica) ---
  pg-slave:
    image: bitnami/postgresql:latest
    container_name: scnode-db-slave
    depends_on:
      - pg-master
    environment:
      - POSTGRESQL_REPLICATION_MODE=slave
      - POSTGRESQL_MASTER_HOST=pg-master
      - POSTGRESQL_MASTER_PORT_NUMBER=5432
      - POSTGRESQL_REPLICATION_USER=repl_user
      - POSTGRESQL_REPLICATION_PASSWORD=repl_password
      - POSTGRESQL_PASSWORD=mypassword
    ports:
      - "5433:5432"
    volumes:
      - ./pg_slave_data:/bitnami/postgresql
```

### 🔹 Step 2: Giải thích cấu hình thành phần

Việc hiểu rõ các **Environment Variables** là chìa khóa để thiết lập cụm **Master-Slave** thành công:

- **Node Master (`pg-master`):**
  - `POSTGRESQL_REPLICATION_MODE=master`: Thiết lập node đóng vai trò **gốc** (Primary).
  - `POSTGRESQL_REPLICATION_USER`: Tạo User dành riêng cho việc **đồng bộ dữ liệu**.
  - `POSTGRESQL_DATABASE`: Khởi tạo sẵn **Database tên `scnode_db`** ngay khi chạy.
- **Node Slave (`pg-slave`):**
  - `POSTGRESQL_REPLICATION_MODE=slave`: Thiết lập node đóng vai trò **bản sao** (Read-only).
  - `POSTGRESQL_MASTER_HOST=pg-master`: Chỉ định **địa chỉ của Master** để Slave kết nối tới.
  - **Port Mapping (`5433:5432`)**: Ánh xạ cổng của Slave ra **5433** để tránh xung đột với Master (5432) khi thao tác trên máy Host.

---

### 🔹 Step 3: Triển khai và Kiểm tra Logs

1.  **Khởi động hệ thống:**
    - Dùng lệnh: `docker-compose up -d`
2.  **Kiểm tra trạng thái kết nối:**
    - Xem log của Slave: `docker logs -f scnode-db-slave`
    - **Keyword thành công**: Tìm dòng `streaming replication successfully connected to primary`.

---

### 🔹 Step 4: Kiểm tra đồng bộ thủ công (Manual Verification)

Thực hiện các lệnh sau để đảm bảo dữ liệu được **nhân bản** chính xác:

- **Tại Master Node:** Tạo bảng và chèn dữ liệu mẫu.
  - `docker exec -e PGPASSWORD=mypassword -it scnode-db-master psql -U myuser -d scnode_db -c "CREATE TABLE products (id SERIAL PRIMARY KEY, name TEXT, price INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"`
  - `docker exec -e PGPASSWORD=mypassword -it scnode-db-master psql -U myuser -d scnode_db -c "INSERT INTO products (name, price) VALUES ('Macbook Pro', 2500);"`
- **Tại Slave Node:** Truy vấn để kiểm tra.
  - `docker exec -e PGPASSWORD=mypassword -it scnode-db-slave psql -U myuser -d scnode_db -c "SELECT * FROM products;"`
  - **Kết quả**: Nếu thấy dòng `Macbook Pro | 2500` xuất hiện tức là **Replication hoàn tất**.

---

### ✅ Phase 1 Verification Checklist

Dùng danh sách này để chốt lại kết quả của **Phase 1**:

| Hạng mục       | Chỉ số kiểm tra (Expectation)                                                | Trạng thái |
| :------------- | :--------------------------------------------------------------------------- | :--------: |
| **Hạ tầng**    | Cả 2 Container `scnode-db-master` và `scnode-db-slave` đều đang **Running**. |    [x]     |
| **Kết nối**    | Slave log không có lỗi **Connection refused**.                               |    [x]     |
| **Đồng bộ**    | Dữ liệu tạo ở cổng **5432** xuất hiện ở cổng **5433**.                       |    [x]     |
| **Phân quyền** | Thử `INSERT` vào Slave (cổng 5433) phải bị **từ chối** (Read-only).          |    [x]     |
| **Bền vững**   | Chạy `docker-compose down` rồi `up` lại, dữ liệu **không bị mất**.           |    [x]     |

---

## 📝 5.2. Phase 2: API Development - Architecture & Environment Configuration

Mục tiêu của Phase 2 là chuẩn hóa cấu hình môi trường, tổ chức luồng xử lý dữ liệu theo kiến trúc phân tầng, và đảm bảo **Read/Write Splitting** hoạt động ổn định.

### 🔹 Step 1: Hệ thống Biến môi trường (.env)

- **NODE_NAME (Server Identity)**: Tên định danh cho từng API node. Giá trị này được đính vào response meta dưới khóa **processed_by**, giúp quan sát trực tiếp request đang được xử lý bởi node nào. Đây là **chìa khóa để kiểm chứng Load Balancing** ở Phase 3 khi thấy request luân phiên qua các node.
- **DB*MASTER*\*** (Write Node): Nhóm biến mô tả **Master Database** dùng cho các thao tác ghi. Bao gồm **host, port, user, password, database** để khởi tạo `writePool`.
- **DB*SLAVE*\*** (Read Replica): Nhóm biến mô tả **Slave Database** dùng cho các thao tác đọc. Bao gồm **host, port, user, password, database** để khởi tạo `readPool`.
- **Docker Service Name thay vì localhost**:
  - **localhost trong container** sẽ trỏ về chính container đó, không phải DB container khác.
  - **Service Name** (ví dụ `pg-master`, `pg-slave`) dùng cơ chế **Docker DNS** để kết nối đúng container trong cùng network.
  - **Port nội bộ** vẫn là **5432**; việc map ra host chỉ phục vụ truy cập từ bên ngoài, không dùng cho giao tiếp nội bộ giữa containers.

### 🔹 Step 2: Luồng xử lý dữ liệu (Route → Middleware → Controller → Service)

- 🌐 **Route**: Điểm vào của request. Chỉ làm nhiệm vụ định tuyến và gắn middleware phù hợp (ví dụ route `/api/products`).
- 🛡️ **Middleware**:
  - **Validation**: Chặn dữ liệu bẩn ngay từ đầu (name phải là string, price > 0). Mục tiêu là bảo vệ lớp Service khỏi input sai.
  - **Response Wrapper**: Chuẩn hóa cấu trúc response bằng các helper `res.ok`, `res.created`, `res.error`, `res.notFound`. Wrapper tự động gắn **meta** gồm **processed_by**, **db_source**, **timestamp**.
  - **Error Handling**: `notFoundHandler` và `errorHandler` đặt cuối pipeline để gom lỗi và trả về một format thống nhất.
- 🧭 **Controller**:
  - Điều phối request, không xử lý nghiệp vụ.
  - Gán **db_source** vào `res.locals` (Master hoặc Slave) để response meta phản ánh đúng nguồn DB.
  - Gọi Service và trả response qua helper.
- ⚙️ **Service**:
  - **Đầu não của Read/Write Splitting**.
  - Các thao tác **Ghi** (POST/PUT/DELETE) dùng `writePool` → Master.
  - Các thao tác **Đọc** (GET) dùng `readPool` → Slave.
  - Đảm bảo logic nghiệp vụ tập trung, dễ kiểm soát và mở rộng.

### 🔹 Step 3: Cấu trúc Schema (Models)

- 📚 **models/** là nơi mô tả cấu trúc dữ liệu chuẩn cho bảng **products**.
- **Schema tập trung** giúp Service và DB logic thống nhất: cột, kiểu dữ liệu, ràng buộc.
- Đây là **nguồn tham chiếu duy nhất** khi cần mở rộng hoặc kiểm soát phiên bản cấu trúc bảng.

### 🔹 Step 4: Container Infrastructure & Orchestration

Thêm vào file `docker-compose.yml` để tích hợp thêm việc khởi tạo chạy một **_API instance_** và **_Networking_**.

````yaml
```yaml
version: "3.8"

services:
  # --- API Node ---
  api-service:
    build:
      context: ./server           # Trỏ đến thư mục chứa mã nguồn API
      dockerfile: Dockerfile      # Tên file Dockerfile bên trong thư mục đó
    container_name: scnode-api-01
    env_file: ./server/.env       # Sử dụng file .env nằm trong thư mục api
    ports:
      - "3000:3000"
    depends_on:
      - pg-master
      - pg-slave
    networks:
      - scnode-network

  # --- Master Database Node ---
  pg-master:
    image: bitnami/postgresql:latest
    container_name: scnode-db-master
    # ... (giữ nguyên cấu hình cũ)
    networks:
      - scnode-network

  # --- Slave Database Node ---
  pg-slave:
    image: bitnami/postgresql:latest
    container_name: scnode-db-slave
    # ... (giữ nguyên cấu hình cũ)
    networks:
      - scnode-network

networks:
  scnode-network:
    driver: bridge
````

- 🏗️ **Build & Image cho API**:
  - **context: ./server** xác định thư mục gốc để Docker thu thập source code và dependencies.
  - **dockerfile: Dockerfile** chỉ rõ file build dùng cho API, giúp quy trình build nhất quán giữa máy dev và môi trường chạy thật.
  - Việc **build image từ mã nguồn cục bộ** đảm bảo mỗi lần thay đổi code đều được đóng gói lại, tránh lệch phiên bản giữa runtime và source hiện tại.
- ⏳ **Dependencies (depends_on)**:
  - `depends_on` đảm bảo **API được khởi động sau** khi `pg-master` và `pg-slave` đã được tạo container.
  - Điều này giảm lỗi kết nối sớm (connection refused) trong giai đoạn boot.
  - Lưu ý: `depends_on` chỉ đảm bảo **thứ tự start**, không xác nhận DB đã sẵn sàng; vì vậy API vẫn cần cơ chế retry khi kết nối DB.
- 🧾 **env_file: ./server/.env**:
  - Tách biệt cấu hình khỏi Compose file giúp **dễ đọc, dễ bảo trì**.
  - Cho phép **dùng chung một bộ biến** cho nhiều node API mà không lặp cấu hình.
  - Hỗ trợ **quản lý bí mật** tốt hơn (không hard-code trực tiếp vào compose).
- 🔗 **Custom Bridge Network (scnode-network)**:
  - Network `scnode-network` với driver **bridge** tạo một **mạng nội bộ riêng** cho các service của hệ thống.
  - **Service Discovery**: API có thể gọi DB bằng **tên service** như `pg-master`, `pg-slave` thay vì IP tĩnh.
  - Giảm rủi ro đổi IP khi container restart và tăng tính ổn định kết nối.
- 🔌 **Port Mapping (Host vs Internal)**:
  - **Host Ports**: 3000 (API), 5432 (Master), 5433 (Slave) dùng để truy cập từ máy bên ngoài.
  - **Internal Ports**: các container DB vẫn giao tiếp qua **5432** trong mạng Docker.
  - API **không cần** biết host port; nó chỉ dùng tên service và port nội bộ khi kết nối DB.

### ✅ Phase 2 Verification Checklist

Dùng danh sách này để chốt lại kết quả của **Phase 2**:

| Hạng mục                    | Chỉ số kiểm tra (Expectation)                                           | Trạng thái |
| :-------------------------- | :---------------------------------------------------------------------- | :--------: |
| 🧠 **Connection Pools**     | Tách biệt rõ `writePool` và `readPool` trong cấu hình DB.               |    [x]     |
| 🔀 **Read/Write Splitting** | Service dùng **readPool** cho GET và **writePool** cho POST/PUT/DELETE. |    [x]     |
| 🛡️ **Middleware**           | Có **Validation** và **Response Wrapper** hoạt động trước Routes.       |    [x]     |
| 📦 **Response Format**      | Mọi response có đủ `success`, `message`, `data`, `meta`.                |    [x]     |
| 🧾 **Meta-data**            | `processed_by`, `db_source`, `timestamp` luôn có trong JSON.            |    [x]     |
| 🏗️ **Image Build**          | `api-service` build thành công từ `Dockerfile` qua Compose.             |    [x]     |
| 🔗 **Connectivity**         | API kết nối DB qua `scnode-network` bằng tên `pg-master`/`pg-slave`.    |    [x]     |
| 🧯 **Error Handling**       | Test 404/500 trả JSON thống nhất, server không crash.                   |    [x]     |
