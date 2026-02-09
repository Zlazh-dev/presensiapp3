import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface SessionAttributes {
    id: number;
    scheduleId: number;
    date: string;
    startTime: string;
    endTime?: string;
    status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
    substituteTeacherId?: number | null;
    topic?: string;
    notes?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

interface SessionCreationAttributes extends Optional<SessionAttributes, 'id' | 'status' | 'substituteTeacherId'> { }

class Session extends Model<SessionAttributes, SessionCreationAttributes> implements SessionAttributes {
    public id!: number;
    public scheduleId!: number;
    public date!: string;
    public startTime!: string;
    public endTime?: string;
    public status!: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
    public substituteTeacherId?: number | null;
    public topic?: string;
    public notes?: string;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

Session.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        scheduleId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'schedules',
                key: 'id',
            },
            onDelete: 'CASCADE',
        },
        date: {
            type: DataTypes.DATEONLY,
            allowNull: false,
        },
        startTime: {
            type: DataTypes.TIME,
            allowNull: false,
        },
        endTime: {
            type: DataTypes.TIME,
            allowNull: true,
        },
        status: {
            type: DataTypes.ENUM('scheduled', 'ongoing', 'completed', 'cancelled'),
            allowNull: false,
            defaultValue: 'scheduled',
        },
        topic: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        substituteTeacherId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
            references: { model: 'teachers', key: 'id' },
            onDelete: 'SET NULL',
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
    },
    {
        sequelize,
        tableName: 'sessions',
        timestamps: true,
        underscored: false, // Use camelCase in database
        indexes: [
            { fields: ['scheduleId'] }, // Use camelCase
            { fields: ['date'] },
            { fields: ['status'] },
            {
                unique: true,
                fields: ['scheduleId', 'date'], // Use camelCase
                name: 'unique_schedule_date'
            },
        ],
    }
);

export default Session;
