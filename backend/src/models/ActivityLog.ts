import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ActivityLogAttributes {
    id: number;
    userId?: number;
    action: string;
    tableName: string;
    recordId?: number;
    oldValues?: object;
    newValues?: object;
    ipAddress?: string;
    userAgent?: string;
    createdAt?: Date;
}

interface ActivityLogCreationAttributes extends Optional<ActivityLogAttributes, 'id'> { }

class ActivityLog extends Model<ActivityLogAttributes, ActivityLogCreationAttributes>
    implements ActivityLogAttributes {
    public id!: number;
    public userId?: number;
    public action!: string;
    public tableName!: string;
    public recordId?: number;
    public oldValues?: object;
    public newValues?: object;
    public ipAddress?: string;
    public userAgent?: string;
    public readonly createdAt!: Date;
}

ActivityLog.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id',
            },
            onDelete: 'SET NULL',
        },
        action: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        tableName: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        recordId: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        oldValues: {
            type: DataTypes.JSONB,
            allowNull: true,
        },
        newValues: {
            type: DataTypes.JSONB,
            allowNull: true,
        },
        ipAddress: {
            type: DataTypes.STRING(45),
            allowNull: true,
        },
        userAgent: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
    },
    {
        sequelize,
        tableName: 'activity_logs',
        timestamps: true,
        underscored: false, // Use camelCase in database
        updatedAt: false,
        indexes: [
            { fields: ['userId'] }, // Use camelCase
            { fields: ['action'] },
            { fields: ['tableName'] }, // Use camelCase
            { fields: ['createdAt'] }, // Use camelCase
        ],
    }
);

export default ActivityLog;
