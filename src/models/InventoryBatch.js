import { DataTypes } from "sequelize";

export default (sequelize) => {
  const InventoryBatch = sequelize.define(
    "InventoryBatch",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "product_id",
        references: {
          model: "inventory_products",
          key: "id",
        },
      },

      // Supports fractional units (e.g., 2.5 kg)
      quantityRemaining: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 0,
        field: "quantity_remaining",
      },

      // Cost per unit when this batch was added
      unitCost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        field: "unit_cost",
      },

      createdAt: {
        type: DataTypes.DATE,
        field: "created_at",
      },

      updatedAt: {
        type: DataTypes.DATE,
        field: "updated_at",
      },

      editReason: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "edit_reason",
      },
    },
    {
      tableName: "inventory_batches",
      timestamps: true,
      underscored: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        // ✅ CRITICAL: This index powers the FIFO ORDER BY query
        { fields: ["product_id", "created_at"] },
        { fields: ["product_id", "quantity_remaining"] },
      ],
    }
  );

  return InventoryBatch;
};
