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
        field: "cafeteriaId"  // ← Force exact column name with capital I (quoted in DB)
      },
      qrToken: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
    },
    {
      tableName: "cafeteria_qrs",
      timestamps: true,
      // Optional: prevent Sequelize from changing names
      freezeTableName: true,
    }
  );

  return CafeteriaQr;
};