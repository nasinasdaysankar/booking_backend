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

      // ========================================
      // PAYMENT & ORDER IDENTIFICATION
      // ========================================
      cashfreeOrderId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: "cashfreeorderid",
      },

      billId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: "billid",
      },

      // ========================================
      // RELATIONSHIPS (Foreign Keys)
      // ========================================
      studentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "studentid",
        references: {
          model: "users",
          key: "id",
        },
      },

      cafeteriaId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "cafeteriaid",
        references: {
          model: "cafeterias",
          key: "id",
        },
      },

      // ========================================
      // AMOUNT & PRICING
      // ========================================
      totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        field: "totalamount",
      },

      platformFee: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.0,
        field: "platform_fee",
      },

      gstAmount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.0,
        field: "gst_amount",
      },

      // ========================================
      // PARCEL INFORMATION
      // ========================================
      isParcel: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "isparcel",
      },

      parcelAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
        field: "parcelamount",
      },

      // ========================================
      // ORDER STATUS
      // ========================================
      status: {
        type: DataTypes.ENUM(
          "PENDING_PAYMENT",
          "PAID",
          "PREPARING",
          "READY",
          "PICKED_UP",
          "COMPLETED",
          "CANCELLED",
          "EXPIRED",
          "REFUND_INITIATED",
          "REFUND_SUCCESS",
          "REFUND_FAILED"
        ),
        defaultValue: "PENDING_PAYMENT",
      },

      paymentStatus: {
        type: DataTypes.ENUM("PENDING", "SUCCESS", "FAILED"),
        defaultValue: "PENDING",
        field: "paymentstatus",
      },

      // ========================================
      // KOT & TRACKING
      // ========================================
      kotNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "kotnumber",
      },

      etaMinutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "etaminutes",
      },

      // ========================================
      // FEEDBACK & NOTIFICATIONS
      // ========================================
      isRated: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "israted",
      },

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

      // ========================================
      // TIMESTAMPS
      // ========================================
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
      tableName: "orders",
      timestamps: true,
      underscored: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        { fields: ["cashfreeorderid"], unique: true },
        { fields: ["billid"], unique: true },
        { fields: ["studentid"] },
        { fields: ["cafeteriaid"] },
        { fields: ["paymentstatus"] },
        { fields: ["status"] },
      ],
    }
  );

  return Order;
};