# Sistem Arsitektur PresensiApp - Dokumentasi Teknis

**Versi:** 1.0  
**Tanggal:** 9 Februari 2026  
**Untuk:** Developer baru onboarding

---

## 📋 Ringkasan Proyek

PresensiApp adalah sistem manajemen kehadiran berbasis QR Code untuk sekolah dengan fitur lengkap:
- **Backend:** Node.js + Express + TypeScript + PostgreSQL + Sequelize ORM
- **Frontend:** React 19 + Vite + Tailwind CSS + TypeScript
- **Testing:** Jest (backend, 23 tests, 100% pass) + Cypress (E2E)
- **Deployment:** Vercel/Netlify (frontend) + Render/Heroku (backend) + PostgreSQL produksi

**Status Backend Testing:**
- ✅ 23 Jest tests - 100% passing
- ✅ Database isolation dengan serial execution (`maxWorkers: 1`)
- ✅ CleanDatabase helper untuk reset antar test
- ✅ Data test unik untuk mencegah conflicts

---

## 🏗️ Gambaran Besar Arsitektur

### Alur Komunikasi Sistem

```
┌─────────────┐
│  Browser    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│  Frontend (React + Vite)        │
│  - React Router (routing)        │
│  - TanStack Query (API calls)    │
│  - Context API (auth state)     │
│  - Tailwind CSS (styling)       │
└──────┬──────────────────────────┘
       │ HTTPS
       ▼
┌─────────────────────────────────┐
│  Backend API (Express + TS)     │
│  - JWT Authentication            │
│  - Controllers (business logic) │
│  - Routes (API endpoints)        │
│  - Middlewares (validation)      │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  PostgreSQL Database             │
│  - Sequelize ORM                 │
│  - Models (entities)             │
│  - Relations (FKs)               │
└─────────────────────────────────┘
```

### Teknologi Stack

| Layer | Teknologi | Versi | Deskripsi |
|-------|-----------|-------|-----------|
| **Frontend** | React | 19.2.0 | UI framework |
| | Vite | 7.2.4 | Build tool & dev server |
| | Tailwind CSS | 3.4.19 | Utility-first CSS |
| | TanStack Query | 5.90.20 | Data fetching & caching |
| | React Router | 7.13.0 | Client-side routing |
| **Backend** | Node.js | LTS | Runtime |
| | Express | 5.2.1 | Web framework |
| | TypeScript | 5.9.3 | Type safety |
| | Sequelize | 6.37.7 | ORM |
| | PostgreSQL | - | Database |
| | JWT | 9.0.3 | Authentication |
| | Socket.io | 4.8.3 | Real-time updates |
| **Testing** | Jest | 30.2.0 | Backend unit tests |
| | Supertest | 7.2.2 | API testing |
| | Cypress | 15.10.0 | E2E testing |
| **Deployment** | Vercel/Netlify | - | Frontend hosting |
| | Render/Heroku | - | Backend hosting |
| | PostgreSQL | - | Production DB |

---

## 🎨 Struktur Frontend

### Halaman Utama & Fungsionalitas

#### 1. **`/scan` (QR Scanner)**
- **Tujuan:** Scan QR code untuk absensi siswa/guru
- **Komponen:** `Scanner.tsx` (html5-qrcode library)
- **Alur:**
  1. Camera aktif untuk scan QR
  2. Decode QR → dapatkan sessionId
  3. Kirim ke backend API: `POST /api/attendance/scan`
  4. Backend validasi: JWT, geofence, jadwal, guru pengganti
  5. Tampilkan hasil: Success/Error dengan detail

#### 2. **`/laporan` (Admin Dashboard - Rekap)**
- **Tujuan:** Rekap laporan kehadiran (EXISTING, jangan diubah)
- **Fitur:** Tabel rekap dengan filter date, class, subject
- **Data:** Aggregated attendance records

#### 3. **`/dashboard` (Dashboard Overview)**
- **Tujuan:** Dashboard admin dengan statistik real-time
- **Fitur:**
  - 4 Stats Cards: Kehadiran hari ini, Kelas aktif, Guru hadir, Pending absensi
  - Chart kehadiran per kelas (progress bar)
  - Recent activity table (10 record terakhir)
  - Quick links ke halaman admin
  - Auto-refresh setiap 30 detik

#### 4. **`/admin/users` (Manajemen User)**
- **Tujuan:** CRUD users (Guru/Admin)
- **Validasi:** NIP dan email harus unik
- **Fields:** Username, Password, Role (admin/teacher), Name, Email
- **Endpoint API:**
  - `GET /api/admin/users` - List semua users
  - `POST /api/admin/users` - Create user baru
  - `PUT /api/admin/users/:id` - Update user
  - `DELETE /api/admin/users/:id` - Delete user
  - `POST /api/admin/users/validate` - Validate uniqueness

#### 5. **`/admin/mapel` (Manajemen Mata Pelajaran)**
- **Tujuan:** CRUD mapel (Subject)
- **Validasi:** Nama dan kode mapel harus unik
- **Fields:** Name (required), Code (3-5 chars, unique)
- **Fitur:**
  - Tampilkan: Nama, Kode, Jadwal Terjadwal (count), Actions
  - Button "Kelola Jadwal" → navigasi ke `/jadwal?mapelId=XX`
  - Info banner: Jadwal management terpisah di halaman Jadwal
- **Endpoint API:**
  - `GET /api/admin/mapel` - List semua mapel dengan schedule count
  - `POST /api/admin/mapel` - Create mapel baru
  - `PUT /api/admin/mapel/:id` - Update mapel
  - `DELETE /api/admin/mapel/:id` - Delete mapel
  - `POST /api/admin/mapel/validate` - Validate uniqueness

#### 6. **`/jadwal` (Manajemen Jadwal)**
- **Tujuan:** Assign guru, kelas, dan mapel ke schedule
- **Filter:** Optional `?mapelId=XX` untuk filter per mapel
- **Fields:** Teacher, Class, Subject, TimeSlot, Day

### Proteksi Route

```typescript
// Level 1: Authenticated ( semua user yang login)
<ProtectedRoute>
  <Route path="/scan" element={<Scan />} />
  <Route path="/dashboard-guru" element={<GuruDashboard />} />
</ProtectedRoute>

// Level 2: Admin-only
<AdminRoute>
  <Route path="/dashboard" element={<DashboardOverview />} />
  <Route path="/admin/users" element={<AdminUsersPage />} />
  <Route path="/admin/mapel" element={<AdminMapelPage />} />
</AdminRoute>
```

**Implementasi:**
- `ProtectedRoute`: Cek JWT token di localStorage
- `AdminRoute`: Cek role === 'admin' dari JWT payload
- Redirect ke `/login` jika tidak authenticated
- Redirect ke `/scan` jika user biasa akses admin page

### API Calls (TanStack Query)

```typescript
// Pattern di services/adminApi.ts
export const adminApi = {
  // Users
  getUsers: () => axios.get('/api/admin/users'),
  createUser: (data) => axios.post('/api/admin/users', data),
  
  // Mapel
  getMapel: () => axios.get('/api/admin/mapel'),
  createMapel: (data) => axios.post('/api/admin/mapel', data),
  
  // Dashboard
  getStats: () => axios.get('/api/dashboard/stats'),
  getRecentActivity: () => axios.get('/api/dashboard/recent'),
};

// Penggunaan di components dengan TanStack Query
const { data: users, isLoading } = useQuery({
  queryKey: ['users'],
  queryFn: adminApi.getUsers,
});

const createUserMutation = useMutation({
  mutationFn: adminApi.createUser,
  onSuccess: () => {
    queryClient.invalidateQueries(['users']);
  },
});
```

### Struktur Folder Frontend (Rekomendasi)

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components (Button, Card, Modal, etc.)
│   ├── layout/         # Layout components (Sidebar, Navbar, Layout)
│   └── Scanner.tsx     # QR Scanner component
├── pages/              # Page components (route components)
│   ├── Scan.tsx
│   ├── DashboardOverview.tsx
│   ├── AdminUsersPage.tsx
│   ├── AdminMapelPage.tsx
│   ├── Jadwal.tsx
│   └── Laporan.tsx
├── services/           # API service functions
│   ├── api.ts         # General API calls
│   └── adminApi.ts    # Admin-specific API calls
├── hooks/              # Custom React hooks
├── context/            # React Context providers
│   └── AuthContext.tsx
├── lib/                # Utility functions
│   ├── api.ts         # Axios instance setup
│   └── utils.ts       # Helper functions
└── types/              # TypeScript type definitions
```

---

## 🔧 Struktur Backend & API

### Organisasi Backend

```
backend/src/
├── config/             # Configuration files
│   └── database.ts     # Sequelize connection
├── controllers/        # Business logic per endpoint
│   ├── authController.ts
│   ├── attendanceController.ts
│   ├── adminController.ts
│   └── ...
├── routes/             # Route definitions
│   ├── authRoutes.ts
│   ├── attendanceRoutes.ts
│   ├── adminRoutes.ts
│   └── ...
├── models/             # Sequelize models (database entities)
│   ├── User.ts
│   ├── Teacher.ts
│   ├── Subject.ts
│   └── index.ts       # Model associations
├── middlewares/        # Express middlewares
│   ├── auth.ts        # JWT verification
│   └── auditLog.ts    # Activity logging
├── utils/              # Utility functions
│   ├── jwt.ts         # JWT generation/verification
│   └── geofence.ts    # Geofence validation
└── __tests__/          # Jest tests
    ├── endpoints/     # API endpoint tests
    └── utils/         # Utility function tests
```

### Alur Request-Response

```
Client Request
    ↓
Express Router (routes/)
    ↓
Middleware (auth, validation)
    ↓
Controller (controllers/)
    ↓
Sequelize Model (models/)
    ↓
PostgreSQL Database
    ↓
Response → Client
```

### Grup Endpoint Utama

#### 1. **Authentication Endpoints**

```
POST   /api/auth/login
Request: { username, password }
Response: { token, user: { id, username, role, name, email } }

POST   /api/auth/refresh
Request: { token }
Response: { token }

GET    /api/auth/me
Headers: Authorization: Bearer {token}
Response: { user }
```

#### 2. **Attendance/Scan Endpoints**

```
POST   /api/attendance/scan
Headers: Authorization: Bearer {token}
Request: { 
  sessionId: number, 
  location: { latitude, longitude },
  timestamp: string 
}
Response: { 
  success: boolean, 
  message: string, 
  attendance: { id, status, ... } 
}

GET    /api/attendance/session/:sessionId
Response: { session, teacher, subject, class, ... }
```

**Validasi Backend:**
- ✅ JWT token valid & not expired
- ✅ User role authorized (teacher/admin)
- ✅ Session exists & active
- ✅ Geofence validation (user within school boundary)
- ✅ Schedule validation (time slot & day match)
- ✅ Substitute teacher check (if applicable)
- ✅ Duplicate attendance prevention

#### 3. **Admin Endpoints**

```
# User Management
GET    /api/admin/users
GET    /api/admin/users/validate
POST   /api/admin/users
PUT    /api/admin/users/:id
DELETE /api/admin/users/:id

# Mapel Management
GET    /api/admin/mapel
GET    /api/admin/mapel/validate
POST   /api/admin/mapel
PUT    /api/admin/mapel/:id
DELETE /api/admin/mapel/:id

# Dropdown Data
GET    /api/admin/gurus
GET    /api/admin/classes

# Dashboard Stats
GET    /api/dashboard/stats
Response: {
  stats: {
    todayAttendance: number,
    activeClasses: number,
    presentTeachers: number,
    pendingAttendance: number
  },
  classAttendance: [
    { className, present, total }
  ]
}

GET    /api/dashboard/recent
Response: {
  activities: [
    { id, date, type, studentName, className, subjectName, teacherName, status, markedBy }
  ]
}
```

#### 4. **Schedule Management Endpoints**

```
GET    /api/schedule
POST   /api/schedule
PUT    /api/schedule/:id
DELETE /api/schedule/:id
```

### Contoh Payload Endpoint Penting

#### Create User
```json
POST /api/admin/users
{
  "username": "guru123",
  "password": "hashedPassword",
  "role": "teacher",
  "name": "Budi Santoso",
  "email": "budi@sekolah.sch.id"
}
```

#### Create Mapel
```json
POST /api/admin/mapel
{
  "name": "Matematika",
  "code": "MATH"
}
```

#### Scan QR Attendance
```json
POST /api/attendance/scan
Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIs..." }
{
  "sessionId": 123,
  "location": {
    "latitude": -6.2088,
    "longitude": 106.8456
  },
  "timestamp": "2026-02-09T08:30:00Z"
}
```

---

## 🗄️ Model Data & Database

### Entity Relationship Diagram (ERD)

```
User (Users account)
  │
  ├─ 1:1 → Teacher (Guru info)
  │         │
  │         ├─ 1:N → Schedule (Jadwal mengajar)
  │         │         │
  │         │         ├─ 1:N → Session (Sesi pertemuan)
  │         │         │         │
  │         │         │         ├─ 1:N → StudentAttendance (Absensi siswa)
  │         │         │         │         │
  │         │         │         │         └─ N:1 → User (markedBy)
  │         │         │         │
  │         │         │         └─ 1:N → TeacherAttendance (Absensi guru)
  │         │         │                   │
  │         │         │                   └─ N:1 → Teacher
  │         │         │
  │         │         ├─ 1:N → Class (Kelas)
  │         │         │         │
  │         │         │         └─ 1:N → Student (Siswa)
  │         │         │                   │
  │         │         │                   └─ 1:N → StudentAttendance
  │         │         │
  │         │         └─ 1:N → Subject (Mapel)
  │         │
  │         └─ 1:N → Class (Kelas wali)
  │                   │
  │                   └─ 1:N → Student
  │
  └─ 1:N → ActivityLog (Log aktivitas)

Session
  │
  └─ N:1 → Teacher (substituteTeacherId, optional)
```

### Relasi Antar Entitas

| Entity A | Relasi | Entity B | Deskripsi |
|----------|--------|----------|-----------|
| User | 1:1 | Teacher | Setiap teacher punya user account |
| Teacher | 1:N | Schedule | Guru bisa mengajar di beberapa schedule |
| Class | 1:N | Schedule | Satu kelas punya banyak schedule |
| Subject | 1:N | Schedule | Satu mapel dipakai di banyak schedule |
| Schedule | 1:N | Session | Schedule punya banyak session (pertemuan) |
| Session | 1:N | StudentAttendance | Session punya banyak record absensi siswa |
| Student | 1:N | StudentAttendance | Siswa punya banyak record absensi |
| User | 1:N | StudentAttendance | User yang mencatat absensi siswa |
| Teacher | 1:N | Class | Teacher bisa jadi wali kelas beberapa kelas |
| Class | 1:N | Student | Satu kelas punya banyak siswa |

### Model-Model Utama

#### User
```typescript
{
  id: number
  username: string (unique)
  password: string (bcrypt hashed)
  role: 'admin' | 'teacher'
  name: string
  email: string (unique, optional)
  isActive: boolean
}
```

#### Teacher
```typescript
{
  id: number
  userId: number (FK → User)
  nip: string (unique)
  phone: string
  address: string
}
```

#### Subject (Mapel)
```typescript
{
  id: number
  name: string
  code: string (unique, 3-5 chars)
}
```

#### Schedule
```typescript
{
  id: number
  teacherId: number (FK → Teacher)
  classId: number (FK → Class)
  subjectId: number (FK → Subject)
  day: string (Monday, Tuesday, etc.)
  timeSlotId: number (FK → TimeSlot)
  semester: string
  academicYear: string
}
```

#### Session
```typescript
{
  id: number
  scheduleId: number (FK → Schedule)
  date: Date
  qrCode: string (unique)
  status: 'scheduled' | 'completed' | 'cancelled'
  substituteTeacherId: number (FK → Teacher, optional)
}
```

#### StudentAttendance
```typescript
{
  id: number
  sessionId: number (FK → Session)
  studentId: number (FK → Student)
  status: 'present' | 'absent' | 'late' | 'excused'
  scanLocation: { latitude, longitude }
  scanTime: Date
  markedBy: number (FK → User)
}
```

### Penggunaan Data dalam Alur Sistem

#### 1. Generate QR / Session
```
Admin/Guru → Create Session
    ↓
Schedule data (subject, teacher, class)
    ↓
Generate unique QR code
    ↓
Save to Session model with status 'scheduled'
```

#### 2. Mencatat Kehadiran
```
Siswa/Guru scan QR → Get sessionId
    ↓
Backend validate:
    - JWT token
    - Session exists & active
    - Geofence (user location in school area)
    - Schedule (time slot & day match)
    - Substitute teacher (if applicable)
    ↓
Create StudentAttendance record
    ↓
Update Session status if all students present
```

#### 3. Menampilkan Laporan
```
Admin → /laporan
    ↓
Query StudentAttendance with includes:
    - Student (name, class)
    - Session (date, qrCode)
    - Schedule (subject, teacher, class)
    - Teacher (name)
    ↓
Aggregate & filter by date, class, subject
    ↓
Display in table
```

---

## 🔄 Alur End-to-End Utama

### Skenario 1: Admin Buat User & Mapel

```
1. Admin login → Get JWT token
   ↓
2. Navigate to /admin/users
   ↓
3. Click "Tambah User"
   ↓
4. Fill form: Username, Password, Role, Name, Email
   ↓
5. POST /api/admin/users/validate → Check uniqueness (NIP, Email)
   ↓
6. POST /api/admin/users → Create user in User table
   ↓
7. Navigate to /admin/mapel
   ↓
8. Click "Tambah Mapel"
   ↓
9. Fill form: Name (required), Code (3-5 chars, unique)
   ↓
10. POST /api/admin/mapel/validate → Check uniqueness (name, code)
    ↓
11. POST /api/admin/mapel → Create mapel in Subject table
    ↓
12. Mapel created → Table shows name, code, jadwal count (0)
    ↓
13. Click "Kelola Jadwal" → Navigate to /jadwal?mapelId=XX
```

### Skenario 2: Admin/Guru Buat Session + QR

```
1. Admin/Guru login
   ↓
2. Navigate to /jadwal
   ↓
3. Select or create schedule:
   - Teacher (from dropdown)
   - Class (from dropdown)
   - Subject (from dropdown)
   - TimeSlot
   - Day
   ↓
4. POST /api/schedule → Create Schedule
   ↓
5. Navigate to Session management for this schedule
   ↓
6. Click "Generate QR" for specific date
   ↓
7. POST /api/qr/generate → Create Session with unique QR code
   ↓
8. Display QR code (can be printed/shared)
```

### Skenario 3: Siswa/Guru Scan QR

```
1. Siswa/Guru login → Get JWT token
   ↓
2. Navigate to /scan
   ↓
3. Camera activates (html5-qrcode)
   ↓
4. Scan QR code → Decode to get sessionId
   ↓
5. POST /api/attendance/scan
   {
     sessionId: 123,
     location: { latitude, longitude },
     timestamp: "2026-02-09T08:30:00Z"
   }
   ↓
6. Backend validations:
   ✅ JWT token valid & not expired
   ✅ User role authorized
   ✅ Session exists & status = 'scheduled'
   ✅ Current time matches schedule timeSlot
   ✅ User location within school geofence
   ✅ User hasn't already scanned for this session
   ✅ If substitute teacher assigned, validate accordingly
   ↓
7. Create StudentAttendance record:
   {
     sessionId: 123,
     studentId: 456,
     status: 'present',
     scanLocation: { ... },
     scanTime: "2026-02-09T08:30:05Z",
     markedBy: 789 (admin/guru ID)
   }
   ↓
8. Update Session status if needed
   ↓
9. Log activity in ActivityLog
   ↓
10. Return response:
    {
      success: true,
      message: "Absensi berhasil dicatat",
      attendance: { ... }
    }
```

### Skenario 4: Admin Buka Laporan

```
1. Admin login
   ↓
2. Navigate to /laporan
   ↓
3. Page loads with default filters:
   - Date range: today
   - Class: all
   - Subject: all
   ↓
4. GET /api/attendance/report?date=2026-02-09
   ↓
5. Backend query:
   SELECT * FROM StudentAttendance
   JOIN Session ON StudentAttendance.sessionId = Session.id
   JOIN Schedule ON Session.scheduleId = Schedule.id
   JOIN Student ON StudentAttendance.studentId = Student.id
   JOIN Class ON Student.classId = Class.id
   JOIN Subject ON Schedule.subjectId = Subject.id
   JOIN Teacher ON Schedule.teacherId = Teacher.id
   WHERE Session.date = '2026-02-09'
   ↓
6. Aggregate data:
   - Total attendance per class
   - Attendance per subject
   - Attendance per teacher
   - Present/Absent/Late counts
   ↓
7. Display in table with columns:
   - Date
   - Class
   - Student Name
   - Subject
   - Teacher
   - Status
   - Scan Time
   ↓
8. Export options: PDF/Excel
```

---

## 🧪 Catatan Production & Testing

### Peran Jest Tests (100% Green)

**Konfigurasi Jest:**
```javascript
// backend/jest.config.js
{
  testTimeout: 10000,
  maxWorkers: 1,  // Serial execution untuk menghindari conflicts
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', 'testHelpers\\.ts$']
}
```

**Best Practices Testing:**
1. **Database Isolation**
   - Setiap test menggunakan database terpisah atau clean database
   - `maxWorkers: 1` mencegah race condition antar tests
   - `cleanDatabase()` helper untuk reset setiap test

2. **Data Test Unik**
   - Gunakan random data generation untuk mencegah conflicts
   - Contoh: `user-${Date.now()}@test.com`
   - Hindari hardcoded values yang bisa conflict antar tests

3. **Test Coverage**
   - 23 tests mencakup:
     - Auth endpoints (login, refresh)
     - Attendance endpoints (scan, session)
     - Geofence validation logic
     - Admin endpoints (users, mapel)

4. **Manfaat untuk Production:**
   - ✅ Mencegah regressions saat deploy
   - ✅ Validasi business logic critical path
   - ✅ Dokumentasi behavior sistem
   - ✅ Confident refactoring
   - ✅ Early bug detection sebelum staging

### Deployment Architecture

```
┌─────────────────────────────────────────┐
│         Frontend (Vercel/Netlify)       │
│  - React SPA                            │
│  - Auto-deploy dari Git push            │
│  - CDN global                           │
│  - HTTPS otomatis                       │
└──────────────┬──────────────────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────────────┐
│      Backend (Render/Heroku)            │
│  - Node.js + Express API                │
│  - Auto-deploy dari Git push            │
│  - Health checks                        │
│  - Auto-scaling                         │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│     PostgreSQL (Managed Service)        │
│  - Render/Heroku Postgres               │
│  - Automatic backups                    │
│  - High availability                    │
│  - Connection pooling                   │
└─────────────────────────────────────────┘
```

**Kenapa Stack Ini Cocok?**

1. **Vercel/Netlify untuk Frontend**
   - Zero-config deployment
   - Global CDN untuk performa
   - HTTPS otomatis (gratis)
   - Preview deployments untuk PR
   - Edge functions jika butuh server-side logic
   - Free tier untuk small apps

2. **Render/Heroku untuk Backend**
   - Easy Node.js deployment
   - Environment variables management
   - Auto-restart on crash
   - Free tier available
   - Dukungan PostgreSQL managed
   - Simple git-based deployment

3. **PostgreSQL Managed**
   - ACID compliant
   - Supports complex queries & relations
   - Automatic backups
   - High availability options
   - Connection optimization
   - Scalable (vertical & horizontal)

4. **Cost Effective**
   - Free tiers untuk development/production kecil
   - Pay-as-you-grow scaling
   - Tidak perlu manage infrastructure sendiri
   - Fokus pada business logic, bukan DevOps

5. **Developer Experience**
   - Git-based deployment (simple workflow)
   - Environment parity (dev → staging → prod)
   - Monitoring & logging built-in
   - Easy rollback capabilities

### Production Checklist

- [ ] Environment variables configured:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `FRONTEND_URL` (CORS)
  - `NODE_ENV=production`

- [ ] Database migrations run in production
- [ ] Seeds run for initial data (admin user, etc.)
- [ ] CORS configured to allow frontend domain
- [ ] Rate limiting implemented for API endpoints
- [ ] HTTPS enforced (redirect HTTP → HTTPS)
- [ ] Database backups configured (daily automated)
- [ ] Logging enabled (winston/pino)
- [ ] Health check endpoint (`/health`)
- [ ] Error monitoring (Sentry/New Relic)
- [ ] Frontend environment variables set:
  - `VITE_API_URL`
  - `VITE_APP_TITLE`
- [ ] Build optimization enabled
- [ ] CDN caching configured
- [ ] SSL certificates valid
- [ ] DNS records pointed correctly

---

## 📚 Referensi Tambahan

### File Dokumentasi Penting
- `IMPLEMENTATION_SUMMARY.md` - Progress implementasi terbaru
- `backend/README.md` - Setup backend
- `README.md` - Setup project umum

### Database Schema
- `backend/database-schema.sql` - SQL schema lengkap
- `backend/src/models/` - Sequelize models dengan TypeScript

### Testing
- `backend/__tests__/` - Unit tests
- `cypress/e2e/` - E2E tests
- `backend/jest.config.js` - Jest configuration

### Configuration
- `backend/package.json` - Backend dependencies
- `package.json` - Frontend dependencies
- `vite.config.ts` - Vite configuration
- `tsconfig.json` - TypeScript configuration

---

## 🤝 Onboarding Guide untuk Developer Baru

### Step 1: Setup Local Environment

```bash
# Clone repository
git clone <repo-url>
cd presensiapp2

# Setup Backend
cd backend
npm install
cp .env.example .env
# Edit .env dengan database credentials
npm run migrate
npm run seed-data
npm run dev  # Start backend on port 5000

# Setup Frontend (new terminal)
cd ..
npm install
npm run dev  # Start frontend on port 5173
```

### Step 2: Explore Codebase

1. **Baca file ini (SYSTEM_ARCHITECTURE.md)** untuk pemahaman high-level
2. **Buka frontend di browser** → `http://localhost:5173`
3. **Login dengan admin account** (lihat seed data)
4. **Eksplor halaman-halaman**:
   - `/dashboard` - Overview stats
   - `/admin/users` - Manajemen user
   - `/admin/mapel` - Manajemen mapel
   - `/jadwal` - Manajemen jadwal
   - `/scan` - QR scanner
   - `/laporan` - Laporan

### Step 3: Understanding Data Flow

1. **Buka browser DevTools** → Network tab
2. **Lakukan action di frontend** (misal: create user)
3. **Amati API call** → Request payload, Response
4. **Cek backend controller** untuk implementasi logic
5. **Cek database** untuk melihat data tersimpan

### Step 4: Run Tests

```bash
# Backend tests
cd backend
npm test              # Run all tests
npm run test:coverage # With coverage report

# E2E tests
cd ..
npm run cypress:headless # Run Cypress tests
```

### Step 5: Contribution Workflow

1. **Create branch** dari `main`
2. **Make changes** → Code, Test, Document
3. **Run tests** → Ensure 100% passing
4. **Commit** dengan descriptive message
5. **Push** → Create PR
6. **Code review** → Address feedback
7. **Merge** → Auto-deploy to staging

---

## 🎓 Pertanyaan Umum (FAQ)

**Q: Bagaimana cara menambahkan endpoint baru?**
A: 
1. Add route di `backend/src/routes/`
2. Add controller di `backend/src/controllers/`
3. Add service/API call di `src/services/`
4. Add page/component di `src/pages/`

**Q: Bagaimana cara menambahkan field ke model?**
A:
1. Create migration: `npx sequelize-cli migration:generate --name add-field-to-model`
2. Edit migration file
3. Update model file
4. Run migration: `npm run migrate`

**Q: Bagaimana geofence validation bekerja?**
A: Lihat `backend/src/utils/geofence.ts` dan `backend/__tests__/utils/geofence.test.ts`

**Q: Bagaimana JWT authentication bekerja?**
A: Lihat `backend/src/middlewares/auth.ts` dan `backend/src/utils/jwt.ts`

**Q: Bagaimana cara debug di production?**
A: Gunakan error monitoring (Sentry) + check logs di Render/Heroku dashboard

---

**End of Document**

Untuk pertanyaan lebih lanjut, hubungi Tech Lead atau tim backend/frontend.