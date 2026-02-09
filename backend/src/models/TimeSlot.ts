import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface TimeSlotAttributes {
    id: number;
    slotNumber: number;
    startTime: string;
    endTime: string;
    createdAt?: Date;
    updatedAt?: Date;
}

interface TimeSlotCreationAttributes extends Optional<TimeSlotAttributes, 'id'> { }

class TimeSlot extends Model<TimeSlotAttributes, TimeSlotCreationAttributes> implements TimeSlotAttributes {
    public id!: number;
    public slotNumber!: number;
    public startTime!: string;
    public endTime!: string;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

TimeSlot.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        slotNumber: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
            validate: {
                min: 1,
                max: 12,
            },
        },
        startTime: {
            type: DataTypes.STRING(10),
            allowNull: false,
        },
        endTime: {
            type: DataTypes.STRING(10),
            allowNull: false,
        },
    },
    {
        sequelize,
        tableName: 'time_slots',
        timestamps: true,
        indexes: [
            { unique: true, fields: ['slotNumber'] },
        ],
    }
);

export default TimeSlot;
