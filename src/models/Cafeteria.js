import { DataTypes } from "sequelize";

export default (sequelize) => {
  const Cafeteria = sequelize.define(
    "Cafeteria",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },

      // ✅ FIXED LOCATION (Anantha Aahara)
      latitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
      },

      longitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
      },

      isOpen: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },

      isUserVisible: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      staticQrToken: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },

      ownerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "ownerid",
      },
    },
    {
      tableName: "cafeterias",
      timestamps: true,
    }
  );

  return Cafeteria;
};
