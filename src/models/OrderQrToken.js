// import { DataTypes } from "sequelize";

// export default (sequelize) => {
//   const OrderQrToken = sequelize.define(
//     "OrderQrToken",
//     {
//       id: {
//         type: DataTypes.INTEGER,
//         primaryKey: true,
//         autoIncrement: true,
//       },

//       orderId: {
//         type: DataTypes.INTEGER,
//         allowNull: false,
//       },

//       qrToken: {
//         type: DataTypes.STRING,
//         allowNull: false,
//         unique: true,
//       },

//       used: {
//         type: DataTypes.BOOLEAN,
//         defaultValue: false,
//       },

//       expiresAt: {
//         type: DataTypes.DATE,
//         allowNull: false,
//       },

//       usedAt: {
//         type: DataTypes.DATE,
//       },
//     },
//     {
//       tableName: "order_qr_tokens",
//       timestamps: true,
//     }
//   );

//   return OrderQrToken;
// };
