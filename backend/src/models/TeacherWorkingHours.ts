import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface TeacherWorkingHoursAttributes {
    id: number;
    teacherId: number;
    dayOfWeek: number; // 1=Senin … 7=Minggu
    startTime: string;
    endTime: string;
    toleranceBeforeMin: number;
    lateAfterMin: number;
    createdAt?: Date;
    updatedAt?: Date;
}

interface TeacherWorkingHoursCreation extends Optional<TeacherWorkingHoursAttributes, 'id'> { }

class TeacherWorkingHours
    extends Model<TeacherWorkingHoursAttributes, TeacherWorkingHoursCreation>
    implements TeacherWorkingHoursAttributes {
    public id!: number;
    public teacherId!: number;
    public dayOfWeek!: number;
    public startTime!: string;
    public endTime!: string;
    public toleranceBeforeMin!: number;
    public lateAfterMin!: number;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

TeacherWorkingHours.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        teacherId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'teachers', key: 'id' },
            onDelete: 'CASCADE',
        },
        dayOfWeek: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: { min: 1, max: 7 },
        },
        startTime: {
            type: DataTypes.STRING(10),
            allowNull: false,
            defaultValue: '07:00',
        },
        endTime: {
            type: DataTypes.STRING(10),
            allowNull: false,
            defaultValue: '15:00',
        },
        toleranceBeforeMin: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 30,
        },
        lateAfterMin: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 5,
        },
    },
    {
        sequelize,
        tableName: 'teacher_working_hours',
        timestamps: true,
        indexes: [
            { unique: true, fields: ['teacherId', 'dayOfWeek'] },
        ],
    }
);

export default TeacherWorkingHours;
