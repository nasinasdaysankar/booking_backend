// backend/models/cafeteriaQr.js

import { DataTypes } from "sequelize";

export default (sequelize) => {
  const CafeteriaQr = sequelize.define(
    "CafeteriaQr",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      cafeteriaId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        field: "cafeteriaid"
      },
      qrToken: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: "qrtoken"
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
      tableName: "cafeteria_qrs",
      timestamps: true,
      underscored: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      // Optional: prevent Sequelize from changing names
      freezeTableName: true,
    }
  );

  return CafeteriaQr;
};