import { DataTypes } from "sequelize";

export default (sequelize) => {
  const InventoryProduct = sequelize.define(
    "InventoryProduct",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      cafeteriaId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "cafeteria_id",
      },

      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      // Fixed unit list: kg, g, litre, ml, piece, packet, dozen
      unit: {
        type: DataTypes.ENUM("kg", "g", "litre", "ml", "piece", "packet", "dozen"),
        allowNull: false,
        defaultValue: "kg",
      },

      category: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      // Low stock alert threshold
      lowStockThreshold: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: true,
        defaultValue: 0,
        field: "low_stock_threshold",
      },

      // Soft delete / archive
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: "is_active",
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
      tableName: "inventory_products",
      timestamps: true,
      underscored: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        { fields: ["cafeteria_id"] },
        { fields: ["cafeteria_id", "is_active"] },
        { fields: ["cafeteria_id", "name"] },
      ],
    }
  );

  return InventoryProduct;
};
