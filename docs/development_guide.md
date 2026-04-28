<div align="center">
  <h1>ScaleNode Development Guide</h1>
  <medium>
    <strong>Author:</strong> Nguyễn Thành Tiến
  </medium> <br />
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

## 5.1. Phase 1: Database Replication Setup

Phase này tập trung vào việc thiết lập hạ tầng lưu trữ bền vững với `PostgreSQL`. Chúng ta sử dụng `Docker Compose` để quản lý các biến môi trường và mạng nội bộ giúp hai node DB giao tiếp với nhau theo cơ chế **_Streaming Replication_**.

### Step 1: Khởi tạo tệp cấu hình hạ tầng `docker-compose.yml`

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

### Step 2: Giải thích cấu hình thành phần

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

### Step 3: Triển khai và Kiểm tra Logs

1.  **Khởi động hệ thống:**
    - Dùng lệnh: `docker-compose up -d`
2.  **Kiểm tra trạng thái kết nối:**
    - Xem log của Slave: `docker logs -f scnode-db-slave`
    - **Keyword thành công**: Tìm dòng `streaming replication successfully connected to primary`.

---

### Step 4: Kiểm tra đồng bộ thủ công (Manual Verification)

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

## 5.2. Phase 2: API Development - Architecture & Environment Configuration

Mục tiêu của Phase 2 là chuẩn hóa cấu hình môi trường, tổ chức luồng xử lý dữ liệu theo kiến trúc phân tầng, và đảm bảo **Read/Write Splitting** hoạt động ổn định.

### Step 1: Hệ thống Biến môi trường (.env)

- **NODE_NAME (Server Identity)**: Tên định danh cho từng API node. Giá trị này được đính vào response meta dưới khóa **processed_by**, giúp quan sát trực tiếp request đang được xử lý bởi node nào. Đây là **chìa khóa để kiểm chứng Load Balancing** ở Phase 3 khi thấy request luân phiên qua các node.
- **DB*MASTER*\*** (Write Node): Nhóm biến mô tả **Master Database** dùng cho các thao tác ghi. Bao gồm **host, port, user, password, database** để khởi tạo `writePool`.
- **DB*SLAVE*\*** (Read Replica): Nhóm biến mô tả **Slave Database** dùng cho các thao tác đọc. Bao gồm **host, port, user, password, database** để khởi tạo `readPool`.
- **Docker Service Name thay vì localhost**:
  - **localhost trong container** sẽ trỏ về chính container đó, không phải DB container khác.
  - **Service Name** (ví dụ `pg-master`, `pg-slave`) dùng cơ chế **Docker DNS** để kết nối đúng container trong cùng network.
  - **Port nội bộ** vẫn là **5432**; việc map ra host chỉ phục vụ truy cập từ bên ngoài, không dùng cho giao tiếp nội bộ giữa containers.

### Step 2: Luồng xử lý dữ liệu (Route → Middleware → Controller → Service)

- **Route**: Điểm vào của request. Chỉ làm nhiệm vụ định tuyến và gắn middleware phù hợp (ví dụ route `/api/products`).
- **Middleware**:
  - **Validation**: Chặn dữ liệu bẩn ngay từ đầu (name phải là string, price > 0). Mục tiêu là bảo vệ lớp Service khỏi input sai.
  - **Response Wrapper**: Chuẩn hóa cấu trúc response bằng các helper `res.ok`, `res.created`, `res.error`, `res.notFound`. Wrapper tự động gắn **meta** gồm **processed_by**, **db_source**, **timestamp**.
  - **Error Handling**: `notFoundHandler` và `errorHandler` đặt cuối pipeline để gom lỗi và trả về một format thống nhất.
- **Controller**:
  - Điều phối request, không xử lý nghiệp vụ.
  - Gán **db_source** vào `res.locals` (Master hoặc Slave) để response meta phản ánh đúng nguồn DB.
  - Gọi Service và trả response qua helper.
- **Service**:
  - **Đầu não của Read/Write Splitting**.
  - Các thao tác **Ghi** (POST/PUT/DELETE) dùng `writePool` → Master.
  - Các thao tác **Đọc** (GET) dùng `readPool` → Slave.
  - Đảm bảo logic nghiệp vụ tập trung, dễ kiểm soát và mở rộng.

### Step 3: Cấu trúc Schema (Models)

- **models/** là nơi mô tả cấu trúc dữ liệu chuẩn cho bảng **products**.
- **Schema tập trung** giúp Service và DB logic thống nhất: cột, kiểu dữ liệu, ràng buộc.
- Đây là **nguồn tham chiếu duy nhất** khi cần mở rộng hoặc kiểm soát phiên bản cấu trúc bảng.

### Step 4: Container Infrastructure & Orchestration

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

- **Build & Image cho API**:
  - **context: ./server** xác định thư mục gốc để Docker thu thập source code và dependencies.
  - **dockerfile: Dockerfile** chỉ rõ file build dùng cho API, giúp quy trình build nhất quán giữa máy dev và môi trường chạy thật.
  - Việc **build image từ mã nguồn cục bộ** đảm bảo mỗi lần thay đổi code đều được đóng gói lại, tránh lệch phiên bản giữa runtime và source hiện tại.
- **Dependencies (depends_on)**:
  - `depends_on` đảm bảo **API được khởi động sau** khi `pg-master` và `pg-slave` đã được tạo container.
  - Điều này giảm lỗi kết nối sớm (connection refused) trong giai đoạn boot.
  - Lưu ý: `depends_on` chỉ đảm bảo **thứ tự start**, không xác nhận DB đã sẵn sàng; vì vậy API vẫn cần cơ chế retry khi kết nối DB.
- **env_file: ./server/.env**:
  - Tách biệt cấu hình khỏi Compose file giúp **dễ đọc, dễ bảo trì**.
  - Cho phép **dùng chung một bộ biến** cho nhiều node API mà không lặp cấu hình.
  - Hỗ trợ **quản lý bí mật** tốt hơn (không hard-code trực tiếp vào compose).
- **Custom Bridge Network (scnode-network)**:
  - Network `scnode-network` với driver **bridge** tạo một **mạng nội bộ riêng** cho các service của hệ thống.
  - **Service Discovery**: API có thể gọi DB bằng **tên service** như `pg-master`, `pg-slave` thay vì IP tĩnh.
  - Giảm rủi ro đổi IP khi container restart và tăng tính ổn định kết nối.
- **Port Mapping (Host vs Internal)**:
  - **Host Ports**: 3000 (API), 5432 (Master), 5433 (Slave) dùng để truy cập từ máy bên ngoài.
  - **Internal Ports**: các container DB vẫn giao tiếp qua **5432** trong mạng Docker.
  - API **không cần** biết host port; nó chỉ dùng tên service và port nội bộ khi kết nối DB.

### ✅ Phase 2 Verification Checklist

Dùng danh sách này để chốt lại kết quả của **Phase 2**:

| Hạng mục                 | Chỉ số kiểm tra (Expectation)                                           | Trạng thái |
| :----------------------- | :---------------------------------------------------------------------- | :--------: |
| **Connection Pools**     | Tách biệt rõ `writePool` và `readPool` trong cấu hình DB.               |    [x]     |
| **Read/Write Splitting** | Service dùng **readPool** cho GET và **writePool** cho POST/PUT/DELETE. |    [x]     |
| **Middleware**           | Có **Validation** và **Response Wrapper** hoạt động trước Routes.       |    [x]     |
| **Response Format**      | Mọi response có đủ `success`, `message`, `data`, `meta`.                |    [x]     |
| **Meta-data**            | `processed_by`, `db_source`, `timestamp` luôn có trong JSON.            |    [x]     |
| **Image Build**          | `api-service` build thành công từ `Dockerfile` qua Compose.             |    [x]     |
| **Connectivity**         | API kết nối DB qua `scnode-network` bằng tên `pg-master`/`pg-slave`.    |    [x]     |
| **Error Handling**       | Test 404/500 trả JSON thống nhất, server không crash.                   |    [x]     |

---

## 5.3. Phase 3: Infrastructure & Load Balancing

Mục tiêu của Phase 3 là hiện thực hóa khả năng **High Availability (Tính sẵn sàng cao)** bằng cách chạy song song nhiều thực thể API và điều phối chúng thông qua một **Load Balancer (Nginx)**.

---

### Step 1: Nhân bản API Nodes trong `docker-compose.yml`

Để hệ thống có thể chia tải, ta cần ít nhất 2 thực thể API chạy độc lập. Ta sẽ tách `api-service` cũ thành 2 service riêng biệt với tên định danh khác nhau.

Cập nhật `docker-compose.yml`:

```yaml
services:
  # --- API Node A ---
  api-service-01:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: scnode-api-01
    env_file: ./server/.env
    environment:
      - NODE_NAME=ScaleNode-API-01
    # Không cần port mapping ra ngoài vì đã có Nginx điều phối nội bộ
    depends_on:
      - pg-master
      - pg-slave
    networks:
      - scnode-network

  # --- API Node 02 ---
  api-service-02:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: scnode-api-02
    env_file: ./server/.env
    environment:
      - NODE_NAME=ScaleNode-API-02
    # Không cần port mapping ra ngoài vì đã có Nginx điều phối nội bộ
    depends_on:
      - pg-master
      - pg-slave
    networks:
      - scnode-network
```

**_Lưu ý_**: Ta sử dụng `environment` để ghi đè `NODE_NAME`. Điều này giúp chúng ta phân biệt được Request đang rơi vào Node nào khi kiểm thử.

---

### Step 2: Cấu hình Nginx Load Balancer

Tạo file `nginx/nginx.conf` để định nghĩa cách Nginx chia tải cho các API Nodes.

```nginx
upstream scalenode_api {
    # Thuật toán mặc định: Round Robin (Chia đều)
    server api-service-01:3000 max_fails=3 fail_timeout=30s;
    server api-service-02:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;

    location / {
        proxy_pass http://scalenode_api;

        proxy_connect_timeout 2s;
        proxy_read_timeout 5s;
        proxy_send_timeout 5s

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

- **Upstream**: Khai báo nhóm server API. Nginx sẽ tự động nhận diện IP của container qua Docker DNS.

- **Passive Health Check**:
  - `max_fails=3`: Nếu node lỗi 3 lần liên tiếp, Nginx sẽ tạm ngưng gửi request tới node đó.
  - `fail_timeout=30s`: Thời gian tạm ngưng trước khi thử kết nối lại.

---

### Step 3: Tích hợp Nginx vào `docker-compose.yml`

Thêm service Nginx vào file Compose để nó đóng vai trò là `Cổng vào duy nhất (Single Entry Point)` cho toàn bộ hệ thống.

```yaml
services:
  # ... các service khác ...

  nginx-lb:
    image: nginx:latest
    container_name: scnode-load-balancer
    ports:
      - "80:80" # Mở cổng 80 để tiếp nhận traffic từ người dùng
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - api-service-01
      - api-service-02
    networks:
      - scnode-network
```

---

### Step 4: Triển khai và Kiểm tra

#### 1. Khởi động lại toàn bộ hệ thống:

```bash
docker-compose up -d --build
```

#### 2. Kiểm tra trạng thái:

Dùng lệnh `docker ps` để đảm bảo các container: `scnode-load-balancer`, `scnode-api-01`, `scnode-api-02`, `scnode-db-master`, và `scnode-db-slave` đều đang chạy.

---

### ✅ Phase 3 Verification Checklist

Dùng danh sách này để nghiệm thu và kiểm chứng khả năng **Scalability** (Mở rộng) cũng như **Fault Tolerance** (Chịu lỗi) của hệ thống sau khi đã cấu hình Nginx.

---

### Bảng Kiểm thử Hệ thống Scalable

| Hạng mục                 | Chỉ số kiểm tra (Expectation)                                                                                                             | Trạng thái |
| :----------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- | :--------: |
| **Load Balancing**       | Gọi API `GET` liên tục qua cổng 80. Giá trị `processed_by` phải **luân phiên** thay đổi giữa `ScaleNode-API-01` và `ScaleNode-API-02`.    |    [x]     |
| **Single Entry Point**   | Hệ thống chỉ tiếp nhận yêu cầu qua **Port 80** (Nginx). Việc truy cập trực tiếp Port 3000 từ bên ngoài phải bị chặn.                      |    [x]     |
| **Fault Tolerance**      | Khi chạy lệnh `docker stop scnode-api-node-a`, các request tiếp theo vẫn phải **thành công** nhờ Node B gánh tải.                         |    [x]     |
| **Passive Health Check** | Nginx tự động phát hiện Node sập và **ngừng chuyển traffic** vào node đó, không gây ra lỗi 502 cho người dùng.                            |    [x]     |
| **Auto-Recovery**        | Sau khi `docker start` lại node bị sập, Nginx phải tự động đưa node đó **quay trở lại** danh sách điều phối sau thời gian `fail_timeout`. |    [x]     |
| **Identity Mapping**     | Mỗi Node API phải hiển thị đúng **NODE_NAME** được cấu hình trong mục `environment` của Docker Compose.                                   |    [x]     |

---

## 5.4. Phase 4: Verification & Stress Test

Phase cuối cùng tập trung vào việc kiểm chứng toàn bộ luồng hoạt động của hệ thống, từ **Load Balancing** (Nginx), **Validation** (Middleware), đến **Read/Write Splitting** và **Replication** (Database).

---

### Step 1: Kiểm thử Load Balancing & Validation

Thực hiện gửi chuỗi các request liên tục để quan sát sự điều phối của **Nginx** và khả năng xử lý của các **API Nodes**.

#### 1. Gửi Request POST thành công (Kiểm tra Write + Node 1)

- **Request**: `POST http://localhost:80/api/products`
- **Body**: `{"name": "Sony PS5", "price": 500}`
- **Response**:
  ```json
  {
    "success": true,
    "message": "Product created",
    "data": {
      "id": 3,
      "name": "Sony PS5",
      "price": 500,
      "created_at": "2026-04-28T17:10:39.035Z"
    },
    "meta": {
      "processed_by": "ScaleNode-API-01",
      "db_source": "Master",
      "timestamp": "2026-04-28T17:10:39.133Z"
    }
  }
  ```
- **Nhấn mạnh**: Request được **API Node 01** tiếp nhận và thực hiện ghi vào **Master Database**.

#### 2. Gửi Request POST thất bại (Kiểm tra Validation + Node 2)

- **Request**: `POST http://localhost:80/api/products`
- **Body**: `{"price": 500}` (Thiếu trường **name**)
- **Response**:
  ```json
  {
    "success": false,
    "message": "Validation failed",
    "errors": ["Name must be a non-empty string."],
    "meta": {
      "processed_by": "ScaleNode-API-02",
      "db_source": "N/A",
      "timestamp": "2026-04-28T17:12:20.452Z"
    }
  }
  ```
- **Nhấn mạnh**: **Nginx** đã luân chuyển request này sang **API Node 02**. Middleware tại đây chặn dữ liệu lỗi và trả về phản hồi ngay lập tức.

#### 3. Gửi Request GET lần 1 (Kiểm tra Read + Node 1)

- **Request**: `GET http://localhost:80/api/products`
- **Response Meta**:
  ```json
  {
    "success": true,
    "message": "Products fetched",
    "data": [
      {
        "id": 3,
        "name": "Sony PS5",
        "price": 500,
        "created_at": "2026-04-28T17:10:39.035Z"
      },
      {
        "id": 2,
        "name": "Lenovo ThinkPad",
        "price": 1000,
        "created_at": "2026-04-28T09:50:10.816Z"
      },
      {
        "id": 1,
        "name": "Macbook Pro",
        "price": 2500,
        "created_at": "2026-04-28T09:48:21.428Z"
      }
    ],
    "meta": {
      "processed_by": "ScaleNode-API-01",
      "db_source": "Slave",
      "timestamp": "2026-04-28T17:14:50.515Z"
    }
  }
  ```
- **Nhấn mạnh**: Request đọc dữ liệu được thực hiện trên **Slave Database** thông qua **API Node 01**.

#### 4. Gửi Request GET lần 2 (Kiểm tra Read + Node 2)

- **Request**: `GET http://localhost:80/api/products`
- **Response Meta**:
  ```json
  {
    "success": true,
    "message": "Products fetched",
    "data": [
      {
        "id": 3,
        "name": "Sony PS5",
        "price": 500,
        "created_at": "2026-04-28T17:10:39.035Z"
      },
      {
        "id": 2,
        "name": "Lenovo ThinkPad",
        "price": 1000,
        "created_at": "2026-04-28T09:50:10.816Z"
      },
      {
        "id": 1,
        "name": "Macbook Pro",
        "price": 2500,
        "created_at": "2026-04-28T09:48:21.428Z"
      }
    ],
    "meta": {
      "processed_by": "ScaleNode-API-02",
      "db_source": "Slave",
      "timestamp": "2026-04-28T17:15:50.909Z"
    }
  }
  ```
- **Nhấn mạnh**: Dữ liệu vẫn được lấy từ **Slave Database** nhưng do **API Node 02** xử lý luân phiên.

---

### Step 2: Kiểm tra tính nhất quán dữ liệu (Data Visibility)

Xác minh cơ chế **Streaming Replication** đảm bảo dữ liệu ghi vào Master được hiển thị chính xác khi truy vấn qua Slave.

1.  **Thao tác**: Gửi `POST` thêm 1 sản phẩm mới (ví dụ: "iPhone 15").

- **Request**: `POST http://localhost:80/api/products`
- **Body**: `{"name": "IPhone 15", "price": 1000}`
- **Response Meta**:

  ```json
  {
    "success": true,
    "message": "Product created",
    "data": {
      "id": 4,
      "name": "IPhone 15",
      "price": 1000,
      "created_at": "2026-04-28T17:18:59.249Z"
    },
    "meta": {
      "processed_by": "ScaleNode-API-01",
      "db_source": "Master",
      "timestamp": "2026-04-28T17:18:59.310Z"
    }
  }
  ```

2.  **Hành động của hệ thống**:
    - **API Node** nhận lệnh và ghi vào **Master Database**.
    - **PostgreSQL Master** ngay lập tức đồng bộ bản ghi này xuống **PostgreSQL Slave**.
3.  **Kiểm chứng**:
    - Gửi lệnh `GET /api/products`.
    - Hệ thống gọi vào **Slave Database**.
    - **Kết quả**: Sản phẩm "iPhone 15" xuất hiện ngay trong danh sách trả về từ Slave.

- **Request**: `GET http://localhost:80/api/products`
- **Response Meta**:
  ```json
  {
    "success": true,
    "message": "Products fetched",
    "data": [
      {
        "id": 4,
        "name": "IPhone 15",
        "price": 1000,
        "created_at": "2026-04-28T17:18:59.249Z"
      },
      {
        "id": 3,
        "name": "Sony PS5",
        "price": 500,
        "created_at": "2026-04-28T17:10:39.035Z"
      },
      {
        "id": 2,
        "name": "Lenovo ThinkPad",
        "price": 1000,
        "created_at": "2026-04-28T09:50:10.816Z"
      },
      {
        "id": 1,
        "name": "Macbook Pro",
        "price": 2500,
        "created_at": "2026-04-28T09:48:21.428Z"
      }
    ],
    "meta": {
      "processed_by": "ScaleNode-API-02",
      "db_source": "Slave",
      "timestamp": "2026-04-28T17:19:46.824Z"
    }
  }
  ```

4.  **Kết luận**: Cơ chế nhân bản dữ liệu hoạt động ổn định với độ trễ gần như bằng không (**Near Zero-lag**).

---

### Step 3: The "Chaos" Test (Kiểm tra tính chịu lỗi)

Mục tiêu của bài test này là chứng minh khả năng **High Availability** (Tính sẵn sàng cao) của hệ thống bằng cách giả lập sự cố sập node đột ngột.

#### 1. Thực hiện kịch bản phá hủy

- **Hành động**: Chủ động đánh sập một instance API bằng lệnh:
  `docker stop scnode-api-01`
- **Kiểm tra**: Gửi liên tiếp các yêu cầu `GET` và `POST` tới địa chỉ `http://localhost/api/products`.

#### 2. Kết quả quan sát thực tế

- **Độ trễ ban đầu**: Request đầu tiên sau khi sập node có thể bị chậm (vài giây) do Nginx đang thực hiện **Timeout** và **Failover**.
- **Khả năng duy trì**: Toàn bộ các yêu cầu sau đó đều trả về **Success: true**.
- **Định danh xử lý**: Trong phần `meta`, giá trị `processed_by` luôn là **ScaleNode-API-02**.

#### 3. Ý nghĩa kỹ thuật

- **Chống sập (Fault Tolerance)**: Hệ thống không bị "chết" hoàn toàn khi có một thành phần bị lỗi.
- **Tự động điều hướng**: **Nginx** đóng vai trò thông minh khi tự động loại bỏ node lỗi ra khỏi vòng điều phối mà không cần can thiệp thủ công.
- **Khả năng hồi phục**: Khi khởi động lại node bằng lệnh `docker start`, hệ thống sẽ tự động nhận lại node và chia tải như bình thường sau khi hết thời gian **fail_timeout**.

---

### ✅ Phase 4 Verification Checklist

| Hạng mục              | Chỉ số kiểm tra (Expectation)                                    | Trạng thái |
| :-------------------- | :--------------------------------------------------------------- | :--------: |
| **LB Toggling**       | Server ID thay đổi liên tục giữa Node 1 và Node 2 qua cổng 80.   |    [x]     |
| **Input Guard**       | Middleware Validation bắt đúng lỗi thiếu trường dữ liệu.         |    [x]     |
| **Correct Splitting** | Log hệ thống xác nhận POST/PUT vào Master và GET vào Slave.      |    [x]     |
| **Data Consistency**  | Dữ liệu tạo mới hiển thị đầy đủ khi truy vấn qua cổng Slave.     |    [x]     |
| **System Stability**  | Hệ thống không bị treo hoặc crash khi gửi nhiều request dồn dập. |    [x]     |
