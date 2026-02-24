import { DataTypes } from "sequelize";

export default (sequelize) => {
  const UserFcmToken = sequelize.define(
    "UserFcmToken",
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "userid",
      },
      fcmToken: {
        type: DataTypes.STRING(512),
        allowNull: false,
        unique: true,
        field: "fcmtoken",
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
      tableName: "user_fcm_tokens",
      timestamps: true,
      underscored: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return UserFcmToken;
};
