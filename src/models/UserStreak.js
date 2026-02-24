import { DataTypes } from "sequelize";

export default (sequelize) => {
  const UserStreak = sequelize.define("UserStreak", {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "userid",
    },
    cafeteriaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "cafeteriaid",
    },
    currentStreak: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: "currentstreak",
    },
    maxStreak: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: "maxstreak",
    },
    lastOrderDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "lastorderdate",
    },

    createdAt: {
      type: DataTypes.DATE,
      field: "created_at",
    },

    updatedAt: {
      type: DataTypes.DATE,
      field: "updated_at",
    },
  }, {
    tableName: "user_streaks",
    timestamps: true,
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  });

  return UserStreak;
};
