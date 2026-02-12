import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface RegistrationTokenAttributes {
    token: string;
    description?: string;
    maxUses?: number; // Null means unlimited
    usedCount: number;
    expiresAt?: Date; // Null means no expiration
    isActive: boolean;
    role: string; // 'teacher', 'admin', etc.
    createdAt?: Date;
    updatedAt?: Date;
}

interface RegistrationTokenCreationAttributes extends Optional<RegistrationTokenAttributes, 'usedCount' | 'isActive'> { }

class RegistrationToken extends Model<RegistrationTokenAttributes, RegistrationTokenCreationAttributes> implements RegistrationTokenAttributes {
    public token!: string;
    public description?: string;
    public maxUses?: number;
    public usedCount!: number;
    public expiresAt?: Date;
    public isActive!: boolean;
    public role!: string;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

RegistrationToken.init(
    {
        token: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        description: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        maxUses: {
            type: DataTypes.INTEGER,
            allowNull: true, // Null = unlimited
        },
        usedCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: true, // Null = never expires
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false,
        },
        role: {
            type: DataTypes.STRING,
            defaultValue: 'teacher',
            allowNull: false,
        },
    },
    {
        sequelize,
        tableName: 'registration_tokens',
        timestamps: true,
    }
);

export default RegistrationToken;
