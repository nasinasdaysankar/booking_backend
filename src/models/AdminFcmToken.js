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
        field: "adminid",
      },
      cafeteriaId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "cafeteriaid",
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
      tableName: "admin_fcm_tokens",
      timestamps: true,
      underscored: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return AdminFcmToken;
};
