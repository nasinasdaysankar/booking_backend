import { DataTypes } from "sequelize";

export default (sequelize) => {
  const Notification = sequelize.define("Notification", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING, allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    imageUrl: { type: DataTypes.STRING, allowNull: true, field: "imageurl" },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, field: "updated_at" }
  }, {
    tableName: 'notifications_system', // renaming to avoid clash if needed or just keep
    timestamps: true,
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at"
  });

  return Notification;
};
