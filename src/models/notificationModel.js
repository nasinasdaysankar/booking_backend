import { DataTypes } from "sequelize";

export default (sequelize) => {
  const Notification = sequelize.define("Notification", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING, allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    imageUrl: { type: DataTypes.STRING, allowNull: true },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  });

  return Notification;
};
