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
        field: "orderid",
      },
      cafeteriaId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "cafeteriaid",
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 1.00,
        comment: "Platform commission amount (₹1)",
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
      tableName: "commissions",
      timestamps: true,
      underscored: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        { fields: ["orderid"] },
        { fields: ["cafeteriaid"] },
      ],
    }
  );

  return Commission;
};
