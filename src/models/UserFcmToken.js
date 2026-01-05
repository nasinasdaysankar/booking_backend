import { DataTypes } from "sequelize";

export default (sequelize) => {
  const UserFcmToken = sequelize.define(
    "UserFcmToken",
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      fcmToken: {
        type: DataTypes.STRING(512),
        allowNull: false,
        unique: true,
      },
    },
    {
      tableName: "user_fcm_tokens",
      timestamps: true,
    }
  );

  return UserFcmToken;
};
