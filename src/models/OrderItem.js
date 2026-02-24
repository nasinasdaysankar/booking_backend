import { DataTypes } from 'sequelize';

// export default (sequelize) => {
//   const OrderItem = sequelize.define(
//     'OrderItem',
//     {
//       id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

//       orderId: { type: DataTypes.INTEGER, allowNull: false },

//       // 🟢 FIX: menuItemId now optional
//       Id: { type: DataTypes.INTEGER, allowNull: true },

//       // 🟢 Store Flutter item name
//       name: { type: DataTypes.STRING, allowNull: false },

//       // 🟢 Store Flutter item image
//       imageUrl: { type: DataTypes.STRING, allowNull: true },

//       quantity: { type: DataTypes.INTEGER, allowNull: false },
//       priceAtOrder: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
//     },
//     {
//       tableName: 'order_items',
//       timestamps: true,
//     }
//   );

//   return OrderItem;
// };


export default (sequelize) => {
  const OrderItem = sequelize.define(
    'OrderItem',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      orderId: { type: DataTypes.INTEGER, allowNull: false, field: "orderid" },
      Id: { type: DataTypes.INTEGER, allowNull: true, field: "itemid" },
      name: { type: DataTypes.STRING, allowNull: false },
      imageUrl: { type: DataTypes.STRING, allowNull: true, field: "imageurl" },
      quantity: { type: DataTypes.INTEGER, allowNull: false },
      priceAtOrder: { type: DataTypes.DECIMAL(10, 2), allowNull: false, field: "priceatorder" },

      // 🧺 NEW: Track if this item needs parcel packaging
      isParcel: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        field: "isparcel"
      },

      createdAt: {
        type: DataTypes.DATE,
        field: "created_at"
      },

      updatedAt: {
        type: DataTypes.DATE,
        field: "updated_at"
      },
    },
    {
      tableName: 'order_items',
      timestamps: true,
      underscored: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return OrderItem;
};