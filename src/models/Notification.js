import { DataTypes } from "sequelize";

export default (sequelize) => {
  const Notification = sequelize.define("Notification", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING, allowNull: false },
    message: { type: DataTypes.STRING, allowNull: false },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: "notifications",
    timestamps: false
  });
  return Notification;
};
