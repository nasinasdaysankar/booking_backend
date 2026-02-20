import { DataTypes } from "sequelize";

export default (sequelize) => {
    const InventoryLog = sequelize.define(
        "InventoryLog",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },

            menuItemId: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },

            cafeteriaId: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },

            changeType: {
                type: DataTypes.ENUM(
                    "RESTOCK",
                    "ORDER_DEDUCTION",
                    "MANUAL_ADJUST",
                    "WASTAGE"
                ),
                allowNull: false,
            },

            quantity: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },

            previousStock: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },

            newStock: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },

            reason: {
                type: DataTypes.STRING,
                allowNull: true,
            },
        },
        {
            tableName: "inventory_logs",
            timestamps: true,
            indexes: [
                { fields: ["menuItemId"] },
                { fields: ["cafeteriaId"] },
                { fields: ["changeType"] },
                { fields: ["createdAt"] },
            ],
        }
    );

    return InventoryLog;
};
