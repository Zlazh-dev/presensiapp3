import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ScheduleAttributes {
    id: number;
    teacherId: number;
    classId: number;
    subjectId: number;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room?: string;
    academicYear: string;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

interface ScheduleCreationAttributes extends Optional<ScheduleAttributes, 'id' | 'isActive'> { }

class Schedule extends Model<ScheduleAttributes, ScheduleCreationAttributes> implements ScheduleAttributes {
    public id!: number;
    public teacherId!: number;
    public classId!: number;
    public subjectId!: number;
    public dayOfWeek!: number;
    public startTime!: string;
    public endTime!: string;
    public room?: string;
    public academicYear!: string;
    public isActive!: boolean;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

Schedule.init(
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
        classId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'classes',
                key: 'id',
            },
            onDelete: 'CASCADE',
        },
        subjectId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'subjects',
                key: 'id',
            },
            onDelete: 'CASCADE',
        },
        dayOfWeek: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1,
                max: 7,
            },
        },
        startTime: {
            type: DataTypes.TIME,
            allowNull: false,
        },
        endTime: {
            type: DataTypes.TIME,
            allowNull: false,
        },
        room: {
            type: DataTypes.STRING(50),
            allowNull: true,
        },
        academicYear: {
            type: DataTypes.STRING(20),
            allowNull: false,
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
    },
    {
        sequelize,
        tableName: 'schedules',
        timestamps: true,
        underscored: false, // Use camelCase in database
        indexes: [
            { fields: ['teacherId'] }, // Use camelCase
            { fields: ['classId'] }, // Use camelCase
            { fields: ['subjectId'] }, // Use camelCase
            { fields: ['dayOfWeek', 'startTime'] }, // Use camelCase
            {
                unique: true,
                fields: ['teacherId', 'dayOfWeek', 'startTime', 'academicYear'], // Use camelCase
                name: 'unique_teacher_schedule'
            },
        ],
    }
);

export default Schedule;
