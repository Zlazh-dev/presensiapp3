import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface SubjectAttributes {
    id: number;
    code: string;
    name: string;
    description?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

interface SubjectCreationAttributes extends Optional<SubjectAttributes, 'id'> { }

class Subject extends Model<SubjectAttributes, SubjectCreationAttributes> implements SubjectAttributes {
    public id!: number;
    public code!: string;
    public name!: string;
    public description?: string;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

Subject.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        code: {
            type: DataTypes.STRING(20),
            allowNull: false,
            unique: true,
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
    },
    {
        sequelize,
        tableName: 'subjects',
        timestamps: true,
        indexes: [
            { unique: true, fields: ['code'] },
        ],
    }
);

export default Subject;
