import { DataTypes } from "sequelize";

export default (sequelize) => {
    const Inventory = sequelize.define(
        "Inventory",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },

            menuItemId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                unique: true,
            },

            cafeteriaId: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },

            currentStock: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },

            lowStockThreshold: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 5,
            },

            unit: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: "plates",
            },

            autoDisable: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },

            lastRestockedAt: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: "inventory",
            timestamps: true,
            indexes: [
                { fields: ["menuItemId"], unique: true },
                { fields: ["cafeteriaId"] },
                { fields: ["currentStock"] },
            ],
        }
    );

    return Inventory;
};
