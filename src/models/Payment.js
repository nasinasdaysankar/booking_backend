import { DataTypes } from "sequelize";

export default (sequelize) => {
  const Payment = sequelize.define("Payment", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },

    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "orderid"
    },

    billId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "billid"
    },

    cafeteriaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "cafeteriaid"
    },

    paymentGateway: {
      type: DataTypes.STRING,
      defaultValue: "CASHFREE",
      field: "paymentgateway"
    },

    paymentId: {
      type: DataTypes.STRING,
      comment: "Real Cashfree payment ID (pay_xxx) - comes from webhook",
      field: "paymentid"
    },

    cashfreeOrderId: {
      type: DataTypes.STRING,
      comment: "Cashfree order ID (ORDER_xxx)",
      field: "cashfreeorderid"
    },

    transactionId: {
      type: DataTypes.STRING,
      field: "transactionid"
    },

    amount: {
      type: DataTypes.DECIMAL(10, 2)
    },

    status: {
      type: DataTypes.ENUM(
        "PENDING",
        "SUCCESS",
        "FAILED",
        "REFUND_INITIATED",
        "REFUND_SUCCESS",
        "REFUND_FAILED"
      ),
      defaultValue: "PENDING",
      comment: "Payment or refund status"
    },

    // ✅ REFUND FIELDS
    refundId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Cashfree refund ID returned after refund initiation",
      field: "refundid"
    },

    refundedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When refund was initiated",
      field: "refunded_at"
    },

    refundAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Amount refunded (may differ from original)",
      field: "refundamount"
    },

    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "paid_at"
    },

    createdAt: {
      type: DataTypes.DATE,
      field: "created_at"
    },

    updatedAt: {
      type: DataTypes.DATE,
      field: "updated_at"
    },

  }, {
    tableName: "payments",
    timestamps: true,
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { fields: ["cashfreeorderid"], unique: true },
      { fields: ["paymentid"] },
      { fields: ["orderid"] },
      { fields: ["refundid"] }
    ]
  });

  return Payment;
};