# ScaleNode Configuration Snippets

Tài liệu này tổng hợp các đoạn cấu hình quan trọng nhất trong ScaleNode, kèm giải thích lý do thiết kế và tác động đến vận hành hệ thống.

## Table of Contents

- [1. Nginx Load Balancer Configuration](#1-nginx-load-balancer-configuration)
- [2. Database Replication and Infrastructure (Docker Compose)](#2-database-replication-and-infrastructure-docker-compose)
- [3. API Database Connection Logic (Read/Write Splitting)](#3-api-database-connection-logic-readwrite-splitting)
- [4. Environment Variables Blueprint](#4-environment-variables-blueprint)

---

# 1. Nginx Load Balancer Configuration

**Snippet (nginx/nginx.conf)**

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
				proxy_send_timeout 5s;

				proxy_set_header Host $host;
				proxy_set_header X-Real-IP $remote_addr;
				proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		}
}
```

**Key Parameters**

| Tham số                      | Ý nghĩa                                             | Lý do sử dụng                                               |
| :--------------------------- | :-------------------------------------------------- | :---------------------------------------------------------- |
| **upstream scalenode_api**   | Nhóm backend servers cho **Round Robin**            | Cân bằng tải giữa các API node, không cần thuộc tính sticky |
| **max_fails=3**              | Số lần lỗi liên tiếp trước khi đánh dấu node bị lỗi | Giảm rủi ro gửi traffic vào node đang mất kết nối           |
| **fail_timeout=30s**         | Khoảng thời gian tạm ngưng node lỗi                 | Cho phép node tự khôi phục sau thời gian chờ                |
| **proxy_connect_timeout 2s** | Giới hạn thời gian kết nối tới backend              | Tránh treo kết nối lâu, cải thiện UX khi node treo          |
| **proxy_read_timeout 5s**    | Giới hạn thời gian đợi phản hồi                     | Tránh request bị treo quá lâu, ưu tiên fail-fast            |
| **proxy_send_timeout 5s**    | Giới hạn thời gian gửi dữ liệu                      | Bảo vệ khi client gửi chậm hoặc backend bị kẹt              |
| **proxy_set_header**         | Truyền thông tin client                             | Giữ log và trace đúng nguồn gốc request                     |

---

# 2. Database Replication and Infrastructure (Docker Compose)

**Snippet (docker-compose.yml)**

```yaml
api-service-01:
  depends_on:
    pg-master:
      condition: service_healthy
    pg-slave:
      condition: service_healthy

api-service-02:
  depends_on:
    pg-master:
      condition: service_healthy
    pg-slave:
      condition: service_healthy

pg-master:
  image: bitnami/postgresql:latest
  environment:
    - POSTGRESQL_REPLICATION_MODE=master
    - POSTGRESQL_REPLICATION_USER=repl_user
    - POSTGRESQL_REPLICATION_PASSWORD=repl_password
    - POSTGRESQL_USERNAME=myuser
    - POSTGRESQL_PASSWORD=mypassword
    - POSTGRESQL_DATABASE=scnode_db
  healthcheck:
    test:
      [
        "CMD-SHELL",
        "pg_isready -U $$POSTGRESQL_USERNAME -d $$POSTGRESQL_DATABASE",
      ]
    interval: 10s
    timeout: 5s
    retries: 10

pg-slave:
  image: bitnami/postgresql:latest
  depends_on:
    - pg-master
  environment:
    - POSTGRESQL_REPLICATION_MODE=slave
    - POSTGRESQL_MASTER_HOST=pg-master
    - POSTGRESQL_MASTER_PORT_NUMBER=5432
    - POSTGRESQL_REPLICATION_USER=repl_user
    - POSTGRESQL_REPLICATION_PASSWORD=repl_password
    - POSTGRESQL_PASSWORD=mypassword
    - POSTGRESQL_DATABASE=scnode_db
  healthcheck:
    test:
      [
        "CMD-SHELL",
        "pg_isready -U $$POSTGRESQL_USERNAME -d $$POSTGRESQL_DATABASE",
      ]
    interval: 10s
    timeout: 5s
    retries: 10
```

**Key Parameters**

| Tham số                                  | Ý nghĩa                                | Lý do sử dụng                                               |
| :--------------------------------------- | :------------------------------------- | :---------------------------------------------------------- |
| **POSTGRESQL_REPLICATION_MODE**          | Chọn vai trò **master** hoặc **slave** | Bật chế độ replication của Bitnami Postgres                 |
| **POSTGRESQL_REPLICATION_USER/PASSWORD** | Tài khoản đồng bộ                      | Tách quyền replication ra khỏi user ứng dụng                |
| **POSTGRESQL_USERNAME/PASSWORD**         | User chính của DB                      | Dùng cho application query dữ liệu                          |
| **POSTGRESQL_DATABASE**                  | Tên database khởi tạo                  | Đảm bảo DB sẵn sàng khi container chạy                      |
| **POSTGRESQL_MASTER_HOST/PORT**          | Địa chỉ master cho slave               | Cho phép slave biết điểm đồng bộ                            |
| **ports**                                | Map cổng ra host                       | Truy cập test từ máy local, không dùng trong network nội bộ |
| **volumes**                              | Lưu trữ dữ liệu                        | Bảo toàn dữ liệu khi container restart                      |

**Healthcheck và depends_on**

| Tham số             | Ý nghĩa                                     | Lý do sử dụng                                                   |
| :------------------ | :------------------------------------------ | :-------------------------------------------------------------- |
| **pg_isready**      | Kiểm tra Postgres đã sẵn sàng nhận kết nối  | Tránh API kết nối sớm khi DB chưa lắng nghe                     |
| **interval**        | Chu kỳ kiểm tra định kỳ                     | Phát hiện trạng thái sớm mà không gây quá tải                   |
| **retries**         | Số lần thử lại trước khi đánh dấu unhealthy | Giảm false-negative khi DB khởi động chậm                       |
| **service_healthy** | Điều kiện phụ thuộc theo trạng thái health  | API chỉ khởi chạy khi DB đã healthy, tránh lỗi **ECONNREFUSED** |

**Passive vs Active Health Check**

- **Passive (Nginx)**: Phát hiện lỗi dựa trên request thật; chỉ đánh dấu node lỗi khi có failure thực tế.
- **Active (Docker)**: Chủ động ping DB theo lịch; đảm bảo dịch vụ đã sẵn sàng trước khi API khởi động.

Kết hợp cả hai giúp giảm tối đa lỗi **ECONNREFUSED**: Docker ngăn API kết nối sớm, Nginx loại bỏ node bị lỗi khi đang xử lý traffic.

---

# 3. API Database Connection Logic (Read/Write Splitting)

**Snippet (server/src/config/db.js)**

```js
const {Pool} = require("pg");

const getEnv = (key, fallback) => {
  const value = process.env[key];
  return value !== undefined && value !== "" ? value : fallback;
};

const buildConfig = (prefix) => ({
  host: getEnv(`${prefix}_HOST`),
  port: Number(getEnv(`${prefix}_PORT`, 5432)),
  user: getEnv(`${prefix}_USER`),
  password: getEnv(`${prefix}_PASSWORD`),
  database: getEnv(`${prefix}_NAME`),
});

const writePool = new Pool(buildConfig("DB_MASTER"));
const readPool = new Pool(buildConfig("DB_SLAVE"));

writePool.on("error", (err) => {
  console.error("Write pool error:", err);
});

readPool.on("error", (err) => {
  console.error("Read pool error:", err);
});

module.exports = {writePool, readPool};
```

**Key Parameters**

- **writePool**: Kết nối tới **Master** để thực hiện các thao tác **ghi**.
- **readPool**: Kết nối tới **Slave** để thực hiện các thao tác **đọc**.
- **DB*MASTER*_ / DB*SLAVE*_**: Cho phép cấu hình host, port, user, password theo từng vai trò.

**Snippet (server/src/services/productService.js)**

```js
const {writePool, readPool} = require("../config/db");
const {TABLE_NAME} = require("../models/productModel");

const createProduct = async ({name, price}) => {
  const query = `INSERT INTO ${TABLE_NAME} (name, price)
		VALUES ($1, $2)
		RETURNING id, name, price, created_at`;
  const values = [name, price];
  const result = await writePool.query(query, values);
  return result.rows[0];
};

const getProducts = async () => {
  const query = `SELECT id, name, price, created_at
		FROM ${TABLE_NAME}
		ORDER BY id DESC`;
  const result = await readPool.query(query);
  return result.rows;
};

module.exports = {createProduct, getProducts};
```

**Key Parameters**

- **GET** sử dụng **readPool** để tận dụng replica, giảm tải cho master.
- **INSERT/UPDATE/DELETE** sử dụng **writePool** để đảm bảo dữ liệu ghi vào **Master**.

**Tại sao tách 2 pool?**

- Tránh truy cập ghi vào **Slave** (read-only), giảm lỗi runtime.
- Cho phép scale đọc, tăng thông lượng read không ảnh hưởng write.
- Tách luồng kết nối giúp giảm contention và dễ theo dõi sự cố từng pool.

---

# 4. Environment Variables Blueprint

**Snippet (server/.env)**

```env
# Information of current node
PORT=3000
NODE_NAME=ScaleNode-API-01

# Connect to Service pg-master (port 5432)
DB_MASTER_HOST=pg-master
DB_MASTER_PORT=5432
DB_MASTER_USER=myuser
DB_MASTER_PASSWORD=mypassword
DB_MASTER_NAME=scnode_db

# Connect to Service pg-slave (port 5432)
# Notice: In Docker network, Slave still use port 5432 to connect Master
DB_SLAVE_HOST=pg-slave
DB_SLAVE_PORT=5432
DB_SLAVE_USER=myuser
DB_SLAVE_PASSWORD=mypassword
DB_SLAVE_NAME=scnode_db
```

**Key Parameters**

| Biến                             | Ý nghĩa                          | Lý do sử dụng                                                     |
| :------------------------------- | :------------------------------- | :---------------------------------------------------------------- |
| **NODE_NAME**                    | Định danh instance API           | Hiển thị trong response meta để kiểm tra load balancing           |
| **DB_MASTER_HOST/DB_SLAVE_HOST** | Tên service trong Docker network | Tránh dùng IP, tự động discovery và ổn định khi container restart |
| **DB\_\*\_PORT**                 | Cổng nội bộ Postgres             | Trong network nội bộ, cổng vẫn là **5432**                        |
| **PORT**                         | Cổng API                         | Phục vụ map ra host hoặc Nginx                                    |
