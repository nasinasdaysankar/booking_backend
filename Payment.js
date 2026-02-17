export default (sequelize) => {
  const Payment = sequelize.define("Payment", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    orderId: { type: DataTypes.INTEGER, allowNull: false },
    billId: { type: DataTypes.STRING, allowNull: false },

    cafeteriaId: { type: DataTypes.INTEGER, allowNull: false },

    paymentGateway: { type: DataTypes.STRING }, // CASHFREE
    paymentId: { type: DataTypes.STRING },      // From Cashfree
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
  //we are doing the payment confirmation in the payment.js file

  return Payment;
};
