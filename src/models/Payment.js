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
      allowNull: false 
    },
    
    billId: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },

    cafeteriaId: { 
      type: DataTypes.INTEGER, 
      allowNull: false 
    },

    paymentGateway: { 
      type: DataTypes.STRING,
      defaultValue: "CASHFREE"
    },
    
    paymentId: { 
      type: DataTypes.STRING,
      comment: "Real Cashfree payment ID (pay_xxx) - comes from webhook"
    },
    
    cashfreeOrderId: { 
      type: DataTypes.STRING,
      comment: "Cashfree order ID (ORDER_xxx)"
    },
    
    transactionId: { 
      type: DataTypes.STRING 
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
      comment: "Cashfree refund ID returned after refund initiation"
    },

    refundedAt: { 
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When refund was initiated"
    },

    refundAmount: { 
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Amount refunded (may differ from original)"
    },

    paidAt: { 
      type: DataTypes.DATE,
      allowNull: true
    },

  }, {
    tableName: "payments",
    timestamps: true,
    indexes: [
      { fields: ["cashfreeOrderId"], unique: true },
      { fields: ["paymentId"] },
      { fields: ["orderId"] },
      { fields: ["refundId"] }
    ]
  });

  return Payment;
};