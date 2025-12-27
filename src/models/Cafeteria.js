// models/Cafeteria.js
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Cafeteria = sequelize.define(
    'Cafeteria',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          notEmpty: { msg: "Cafeteria name is required" },
          len: { args: [3, 100], msg: "Name must be between 3 and 100 characters" },
        },
      },
      location: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      isOpen: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      staticQrToken: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true, // Ensures no duplicate QR tokens
        comment: "Static QR token used for cafeteria identification",
      },
    },
    {
      tableName: 'cafeterias',
      timestamps: true, // createdAt & updatedAt
      indexes: [
        { fields: ['staticQrToken'] }, // Speed up QR lookup
      ],
    }
  );

  return Cafeteria;
};