import { DataTypes } from "sequelize";

export default (sequelize) => {
  const AdminFcmToken = sequelize.define(
    "AdminFcmToken",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      adminId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      cafeteriaId: {
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
      tableName: "admin_fcm_tokens",
      timestamps: true,
    }
  );

  return AdminFcmToken;
};
