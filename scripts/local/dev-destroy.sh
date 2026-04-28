#!/bin/bash

# Tự động di chuyển về thư mục gốc của dự án (ScaleNode/)
cd "$(dirname "$0")/../.."

echo "🧨 [ScaleNode] Đang hủy bỏ hạ tầng..."

# Dừng và xóa toàn bộ Container, Network và Volumes liên quan
docker-compose down -v

echo "📂 [ScaleNode] Đang dọn dẹp dữ liệu và thư viện..."

# Xóa bỏ các thư mục lưu trữ dữ liệu của Database
rm -rf pg_master_data pg_slave_data

# Xóa thư mục node_modules trong server
if [ -d "./server/node_modules" ]; then
    rm -rf ./server/node_modules
    echo "🗑️  Đã xóa server/node_modules"
fi

echo "✨ [ScaleNode] Toàn bộ hệ thống đã được dọn dẹp sạch sẽ!"