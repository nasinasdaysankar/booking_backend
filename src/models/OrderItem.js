import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const OrderItem = sequelize.define('OrderItem', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    orderId: { type: DataTypes.INTEGER, allowNull: false },
    menuItemId: { type: DataTypes.INTEGER, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    priceAtOrder: { type: DataTypes.DECIMAL(10, 2), allowNull: false }
  }, {
    tableName: 'order_items',
    timestamps: true
  });

  return OrderItem;
};
