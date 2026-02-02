import { DataTypes } from "sequelize";

export default (sequelize) => {
  const Commission = sequelize.define(
    "Commission",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      orderId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      cafeteriaId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 1.00,
      },
    },
    {
      tableName: "commissions",
      timestamps: true,
    }
  );

  return Commission;
};
