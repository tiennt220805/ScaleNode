#!/bin/bash

# Tự động di chuyển về thư mục gốc của dự án (ScaleNode/)
cd "$(dirname "$0")/../.."

echo "📦 [ScaleNode] Đang kiểm tra và cài đặt dependencies cho Backend..."

# Di chuyển vào thư mục server để cài đặt npm
if [ -d "./server" ]; then
    cd ./server
    npm install
    cd ..
else
    echo "❌ Lỗi: Không tìm thấy thư mục /server"
    exit 1
fi

echo "🚀 [ScaleNode] Đang khởi động hạ tầng Docker..."

docker-compose up -d --build

echo "✅ [ScaleNode] Tất cả dịch vụ đã sẵn sàng và đang chạy!"