import { DataTypes } from "sequelize";

export default (sequelize) => {
  const Payment = sequelize.define("Payment", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    orderId: { type: DataTypes.INTEGER, allowNull: false },
    billId: { type: DataTypes.STRING, allowNull: false },

    cafeteriaId: { type: DataTypes.INTEGER, allowNull: false },

    paymentGateway: { type: DataTypes.STRING },
    paymentId: { type: DataTypes.STRING },
    cashfreeOrderId: { type: DataTypes.STRING },  
    transactionId: { type: DataTypes.STRING },

    amount: { type: DataTypes.DECIMAL(10, 2) },

    status: {
      type: DataTypes.ENUM("SUCCESS", "FAILED", "PENDING"),
      defaultValue: "PENDING",
    },

    paidAt: { type: DataTypes.DATE },
  }, {
    tableName: "payments",
    timestamps: true,
  });

  return Payment;
};
