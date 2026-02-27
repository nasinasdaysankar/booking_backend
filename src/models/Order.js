import { DataTypes } from "sequelize";

export default (sequelize) => {
  const Order = sequelize.define(
    "Order",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      cashfreeOrderId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: "cashfreeorderid",
      },

      parcelAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },

      // Add these fields to your Order model definition
      isParcel: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "isparcel",
      },

      parcelAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        field: "parcelamount",
      },


      billId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: "billid",
      },

      studentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "studentid",
      },

      cafeteriaId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "cafeteriaid",
      },

      totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        field: "totalamount",
      },

      platformFee: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        field: "platform_fee",
      },

      gstAmount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        field: "gst_amount",
      },

      status: {
        type: DataTypes.ENUM(
          "PENDING_PAYMENT",
          "PAID",
          "PREPARING",
          "READY",
          "PICKED_UP",
          "COMPLETED",
          "CANCELLED",
          "EXPIRED"
        ),
        defaultValue: "PENDING_PAYMENT",
      },

      paymentStatus: {
        type: DataTypes.ENUM("PENDING", "SUCCESS", "FAILED"),
        defaultValue: "PENDING",
        field: "paymentstatus",
      },

      etaMinutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "etaminutes",
      },

      kotNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "kotnumber",
      },

      // 🔥🔥 CRITICAL FIX — FEEDBACK FLAG
      isRated: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "israted",
      },

      // 🔔 NOTIFICATION TRACKING FLAGS
      tenMinReminderSent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "tenminremindersent",
      },

      expirationNotificationSent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "expirationnotificationsent",
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
      tableName: "orders", // ⚠️ MUST match DB table name
      timestamps: true,
      underscored: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Order;
};
