# Horizex Property Pro — Backend API

Enterprise-grade multi-company property management REST API built with Node.js, Express, TypeScript, Prisma ORM, and PostgreSQL.

---

## 🚀 Quick Start Guide

### 1. Environment Configuration
Create or edit your `.env` file in the `backend/` folder:

```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/horizex_db?schema=public"

JWT_SECRET="horizex_access_token_secret_32_chars_min_key"
JWT_REFRESH_SECRET="horizex_refresh_token_secret_32_chars_min_key"

CORS_ORIGIN="http://localhost:5173"

# Cloudinary (Direct upload without Multer)
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"
```

### 2. Database Migration & Seed
Make sure PostgreSQL is running, then run:

```bash
# Push schema to PostgreSQL database
npx prisma db push

# (Optional) Seed initial Super Admin, Company, Unit Types, Demo Units
npm run seed
```

**Default Seeded Credentials:**
* **Email:** `admin@horizex.com`
* **Password:** `Admin@123456`
* **Role:** `SUPER_ADMIN`

### 3. Start Development Server
```bash
npm run dev
```
The server will start at: `http://localhost:5000/api`
Health check endpoint: `GET http://localhost:5000/api/health`

### 4. Build for Production
```bash
npm run build
npm start
```

---

## 📁 Architecture Overview

```
backend/
├── prisma/
│   ├── schema.prisma               # Master 24-table 3NF relational schema
│   └── seed.ts                     # Initial seeding script
├── src/
│   ├── config/                     # Prisma client, Zod env validation, Cloudinary
│   ├── middlewares/                # Edge security, Auth, RBAC, Zod validation, Error handler
│   ├── utils/                      # Password hashing, JWT signing/rotation, Audit logger, Response envelopes
│   ├── modules/                    # Vertical Slices:
│   │   ├── auth/                   # Dual-token JWT login, refresh rotation, logout, /me
│   │   ├── media/                  # Cloudinary signature generation & Base64 upload (No Multer!)
│   │   ├── companies/              # Multi-tenant corporate entities
│   │   ├── properties/             # Building management & portfolio
│   │   ├── units/                  # Flats/Apartments & 7-stage Turnover Readiness Pipeline
│   │   ├── tenants/                # Tenant profiles & parking permit allocations
│   │   ├── leases/                 # Contracts, move-in/out inspections & TAL renewals
│   │   ├── accounting/             # Single place to collect rent, double-entry ledger & overpayments
│   │   ├── maintenance/            # Work orders, staff assignment, emergency SLAs (<2h)
│   │   ├── talCases/               # Quebec TAL Tribunal legal dispute dossiers
│   │   ├── communications/         # Email/SMS messaging & building broadcast campaigns
│   │   └── analytics/              # Dashboard stats, 6-month cash flow trajectory, vacancy rates
│   ├── routes.ts                   # Master router
│   ├── app.ts                      # Express app assembly
│   └── server.ts                   # Server entry point
```

---

## 📸 Image & Document Upload (Cloudinary - No Multer!)

To prevent server CPU & memory spikes, file uploads do NOT use Multer. Instead:

### Method 1: Direct Client-to-Cloudinary Signed Upload (Recommended)
1. Frontend calls: `POST /api/media/signature` with `{ "folder": "inspection_photos" }`.
2. Backend returns signature and timestamp.
3. Frontend uploads directly to `https://api.cloudinary.com/v1_1/<cloud_name>/image/upload`.
4. Cloudinary returns `secure_url`.
5. Frontend sends the URL in normal JSON requests (e.g., `POST /api/admin/tickets` with `photoUrls: [url]`).

### Method 2: Base64 JSON Upload
Call `POST /api/media/upload-base64` with `{ "imageBase64": "data:image/jpeg;base64,..." }`.
The server streams directly to Cloudinary without creating any local temp files.

