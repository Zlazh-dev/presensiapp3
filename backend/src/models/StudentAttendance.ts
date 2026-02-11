import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface StudentAttendanceAttributes {
    id: number;
    studentId: number;
    sessionId: number;
    status: 'present' | 'absent' | 'sick' | 'permission' | 'late' | 'alpha';
    markedAt?: Date;
    markedBy?: number;
    notes?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

interface StudentAttendanceCreationAttributes extends Optional<StudentAttendanceAttributes, 'id'> { }

class StudentAttendance extends Model<StudentAttendanceAttributes, StudentAttendanceCreationAttributes>
    implements StudentAttendanceAttributes {
    public id!: number;
    public studentId!: number;
    public sessionId!: number;
    public status!: 'present' | 'absent' | 'sick' | 'permission' | 'late' | 'alpha';
    public markedAt?: Date;
    public markedBy?: number;
    public notes?: string;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

StudentAttendance.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        studentId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'students',
                key: 'id',
            },
            onDelete: 'CASCADE',
        },
        sessionId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'sessions',
                key: 'id',
            },
            onDelete: 'CASCADE',
        },
        status: {
            type: DataTypes.ENUM('present', 'absent', 'sick', 'permission', 'late', 'alpha'),
            allowNull: false,
        },
        markedAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        markedBy: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id',
            },
            onDelete: 'SET NULL',
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
    },
    {
        sequelize,
        tableName: 'student_attendance',
        timestamps: true,
        underscored: false, // Use camelCase in database
        indexes: [
            { fields: ['studentId'] }, // Use camelCase
            { fields: ['sessionId'] }, // Use camelCase
            { fields: ['status'] },
            {
                unique: true,
                fields: ['studentId', 'sessionId'], // Use camelCase
                name: 'unique_student_session_attendance'
            },
        ],
    }
);

export default StudentAttendance;
