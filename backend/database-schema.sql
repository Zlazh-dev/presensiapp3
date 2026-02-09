# Enhanced Database Schema - SQL Creation Script

This document contains the SQL DDL statements for creating the enhanced database schema with all tables, indexes, and foreign key constraints.

## Create Tables

```sql
-- 1. Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'teacher')),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_role ON users(role);

-- 2. Teachers table
CREATE TABLE teachers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL,
    employee_id VARCHAR(20) UNIQUE NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_teachers_user_id ON teachers(user_id);
CREATE UNIQUE INDEX idx_teachers_employee_id ON teachers(employee_id);

-- 3. Subjects table
CREATE TABLE subjects (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_subjects_code ON subjects(code);

-- 4. Classes table
CREATE TABLE classes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    level INTEGER NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    homeroom_teacher_id INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (homeroom_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
);

CREATE INDEX idx_classes_level ON classes(level);
CREATE INDEX idx_classes_academic_year ON classes(academic_year);
CREATE INDEX idx_classes_homeroom_teacher ON classes(homeroom_teacher_id);

-- 5. Students table
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    nis VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    class_id INTEGER NOT NULL,
    date_of_birth DATE,
    gender CHAR(1) CHECK (gender IN ('M', 'F')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_students_nis ON students(nis);
CREATE INDEX idx_students_class_id ON students(class_id);

-- 6. Schedules table
CREATE TABLE schedules (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room VARCHAR(50),
    academic_year VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

CREATE INDEX idx_schedules_teacher ON schedules(teacher_id);
CREATE INDEX idx_schedules_class ON schedules(class_id);
CREATE INDEX idx_schedules_subject ON schedules(subject_id);
CREATE INDEX idx_schedules_time ON schedules(day_of_week, start_time);
CREATE UNIQUE INDEX idx_unique_teacher_schedule ON schedules(teacher_id, day_of_week, start_time, academic_year);

-- 7. Sessions table
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER NOT NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME,
    status VARCHAR(20) NOT NULL CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')) DEFAULT 'scheduled',
    topic VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_schedule ON sessions(schedule_id);
CREATE INDEX idx_sessions_date ON sessions(date);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE UNIQUE INDEX idx_unique_session_per_day ON sessions(schedule_id, date);

-- 8. Teacher Attendance table
CREATE TABLE teacher_attendance (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL,
    session_id INTEGER,
    date DATE NOT NULL,
    check_in_time TIME,
    check_out_time TIME,
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'sick', 'permission', 'late')),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

CREATE INDEX idx_teacher_attendance_teacher ON teacher_attendance(teacher_id);
CREATE INDEX idx_teacher_attendance_session ON teacher_attendance(session_id);
CREATE INDEX idx_teacher_attendance_date ON teacher_attendance(date);
CREATE UNIQUE INDEX idx_unique_teacher_daily ON teacher_attendance(teacher_id, date);

-- 9. Student Attendance table
CREATE TABLE student_attendance (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL,
    session_id INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'sick', 'permission', 'late')),
    marked_at TIMESTAMP,
    marked_by INTEGER,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_student_attendance_student ON student_attendance(student_id);
CREATE INDEX idx_student_attendance_session ON student_attendance(session_id);
CREATE INDEX idx_student_attendance_status ON student_attendance(status);
CREATE UNIQUE INDEX idx_unique_student_session ON student_attendance(student_id, session_id);

-- 10. Activity Logs table
CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_table ON activity_logs(table_name);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at);
```

## Entity Relationship Diagram (Text Format)

```
users (1) ──→ (1) teachers
teachers (1) ──→ (N) classes [as homeroom_teacher]
teachers (1) ──→ (N) schedules
teachers (1) ──→ (N) teacher_attendance

classes (1) ──→ (N) students
classes (1) ──→ (N) schedules

subjects (1) ──→ (N) schedules

schedules (1) ──→ (N) sessions

sessions (1) ──→ (0..1) teacher_attendance
sessions (1) ──→ (N) student_attendance

students (1) ──→ (N) student_attendance

users (1) ──→ (N) student_attendance [as marked_by]
users (1) ──→ (N) activity_logs
```

## Key Features

### Indexes for Performance
- **Primary keys** on all tables (automatic B-tree indexes)
- **Unique indexes** on usernames, emails, employee IDs, NIS, subject codes
- **Foreign key indexes** for join performance
- **Composite indexes** for preventing double-booking and duplicate sessions
- **Time-based indexes** for schedule and attendance queries

### Constraints
- **Foreign Keys** with appropriate CASCADE and SET NULL behaviors
- **Check Constraints** for enums and valid ranges
- **Unique Constraints** to prevent duplicates

### Data Integrity
- Cascading deletes where appropriate (e.g., deleting a class deletes its students)
- SET NULL for optional references (e.g., homeroom teacher)
- JSONB for flexible audit log storage
