import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ClassAttributes {
    id: number;
    name: string;
    level: number;
    academicYear: string;
    homeroomTeacherId?: number;
    qrCodeData?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
}

interface ClassCreationAttributes extends Optional<ClassAttributes, 'id' | 'academicYear'> { }

class Class extends Model<ClassAttributes, ClassCreationAttributes> implements ClassAttributes {
    public id!: number;
    public name!: string;
    public level!: number;
    public academicYear!: string;
    public homeroomTeacherId?: number;
    public qrCodeData?: string | null;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

Class.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        level: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        academicYear: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: new Date().getFullYear() + '/' + (new Date().getFullYear() + 1), // e.g., "2026/2027"
        },
        homeroomTeacherId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'teachers',
                key: 'id',
            },
            onDelete: 'SET NULL',
        },
        qrCodeData: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    },
    {
        sequelize,
        tableName: 'classes',
        timestamps: true,
        underscored: false, // Use camelCase in database
        indexes: [
            { fields: ['level'] },
            { fields: ['academicYear'] }, // Use camelCase
            { fields: ['homeroomTeacherId'] }, // Use camelCase
        ],
    }
);

export default Class;
