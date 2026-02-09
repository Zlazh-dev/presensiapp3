import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

interface GeofenceAttributes {
    id: number;
    label: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

class Geofence extends Model<GeofenceAttributes> implements GeofenceAttributes {
    public id!: number;
    public label!: string;
    public latitude!: number;
    public longitude!: number;
    public radiusMeters!: number;
    public isActive!: boolean;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

Geofence.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        label: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'Sekolah',
        },
        latitude: {
            type: DataTypes.DECIMAL(10, 7),
            allowNull: false,
        },
        longitude: {
            type: DataTypes.DECIMAL(10, 7),
            allowNull: false,
        },
        radiusMeters: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 100,
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
    },
    {
        sequelize,
        tableName: 'geofences',
        timestamps: true,
    }
);

export default Geofence;
