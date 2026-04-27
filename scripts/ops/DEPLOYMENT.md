# 🚀 Production Deployment & Operations

This folder contains automated scripts for managing the **Ghost Referee** production server at `206.189.90.68`.

> [!CAUTION]
> These scripts contain sensitive credentials. **NEVER** remove `scripts/ops/` from `.gitignore`.

## 🛠️ Deployment Flow (Memory-Safe)
The production server has limited RAM (1GB). Running `npm run build` directly on the server often causes OOM (Out of Memory) crashes. **Always use the Local-to-Remote flow for frontend updates.**

### 1. Build Locally
On your local machine, ensure `.env.local` points to the production API:
```bash
NEXT_PUBLIC_API_URL="http://206.189.90.68:4000"
```
Then run:
```bash
rm -rf .next build.zip
npm run build
# Pack excluding cache and dev artifacts
zip -r build.zip .next public package.json -x ".next/cache/*" -x ".next/dev/*"
```

### 2. Prepare & Upload Chunks
Convert the zip to Base64 and split it (to handle SSH connection instability):
```bash
base64 -i build.zip -o build.b64
split -b 1m build.b64 build_chunk_
```

### 3. Transfer to Server
Clean the remote destination and upload the pieces:
```bash
./scripts/ops/clean_remote.exp
./scripts/ops/upload_part.exp build_chunk_aa
./scripts/ops/upload_part.exp build_chunk_ab
# ... repeat for all chunks (ac, ad, ae)
```

### 4. Finalize Deployment
Decode the Base64 data and unpack using Python (server lacks `unzip`):
```bash
./scripts/ops/finalize_deploy_python.exp
```
*This script decodes the file, unzips it via python3, and restarts the PM2 frontend process.*

## 🔍 Diagnostics
- **Check Dashboard**: `curl -I http://206.189.90.68:3000` (Should return 200 OK)
- **Check Backend Logs**: `./scripts/ops/check_logs.exp`
- **Restart Backend**: `./scripts/ops/start_backend.exp`
- **Database Query**: `./scripts/ops/query_no_pager.exp`

## 🏗️ Server Architecture
- **OS**: Ubuntu 24.04 LTS
- **Process Manager**: PM2
- **Node Version**: v20+ (managed via nvm)
- **Database**: Native PostgreSQL (User: `gank_user`, DB: `gank`)
- **API Location**: `/var/www/gank/server`
- **Frontend Location**: `/var/www/gank/`

---
*Updated by Antigravity AI - April 2026*

