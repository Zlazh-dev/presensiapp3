import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface AttendanceAttributes {
    id: number;
    userId: number;
    userType: 'teacher' | 'student';
    status: 'Hadir' | 'Sakit' | 'Izin' | 'Alpa';
    date: string;
    checkInTime?: string;
    checkOutTime?: string;
    latitude?: number;
    longitude?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

interface AttendanceCreationAttributes extends Optional<AttendanceAttributes, 'id'> { }

class Attendance extends Model<AttendanceAttributes, AttendanceCreationAttributes>
    implements AttendanceAttributes {
    public id!: number;
    public userId!: number;
    public userType!: 'teacher' | 'student';
    public status!: 'Hadir' | 'Sakit' | 'Izin' | 'Alpa';
    public date!: string;
    public checkInTime?: string;
    public checkOutTime?: string;
    public latitude?: number;
    public longitude?: number;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

Attendance.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        userType: {
            type: DataTypes.ENUM('teacher', 'student'),
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM('Hadir', 'Sakit', 'Izin', 'Alpa'),
            allowNull: false,
            defaultValue: 'Hadir',
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
        latitude: {
            type: DataTypes.DECIMAL(10, 8),
            allowNull: true,
        },
        longitude: {
            type: DataTypes.DECIMAL(11, 8),
            allowNull: true,
        },
    },
    {
        sequelize,
        tableName: 'attendance',
        timestamps: true,
    }
);

export default Attendance;
