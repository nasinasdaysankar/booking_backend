import { DataTypes } from "sequelize";
import bcrypt from "bcryptjs";


export default (sequelize) => {
  const Cafeteria = sequelize.define(
    "Cafeteria",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },

      // ✅ FIXED LOCATION (Anantha Aahara)
      latitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
      },

      longitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
      },

      isOpen: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: "isopen",
      },
      isOffline: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: "is_offline",
      },
      isOnlineOrderEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: "is_online_order_enabled",
      },

      isUserVisible: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: "isuservisible",
      },



      isInsideCampus: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: "isinsidecampus",
      },

      campusName: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: "campus_name",
      },

      ownerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "ownerid",
      },

      gstType: {
        type: DataTypes.ENUM("fixed", "percentage"),
        defaultValue: "percentage",
        field: "gst_type",
      },
      gstAmount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 5.00,
        field: "gst_amount",
      },

      platformFeeType: {
        type: DataTypes.ENUM("fixed", "percentage"),
        defaultValue: "fixed",
        field: "platform_fee_type",
      },
      platformFeeAmount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 1.00,
        field: "platform_fee_amount",
      },

      commissionType: {
        type: DataTypes.ENUM("fixed", "percentage"),
        defaultValue: "fixed",
        field: "commission_type",
      },
      commissionAmount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 1.00,
        field: "commission_amount",
      },

      createdAt: {
        type: DataTypes.DATE,
        field: "created_at",
      },

      updatedAt: {
        type: DataTypes.DATE,
        field: "updated_at",
      },

      promoVideoUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: "promo_video_url",
      },

      promoImageUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: "promo_image_url",
      },
      showGst: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: "show_gst",
      },
      showPlatformFee: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: "show_platform_fee",
      },
      showCommission: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: "show_commission",
      },
      fssaiLicense: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: "fssai_license",
      },
      bufferTime: {
        type: DataTypes.INTEGER,
        defaultValue: 20,
        field: "buffer_time",
      },
      isBusy: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: "is_busy",
      },
      openTime: {
        type: DataTypes.STRING(5),
        allowNull: true,
        field: "open_time",
      },
      closeTime: {
        type: DataTypes.STRING(5),
        allowNull: true,
        field: "close_time",
      },
      visibilityRadius: {
        type: DataTypes.DOUBLE,
        defaultValue: 10,
        field: "visibility_radius",
      },
      requestedVisibilityRadius: {
        type: DataTypes.DOUBLE,
        allowNull: true,
        field: "requested_visibility_radius",
      },
      radiusRequestStatus: {
        type: DataTypes.ENUM("none", "pending", "approved", "rejected"),
        defaultValue: "none",
        field: "radius_request_status",
      },
      radiusRequestFeedback: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "radius_request_feedback",
      },
      isPureVeg: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: "is_pure_veg",
      },
      promoImageUrl2: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: "promo_image_url_2",
      },
      ownerPin: {
        type: DataTypes.STRING,
        allowNull: true, // Optional initially
        field: "owner_pin",
      },
      deliveryFee: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 20.00,
        field: "delivery_fee",
      },
      isDeliveryEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: "is_delivery_enabled",
      },
      isDineInEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: "is_dine_in_enabled",
      },
      isCampusOnly: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: "is_campus_only",
      },
    },

    {
      tableName: "cafeterias",
      timestamps: true,
      underscored: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      hooks: {
        beforeCreate: async (cafeteria) => {
          if (cafeteria.ownerPin) {
            cafeteria.ownerPin = await bcrypt.hash(cafeteria.ownerPin, 10);
          }
        },
        beforeUpdate: async (cafeteria) => {
          if (cafeteria.changed("ownerPin") && cafeteria.ownerPin) {
            cafeteria.ownerPin = await bcrypt.hash(cafeteria.ownerPin, 10);
          }
        },
      },
    }

  );

  return Cafeteria;
};
