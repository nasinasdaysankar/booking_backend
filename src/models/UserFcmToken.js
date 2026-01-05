import { DataTypes } from "sequelize";

export default (sequelize) => {
  const UserFcmToken = sequelize.define("UserFcmToken", {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    fcmToken: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  });

  return UserFcmToken;
};
