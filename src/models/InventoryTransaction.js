import { DataTypes } from "sequelize";

export default (sequelize) => {
  const InventoryTransaction = sequelize.define(
    "InventoryTransaction",
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

      // Positive value for both IN and OUT — type field tells direction
      quantity: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
      },

      type: {
        type: DataTypes.ENUM("IN", "OUT"),
        allowNull: false,
      },

      // Cost per unit at time of transaction (₹)
      unitCost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: "unit_cost",
      },

      // Total cost for this transaction (quantity × unitCost or COGS for OUT)
      totalCost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: "total_cost",
      },

      // Free-text note for context (e.g., "Weekly restock", "Used for morning batch")
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      // Optional: which batch this IN transaction created (for traceability)
      batchId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "batch_id",
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
      tableName: "inventory_transactions",
      timestamps: true,
      underscored: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        { fields: ["product_id"] },
        { fields: ["product_id", "created_at"] },
        { fields: ["product_id", "type"] },
        { fields: ["created_at"] },
      ],
    }
  );

  return InventoryTransaction;
};
