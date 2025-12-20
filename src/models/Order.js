import { DataTypes } from "sequelize";

export default (sequelize) => {
  const Order = sequelize.define("Order", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    cashfreeOrderId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    billId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    studentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    cafeteriaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM(
        "PENDING_PAYMENT",
        "PAID",
        "PREPARING",
        "READY",
        "PICKED_UP",
        "COMPLETED",
        "CANCELLED"
      ),
      defaultValue: "PENDING_PAYMENT",
    },

    paymentStatus: {
      type: DataTypes.ENUM("PENDING", "SUCCESS", "FAILED"),
      defaultValue: "PENDING",
    },

    etaMinutes: DataTypes.INTEGER,

  }, {
    tableName: "orders",
    timestamps: true,
  });

  return Order;
};