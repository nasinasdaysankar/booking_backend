import { DataTypes } from "sequelize";

export default (sequelize) => {
  const PartnerFcmToken = sequelize.define(
    "PartnerFcmToken",
    {
      partnerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "partner_id",
      },
      fcmToken: {
        type: DataTypes.STRING(512),
        allowNull: false,
        unique: true,
        field: "fcm_token",
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
      tableName: "partner_fcm_tokens",
      timestamps: true,
      underscored: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return PartnerFcmToken;
};
