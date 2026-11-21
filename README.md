# CivicResolve — AI Civic Grievance & Incident-Clustering Platform

> **"One problem. Multiple citizens. One tracked incident."**

**Live Website:** [https://civicresolve-git-main-wamech.vercel.app](https://civicresolve-git-main-wamech.vercel.app)

---

## Jury Access Guide

### 1. Citizen App (Public)
Open the live link above:
- **Sign in:** Use **Continue with Google** or **Email/Password** on `/login`.
- **Report a problem:** Go to **Report** (bottom nav) → 3-step form with photo upload/camera, ready-typed English/Tamil/Hindi suggestions, GPS or landmark, and optional voice input.
- **Nearby & My Reports:** View nearby issues on **Nearby** and track your own submitted reports on **My reports**.
- **Language:** Switch between **English**, **தமிழ் (Tamil)**, and **हिन्दी (Hindi)** in **Profile**.

### 2. Department & Admin Portals (Key-Protected)
Staff portals are hidden from citizens. Open **`/staff-login`** (or press **`Ctrl + Shift + L`**) and enter an access key:

| Portal | URL | Access Key |
|---|---|---|
| **Department Portal** | `/staff-login` → `/authority` | `DEPT-CIVIC-2026` |
| **Admin Portal** | `/staff-login` → `/admin` | `ADMIN-CIVIC-2026` |

- Search incidents with **`Ctrl + K` / `⌘K`**, click any incident to update status, priority, department, public update note, or attach a resolution photo.

---

## Core Tech & Google Services
- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS v4, TanStack Query, `react-hook-form`, `zod`, `cmdk`, `recharts`, `react-virtuoso`, `i18next` (EN/TA/HI).
- **AI & Google Cloud:** Google Gemini (`@google/genai`), Firebase Authentication, PostgreSQL + PostGIS + `pgvector` schema (`db/schema.sql`), MongoDB persistence (`src/lib/mongodb.ts`), and **IGMER** (Ingest-First Geospatial Multimodal Entity Resolution) concurrency-safe clustering.
- **Verification:** `npm test` (30/30 unit, RBAC, and 50-citizen concurrency tests) & `npm run typecheck`.
