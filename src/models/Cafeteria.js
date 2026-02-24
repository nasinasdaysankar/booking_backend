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
        field: "isopen",
      },

      isUserVisible: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: "isuservisible",
      },

      staticQrToken: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        field: "staticqrtoken",
      },

      ownerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "ownerid",
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
      tableName: "cafeterias",
      timestamps: true,
      underscored: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Cafeteria;
};
