import User from './User';
import Teacher from './Teacher';
import Class from './Class';
import Student from './Student';
import Subject from './Subject';
import Schedule from './Schedule';
import Session from './Session';
import TeacherAttendance from './TeacherAttendance';
import StudentAttendance from './StudentAttendance';
import ActivityLog from './ActivityLog';
import TimeSlot from './TimeSlot';
import HolidayEvent from './HolidayEvent';
import TeacherWorkingHours from './TeacherWorkingHours';
import Geofence from './Geofence';
import RegistrationToken from './RegistrationToken';

// ... (existing relationships)

export {
    User,
    Teacher,
    Class,
    Student,
    Subject,
    Schedule,
    Session,
    TeacherAttendance,
    StudentAttendance,
    ActivityLog,
    TimeSlot,
    HolidayEvent,
    TeacherWorkingHours,
    Geofence,
    RegistrationToken,
};
User.hasOne(Teacher, { foreignKey: 'userId', as: 'teacher', onDelete: 'CASCADE' });
Teacher.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Teacher <-> Class (1:N as homeroom teacher)
Teacher.hasMany(Class, { foreignKey: 'homeroomTeacherId', as: 'homeroomClasses' });
Class.belongsTo(Teacher, { foreignKey: 'homeroomTeacherId', as: 'homeroomTeacher' });

// Class <-> Student (1:N)
Class.hasMany(Student, { foreignKey: 'classId', as: 'students', onDelete: 'CASCADE' });
Student.belongsTo(Class, { foreignKey: 'classId', as: 'class' });

// Teacher <-> Schedule (1:N)
Teacher.hasMany(Schedule, { foreignKey: 'teacherId', as: 'schedules', onDelete: 'CASCADE' });
Schedule.belongsTo(Teacher, { foreignKey: 'teacherId', as: 'teacher' });

// Class <-> Schedule (1:N)
Class.hasMany(Schedule, { foreignKey: 'classId', as: 'schedules', onDelete: 'CASCADE' });
Schedule.belongsTo(Class, { foreignKey: 'classId', as: 'class' });

// Subject <-> Schedule (1:N)
Subject.hasMany(Schedule, { foreignKey: 'subjectId', as: 'schedules', onDelete: 'CASCADE' });
Schedule.belongsTo(Subject, { foreignKey: 'subjectId', as: 'subject' });

// Schedule <-> Session (1:N)
Schedule.hasMany(Session, { foreignKey: 'scheduleId', as: 'sessions', onDelete: 'CASCADE' });
Session.belongsTo(Schedule, { foreignKey: 'scheduleId', as: 'schedule' });

// Session <-> Teacher (substitute, optional)
Teacher.hasMany(Session, { foreignKey: 'substituteTeacherId', as: 'substituteSessions' });
Session.belongsTo(Teacher, { foreignKey: 'substituteTeacherId', as: 'substituteTeacher' });

// Teacher <-> TeacherAttendance (1:N)
Teacher.hasMany(TeacherAttendance, { foreignKey: 'teacherId', as: 'attendance', onDelete: 'CASCADE' });
TeacherAttendance.belongsTo(Teacher, { foreignKey: 'teacherId', as: 'teacher' });

// Session <-> TeacherAttendance (1:N)
Session.hasMany(TeacherAttendance, { foreignKey: 'sessionId', as: 'teacherAttendance', onDelete: 'CASCADE' });
TeacherAttendance.belongsTo(Session, { foreignKey: 'sessionId', as: 'session' });

// Student <-> StudentAttendance (1:N)
Student.hasMany(StudentAttendance, { foreignKey: 'studentId', as: 'attendance', onDelete: 'CASCADE' });
StudentAttendance.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });

// Session <-> StudentAttendance (1:N)
Session.hasMany(StudentAttendance, { foreignKey: 'sessionId', as: 'studentAttendance', onDelete: 'CASCADE' });
StudentAttendance.belongsTo(Session, { foreignKey: 'sessionId', as: 'session' });

// User <-> StudentAttendance (marked by)
User.hasMany(StudentAttendance, { foreignKey: 'markedBy', as: 'markedAttendance' });
StudentAttendance.belongsTo(User, { foreignKey: 'markedBy', as: 'marker' });

// User <-> ActivityLog (1:N)
User.hasMany(ActivityLog, { foreignKey: 'userId', as: 'activityLogs' });
ActivityLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Class <-> HolidayEvent (1:N, optional)
Class.hasMany(HolidayEvent, { foreignKey: 'classId', as: 'holidays', onDelete: 'SET NULL' });
HolidayEvent.belongsTo(Class, { foreignKey: 'classId', as: 'class' });

// Teacher <-> TeacherWorkingHours (1:N)
Teacher.hasMany(TeacherWorkingHours, { foreignKey: 'teacherId', as: 'workingHours', onDelete: 'CASCADE' });
TeacherWorkingHours.belongsTo(Teacher, { foreignKey: 'teacherId', as: 'teacher' });


