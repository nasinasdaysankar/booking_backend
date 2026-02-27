import { DataTypes } from "sequelize";

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

      // ✅ FIXED LOCATION (Anantha Aahara)
      latitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
      },

      longitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
      },

      isOpen: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: "isopen",
      },

      isUserVisible: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: "isuservisible",
      },

      staticQrToken: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        field: "staticqrtoken",
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
    },
    {
      tableName: "cafeterias",
      timestamps: true,
      underscored: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Cafeteria;
};
