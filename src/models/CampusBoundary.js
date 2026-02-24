import { DataTypes } from "sequelize";

export default (sequelize) => {
    const CampusBoundary = sequelize.define(
        "CampusBoundary",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            name: {
                type: DataTypes.STRING(100),
                defaultValue: "Main Campus",
            },
            pointOrder: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: "pointorder",
            },
            latitude: {
                type: DataTypes.DECIMAL(10, 7),
                allowNull: false,
            },
            longitude: {
                type: DataTypes.DECIMAL(10, 7),
                allowNull: false,
            },
            label: {
                type: DataTypes.STRING(255),
                allowNull: true,
            },

            createdAt: {
                type: DataTypes.DATE,
                field: "created_at",
            },

            updatedAt: {
                type: DataTypes.DATE,
                field: "updated_at",
            },
        },
        {
            tableName: "campus_boundaries",
            timestamps: true,
            underscored: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
        }
    );

    return CampusBoundary;
};
