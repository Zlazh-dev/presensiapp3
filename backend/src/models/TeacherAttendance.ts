import { DataTypes, Model, Optional, Op } from 'sequelize';
import sequelize from '../config/database';

interface TeacherAttendanceAttributes {
    id: number;
    teacherId: number;
    sessionId?: number;
    date: string;
    checkInTime?: string;
    checkOutTime?: string;
    status: 'present' | 'absent' | 'sick' | 'permission' | 'late' | 'alpha';
    lateMinutes?: number;
    earlyCheckoutMinutes?: number;
    latitude?: number;
    longitude?: number;
    notes?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

interface TeacherAttendanceCreationAttributes extends Optional<TeacherAttendanceAttributes, 'id'> { }

class TeacherAttendance extends Model<TeacherAttendanceAttributes, TeacherAttendanceCreationAttributes>
    implements TeacherAttendanceAttributes {
    public id!: number;
    public teacherId!: number;
    public sessionId?: number;
    public date!: string;
    public checkInTime?: string;
    public checkOutTime?: string;
    public status!: 'present' | 'absent' | 'sick' | 'permission' | 'late' | 'alpha';
    public lateMinutes?: number;
    public earlyCheckoutMinutes?: number;
    public latitude?: number;
    public longitude?: number;
    public notes?: string;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    // Associations
    public session?: any; // Start with any to avoid circular dependency issues or just Session

}

TeacherAttendance.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        teacherId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'teachers',
                key: 'id',
            },
            onDelete: 'CASCADE',
        },
        sessionId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'sessions',
                key: 'id',
            },
            onDelete: 'SET NULL',
        },
        date: {
            type: DataTypes.DATEONLY,
            allowNull: false,
        },
        checkInTime: {
            type: DataTypes.TIME,
            allowNull: true,
        },
        checkOutTime: {
            type: DataTypes.TIME,
            allowNull: true,
        },
        status: {
            type: DataTypes.ENUM('present', 'absent', 'sick', 'permission', 'late', 'alpha'),
            allowNull: false,
        },
        lateMinutes: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
        },
        earlyCheckoutMinutes: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
        },
        latitude: {
            type: DataTypes.DECIMAL(10, 8),
            allowNull: true,
        },
        longitude: {
            type: DataTypes.DECIMAL(11, 8),
            allowNull: true,
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
    },
    {
        sequelize,
        tableName: 'teacher_attendance',
        timestamps: true,
        underscored: false, // Use camelCase in database
        indexes: [
            { fields: ['teacherId'] }, // Use camelCase
            { fields: ['sessionId'] }, // Use camelCase
            { fields: ['date'] },
            // New Partial Indexes:
            {
                unique: true,
                fields: ['teacherId', 'date'],
                where: { sessionId: null },
                name: 'unique_teacher_regular_attendance',
            },
            {
                unique: true,
                fields: ['teacherId', 'sessionId'],
                where: { sessionId: { [Op.ne]: null } },
                name: 'unique_teacher_session_attendance',
            }
        ],
    }
);

export default TeacherAttendance;
