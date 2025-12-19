import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const OrderItem = sequelize.define(
    'OrderItem',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

      orderId: { type: DataTypes.INTEGER, allowNull: false },

      // 🟢 FIX: menuItemId now optional
      Id: { type: DataTypes.INTEGER, allowNull: true },

      // 🟢 Store Flutter item name
      name: { type: DataTypes.STRING, allowNull: false },

      // 🟢 Store Flutter item image
      imageUrl: { type: DataTypes.STRING, allowNull: true },

      quantity: { type: DataTypes.INTEGER, allowNull: false },
      priceAtOrder: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    },
    {
      tableName: 'order_items',
      timestamps: true,
    }
  );

  return OrderItem;
};
