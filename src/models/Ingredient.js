import { DataTypes } from "sequelize";

export default (sequelize) => {
    const Ingredient = sequelize.define("Ingredient", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        menuItemId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "MenuItems",
                key: "id",
            },
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: "Ingredient name, e.g. Potatoes, Oil, Besan",
        },
        quantity: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0,
            comment: "Quantity needed per serving",
        },
        unit: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "grams",
            comment: "Unit of measurement: grams, kg, liters, ml, pieces, etc.",
        },
    }, {
        tableName: "ingredients",
        timestamps: true,
    });

    return Ingredient;
};
