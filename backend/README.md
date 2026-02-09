# Presensi App Backend - Enhanced Database

Backend API for the Presensi App with enhanced database schema supporting sessions, sophisticated attendance tracking, and audit logging.

## Database Schema

### Tables Overview
- **users** - User accounts (admin/teacher)
- **teachers** - Teacher details
- **classes** - School classes  
- **students** - Student records
- **subjects** - Academic subjects
- **schedules** - Weekly class schedules
- **sessions** - Actual class sessions (instantiated from schedules)
- **teacher_attendance** - Teacher attendance with geolocation
- **student_attendance** - Student attendance per session
- **activity_logs** - Complete audit trail

### Key Features
- ✅ **Session-based Attendance** - Track attendance per class session
- ✅ **Separate Teacher/Student Attendance** - Different tracking for teachers and students
- ✅ **Audit Logging** - JSONB-based activity logs for all operations
- ✅ **Optimized Indexes** - Performance-tuned queries
- ✅ **Referential Integrity** - Proper foreign keys with cascade rules
- ✅ **Academic Year Tracking** - Multi-year support

## Prerequisites

- Node.js v20.x (LTS)
- Docker Desktop (for PostgreSQL)
- PostgreSQL 16

## Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your configuration if needed
```

### 3. Start PostgreSQL
```bash
# Make sure Docker Desktop is running first
docker-compose up -d
```

Wait a few seconds for PostgreSQL to start, then verify:
```bash
docker ps  # Should show presensi_postgres running
```

### 4. Seed the Database
```bash
npm run seed-data
```

This will:
- Drop and recreate all tables
- Create 1 admin and 3 teachers
- Create 3 classes with homeroom teachers
- Create 6 subjects
- Create 8 students
- Create sample schedules
- Create sample sessions and attendance

### 5. Run Development Server
```bash
npm run dev
```

Server runs on http://localhost:5000

## Default Credentials

After running `npm run seed-data`:

| Role | Username | Password | Email |
|------|----------|----------|-------|
| Admin | admin | admin123 | admin@presensi.school |
| Teacher | budi | budi123 | budi@presensi.school |
| Teacher | siti | siti123 | siti@presensi.school |
| Teacher | rudi | rudi123 | rudi@presensi.school |

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login (returns JWT token)
- `GET /api/auth/me` - Get current user info

### Classes
- `GET /api/classes` - List all classes
- `POST /api/classes` - Create class (admin only)
- `PUT /api/classes/:id` - Update class
- `DELETE /api/classes/:id` - Delete class

### Students
- `GET /api/students` - List students
- `GET /api/students?classId=X` - Filter by class
- `POST /api/students` - Create student
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student

### Teachers
- `GET /api/teachers` - List teachers
- `POST /api/teachers` - Create teacher
- `PUT /api/teachers/:id` - Update teacher
- `DELETE /api/teachers/:id` - Delete teacher

### Subjects
- `GET /api/subjects` - List subjects
- `POST /api/subjects` - Create subject
- `PUT /api/subjects/:id` - Update subject
- `DELETE /api/subjects/:id` - Delete subject

### Schedules
- `GET /api/schedules` - List schedules
- `GET /api/schedules?teacherId=X` - Filter by teacher
- `GET /api/schedules?classId=X` - Filter by class
- `POST /api/schedules` - Create schedule
- `PUT /api/schedules/:id` - Update schedule
- `DELETE /api/schedules/:id` - Delete schedule

### Sessions
- `GET /api/sessions` - List sessions
- `GET /api/sessions?date=YYYY-MM-DD` - Filter by date
- `POST /api/sessions` - Create session
- `PUT /api/sessions/:id` - Update session (mark as completed, etc.)
- `DELETE /api/sessions/:id` - Delete session

### Teacher Attendance
- `POST /api/attendance/teacher/scan` - Record teacher check-in/check-out
  - Validates geofence
  - Auto-detects check-in vs check-out
- `GET /api/attendance/teacher?date=YYYY-MM-DD` - Get teacher attendance by date
- `GET /api/attendance/teacher/:teacherId` - Get teacher attendance history

### Student Attendance
- `POST /api/attendance/student/mark` - Mark student attendance for a session
- `GET /api/attendance/student/:sessionId` - Get all students' attendance for a session
- `GET /api/attendance/student/student/:studentId` - Get student attendance history

### Reports
- `GET /api/reports/attendance/csv?startDate=X&endDate=Y` - Export CSV
- `GET /api/reports/attendance/xlsx?startDate=X&endDate=Y` - Export XLSX

### Activity Logs
- `GET /api/logs` - Get activity logs (admin only)
- `GET /api/logs?userId=X` - Filter by user
- `GET /api/logs?action=CREATE` - Filter by action

## Testing with cURL

### 1. Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Save the token from response.

### 2. Get Classes
```bash
curl -X GET http://localhost:5000/api/classes \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Record Teacher Attendance
```bash
curl -X POST http://localhost:5000/api/attendance/teacher/scan \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "teacherId": 1,
    "latitude": -6.2088,
    "longitude": 106.8456
  }'
```

## Database Schema Diagram

See `database-schema.sql` for complete SQL DDL and relationship diagram.

## Development Scripts

- `npm run dev` - Start development server with hot-reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run seed-data` - Seed database with test data

## Docker Commands

```bash
# Start PostgreSQL
docker-compose up -d

# Stop PostgreSQL
docker-compose down

# View logs
docker-compose logs -f

# Access PostgreSQL CLI
docker exec -it presensi_postgres psql -U presensi_user -d presensi_db
```

## Environment Variables

See `.env.example` for all available configuration options:
- Database connection
- JWT secret and expiration
- Geofence settings (lat/lng/radius)
- Working hours

## Architecture Highlights

### Session-Based Attendance
Unlike the initial simple schema, the enhanced version tracks actual class sessions:
1. **Schedules** define recurring weekly patterns
2. **Sessions** are instantiated from schedules for specific dates
3. **Student Attendance** is marked per session (not per day)
4. **Teacher Attendance** can be session-specific or general

### Audit Logging
All CRUD operations are automatically logged to `activity_logs`:
- User who performed the action
- Timestamp
- Old and new values (JSONB)
- IP address and user agent

### Optimized Performance
- Indexes on all foreign keys
- Composite indexes for common query patterns
- Unique constraints prevent data duplication
- Check constraints ensure data validity

## License

MIT
