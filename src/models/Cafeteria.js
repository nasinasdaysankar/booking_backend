import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Cafeteria = sequelize.define('Cafeteria', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    location: { type: DataTypes.STRING, allowNull: true },
    isOpen: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    staticQrToken: { type: DataTypes.STRING, allowNull: false } // used in static QR
  }, {
    tableName: 'cafeterias',
    timestamps: true
  });

  return Cafeteria;
};
