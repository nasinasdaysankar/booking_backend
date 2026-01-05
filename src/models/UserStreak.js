import { DataTypes } from "sequelize";

export default (sequelize) => {
  const UserStreak = sequelize.define("UserStreak", {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    cafeteriaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    currentStreak: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    maxStreak: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    lastOrderDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
  });

  return UserStreak;
};
