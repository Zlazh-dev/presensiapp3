import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface StudentAttributes {
    id: number;
    nis: string;
    name: string;
    classId: number;
    dateOfBirth?: Date;
    gender?: 'M' | 'F';
    createdAt?: Date;
    updatedAt?: Date;
}

interface StudentCreationAttributes extends Optional<StudentAttributes, 'id'> { }

class Student extends Model<StudentAttributes, StudentCreationAttributes> implements StudentAttributes {
    public id!: number;
    public nis!: string;
    public name!: string;
    public classId!: number;
    public dateOfBirth?: Date;
    public gender?: 'M' | 'F';
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

Student.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        nis: {
            type: DataTypes.STRING(20),
            allowNull: false,
            unique: true,
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
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
        dateOfBirth: {
            type: DataTypes.DATEONLY,
            allowNull: true,
        },
        gender: {
            type: DataTypes.ENUM('M', 'F'),
            allowNull: true,
        },
    },
    {
        sequelize,
        tableName: 'students',
        timestamps: true,
        underscored: false, // Use camelCase in database
        indexes: [
            { unique: true, fields: ['nis'] },
            { fields: ['classId'] }, // Use camelCase
        ],
    }
);

export default Student;
