import { DataTypes } from "sequelize";
import bcrypt from "bcryptjs";

export default (sequelize) => {
  const DeliveryPartner = sequelize.define(
    "DeliveryPartner",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      partnerId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: "partner_id",
      },

      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      phone: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      password: {
        type: DataTypes.STRING,
        allowNull: false,
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

      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: "is_active",
      },

      isOnline: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: "is_online",
      },

      rejectionCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: "rejection_count",
      },

      lastRejectionReset: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: "last_rejection_reset",
      },

      lastLat: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
        field: "last_lat",
      },

      lastLong: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
        field: "last_long",
      },

      lastLocationAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "last_location_at",
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
      tableName: "delivery_partners",
      timestamps: true,
      underscored: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      hooks: {
        beforeSave: async (partner) => {
          if (partner.changed("password") && partner.password) {
            console.log(`🔐 [PARTNER MODEL] Hashing updated password for Partner ID: ${partner.partnerId}`);
            partner.password = await bcrypt.hash(partner.password, 10);
          }
        },
      },
    }
  );

  return DeliveryPartner;
};
