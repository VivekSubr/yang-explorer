.PHONY: install install-backend install-frontend build build-backend build-frontend dev dev-backend dev-frontend dev-mock clean

# ===== Install dependencies =====
install: install-backend install-frontend

install-backend:
	cd backend && go mod tidy

install-frontend:
	cd frontend && npm install

# ===== Build =====
build: build-backend build-frontend

build-backend: install-backend
	cd backend && go build -o yang-explorer.exe .

build-frontend: install-frontend
	cd frontend && npm run build
	-rd /s /q backend\frontend-dist 2>nul
	xcopy /e /i /q frontend\dist backend\frontend-dist

# ===== Development =====
dev-backend: install-backend
	cd backend && go run .

dev-frontend: install-frontend
	cd frontend && npm run dev

dev-mock:
	cd backend && node dev-server.js

# ===== Clean =====
clean:
	-rd /s /q frontend\node_modules 2>nul
	-rd /s /q frontend\dist 2>nul
	-rd /s /q backend\frontend-dist 2>nul
	-rd /s /q backend\tmp 2>nul
	-del /q backend\yang-explorer.exe 2>nul
	-del /q backend\go.sum 2>nul
