import { DataTypes } from "sequelize";

export default (sequelize) => {
  const Commission = sequelize.define(
    "Commission",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      orderId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "orderid",
      },
      cafeteriaId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "cafeteriaid",
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 1.00,
        comment: "Platform commission amount (₹1)",
      },
      vendorAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: "Amount sent to vendor/cafeteria owner",
        field: "vendoramount",
      },
      totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: "Total order amount (commission + vendorAmount)",
        field: "totalamount",
      },
      splitStatus: {
        type: DataTypes.ENUM("PENDING", "SETTLED", "FAILED"),
        defaultValue: "PENDING",
        comment: "Cashfree split settlement status",
        field: "splitstatus",
      },
      settledAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "When Cashfree settled the split to vendor",
        field: "settled_at",
      },
      splitId: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "Cashfree split transaction ID",
        field: "splitid",
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
      tableName: "commissions",
      timestamps: true,
      underscored: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        { fields: ["orderid"] },
        { fields: ["cafeteriaid"] },
        { fields: ["splitstatus"] },
      ],
    }
  );

  return Commission;
};
