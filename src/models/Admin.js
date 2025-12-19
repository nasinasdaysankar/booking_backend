import { DataTypes } from "sequelize";

export default (sequelize) => {
  const Admin = sequelize.define(
    "Admin",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      staffId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },

      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      role: {
        type: DataTypes.ENUM("admin", "staff"),
        defaultValue: "staff",
      },

      cafeteriaId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      tableName: "admins",
      timestamps: true,
    }
  );

  return Admin;
};
