import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface TeacherAttributes {
    id: number;
    userId: number;
    employeeId: string;
    phone?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

interface TeacherCreationAttributes extends Optional<TeacherAttributes, 'id'> { }

class Teacher extends Model<TeacherAttributes, TeacherCreationAttributes> implements TeacherAttributes {
    public id!: number;
    public userId!: number;
    public employeeId!: string;
    public phone?: string;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

Teacher.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
            field: 'userId', // Explicitly use camelCase in database
            references: {
                model: 'users',
                key: 'id',
            },
            onDelete: 'CASCADE',
        },
        employeeId: {
            type: DataTypes.STRING(20),
            allowNull: false,
            unique: true,
            field: 'employeeId', // Explicitly use camelCase in database
        },
        phone: {
            type: DataTypes.STRING(20),
            allowNull: true,
        },
    },
    {
        sequelize,
        tableName: 'teachers',
        timestamps: true,
        underscored: false, // DO NOT convert camelCase to snake_case
        indexes: [
            { unique: true, fields: ['userId'] },
            { unique: true, fields: ['employeeId'] },
        ],
    }
);

export default Teacher;
