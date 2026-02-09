import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface HolidayEventAttributes {
    id: number;
    date: string;       // DATEONLY → 'YYYY-MM-DD'
    reason: string;
    type: 'national' | 'school' | 'meeting';
    classId?: number | null;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

interface HolidayEventCreationAttributes extends Optional<HolidayEventAttributes, 'id' | 'isActive' | 'classId'> { }

class HolidayEvent extends Model<HolidayEventAttributes, HolidayEventCreationAttributes> implements HolidayEventAttributes {
    public id!: number;
    public date!: string;
    public reason!: string;
    public type!: 'national' | 'school' | 'meeting';
    public classId!: number | null;
    public isActive!: boolean;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

HolidayEvent.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        date: {
            type: DataTypes.DATEONLY,
            allowNull: false,
        },
        reason: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        type: {
            type: DataTypes.ENUM('national', 'school', 'meeting'),
            allowNull: false,
            defaultValue: 'school',
        },
        classId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
            references: { model: 'classes', key: 'id' },
            onDelete: 'SET NULL',
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
    },
    {
        sequelize,
        tableName: 'holiday_events',
        timestamps: true,
        indexes: [
            { fields: ['date', 'classId'] },
            { fields: ['date'] },
        ],
    }
);

export default HolidayEvent;
