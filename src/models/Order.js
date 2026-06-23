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
        allowNull: true,
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

      commissionAmount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.0,
        field: "commission_amount",
      },
      
      deliveryCharge: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.0,
        field: "delivery_charge",
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
      // ORDER TYPE: DINE_IN or DELIVERY
      // ========================================
      orderType: {
        type: DataTypes.ENUM("DINE_IN", "DELIVERY"),
        allowNull: false,
        defaultValue: "DINE_IN",
        field: "order_type",
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
          "ASSIGNED",
          "ACCEPTED",
          "PICKED_UP",
          "OUT_FOR_DELIVERY",
          "DELIVERED",
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
      // DELIVERY INFORMATION
      // ========================================
      deliveryPartnerId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "delivery_partner_id",
        references: {
          model: "delivery_partners",
          key: "id",
        },
      },



      deliveryAddress: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "delivery_address",
      },

      roomNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "room_number",
      },

      blockName: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "block_name",
      },

      receiverPhone: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "receiver_phone",
      },

      latitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
      },

      longitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
      },

      deliveryOrderId: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        field: "delivery_order_id",
      },

      // ========================================
      // KOT & TRACKING
      // ========================================
      kotNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "kotnumber",
      },

      dailyOrderNumber: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "daily_order_number",
      },

      totalOrderNumber: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "total_order_number",
      },

      paymentMethod: {
        type: DataTypes.ENUM("ONLINE", "CASH"),
        defaultValue: "ONLINE",
        field: "payment_method",
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

      readyReminderCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "ready_reminder_count",
      },

      // ========================================
      // SUPPORT & EXCEPTIONS
      // ========================================
      supportStatus: {
        type: DataTypes.ENUM("NONE", "UNREACHABLE", "DAMAGED", "ADDRESS_ERROR"),
        defaultValue: "NONE",
        field: "support_status",
      },

      supportReportedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "support_reported_at",
      },

      supportNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "support_notes",
      },

      // ========================================
      // TIMESTAMPS
      // ========================================
      createdAt: {
        type: DataTypes.DATE,
        field: "created_at",
      },
      
      pickedUpAt: {
        type: DataTypes.DATE,
        field: "picked_up_at",
      },
      
      assignedAt: {
        type: DataTypes.DATE,
        field: "assigned_at",
      },

      deliveredAt: {
        type: DataTypes.DATE,
        field: "delivered_at",
      },

      updatedAt: {
        type: DataTypes.DATE,
        field: "updated_at",
      },
      affiliateReward: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: "affiliate_reward",
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