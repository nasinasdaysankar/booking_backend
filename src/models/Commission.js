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
      },
      cafeteriaId: {
        type: DataTypes.INTEGER,
        allowNull: true,
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
      },
      totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: "Total order amount (commission + vendorAmount)",
      },
      splitStatus: {
        type: DataTypes.ENUM("PENDING", "SETTLED", "FAILED"),
        defaultValue: "PENDING",
        comment: "Cashfree split settlement status",
      },
      settledAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "When Cashfree settled the split to vendor",
      },
      splitId: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "Cashfree split transaction ID",
      },
    },
    {
      tableName: "commissions",
      timestamps: true,
      indexes: [
        { fields: ["orderId"] },
        { fields: ["cafeteriaId"] },
        { fields: ["splitStatus"] },
      ],
    }
  );

  return Commission;
};
