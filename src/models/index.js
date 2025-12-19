// import sequelize from "../config/db.js";

// import UserModel from "./User.js";
// import AdminModel from "./Admin.js";
// import CafeteriaModel from "./Cafeteria.js";
// import MenuItemModel from "./MenuItem.js";
// import OrderModel from "./Order.js";
// import OrderItemModel from "./OrderItem.js";
// import NotificationModel from "./notificationModel.js";
// import BannerModel from "./Banner.js";
// import PaymentModel from "./Payment.js";
// import Order from "./Order.js";
// import OrderItem from "./OrderItem.js";


// // Initialize models
// const User = UserModel(sequelize);
// const Admin = AdminModel(sequelize);
// const Cafeteria = CafeteriaModel(sequelize);
// const MenuItem = MenuItemModel(sequelize);
// const Order = OrderModel(sequelize);
// const OrderItem = OrderItemModel(sequelize);
// const Notification = NotificationModel(sequelize);
// const Banner = BannerModel(sequelize);
// const Payment = PaymentModel(sequelize);

// // Relations
// Cafeteria.hasMany(MenuItem, { foreignKey: "cafeteriaId" });
// MenuItem.belongsTo(Cafeteria, { foreignKey: "cafeteriaId" });

// User.hasMany(Order, { foreignKey: "studentId" });
// Order.belongsTo(User, { foreignKey: "studentId" });

// Cafeteria.hasMany(Order, { foreignKey: "cafeteriaId" });
// Order.belongsTo(Cafeteria, { foreignKey: "cafeteriaId" });

// Order.hasMany(OrderItem, { foreignKey: "orderId" });
// OrderItem.belongsTo(Order, { foreignKey: "orderId" });

// MenuItem.hasMany(OrderItem, { foreignKey: "menuItemId" });
// OrderItem.belongsTo(MenuItem, { foreignKey: "menuItemId" });

// // Export
// export {
//   sequelize,
//   User,
//   Cafeteria,
//   MenuItem,
//   Order,
//   OrderItem,
//   Banner,
//   Notification,
//   Admin,
//   Payment,
// };
// import sequelize from "../config/db.js";

// import UserModel from "./User.js";
// import AdminModel from "./Admin.js";
// import CafeteriaModel from "./Cafeteria.js";
// import MenuItemModel from "./MenuItem.js";
// import OrderModel from "./Order.js";
// import OrderItemModel from "./OrderItem.js";
// import NotificationModel from "./notificationModel.js";
// import BannerModel from "./Banner.js";
// import PaymentModel from "./Payment.js";
// import OrderQrTokenModel from "./OrderQrToken.js";
// import CafeteriaQrModel from "./cafeteriaQr.js";

// // Initialize models
// const User = UserModel(sequelize);
// const Admin = AdminModel(sequelize);
// const Cafeteria = CafeteriaModel(sequelize);
// const MenuItem = MenuItemModel(sequelize);
// const Order = OrderModel(sequelize);
// const OrderItem = OrderItemModel(sequelize);
// const Notification = NotificationModel(sequelize);
// const Banner = BannerModel(sequelize);
// const Payment = PaymentModel(sequelize);

// // Relations
// Cafeteria.hasMany(MenuItem, { foreignKey: "cafeteriaId" });
// MenuItem.belongsTo(Cafeteria, { foreignKey: "cafeteriaId" });

// User.hasMany(Order, { foreignKey: "studentId" });
// Order.belongsTo(User, { foreignKey: "studentId" });

// Cafeteria.hasMany(Order, { foreignKey: "cafeteriaId" });
// Order.belongsTo(Cafeteria, { foreignKey: "cafeteriaId" });

// // ✅ FIX: Added 'as: "items"' so the data appears correctly in the API
// Order.hasMany(OrderItem, { foreignKey: "orderId", as: "items" });
// OrderItem.belongsTo(Order, { foreignKey: "orderId", as: "order" });

// MenuItem.hasMany(OrderItem, { foreignKey: "menuItemId" });
// OrderItem.belongsTo(MenuItem, { foreignKey: "menuItemId" });

// // Export
// export {
//   sequelize,
//   User,
//   Cafeteria,
//   MenuItem,
//   Order,
//   OrderItem,
//   Banner,
//   Notification,
//   Admin,
//   Payment,
//   // OrderQrTokenModel as OrderQrToken,
// };
// export const OrderQrToken = OrderQrTokenModel(sequelize);
// export const CafeteriaQr = CafeteriaQrModel(sequelize);

import sequelize from "../config/db.js";

import UserModel from "./User.js";
import AdminModel from "./Admin.js";
import CafeteriaModel from "./Cafeteria.js";
import MenuItemModel from "./MenuItem.js";
import OrderModel from "./Order.js";
import OrderItemModel from "./OrderItem.js";
import NotificationModel from "./notificationModel.js";
import BannerModel from "./Banner.js";
import PaymentModel from "./Payment.js";
import CafeteriaQrModel from "./cafeteriaQr.js";

// Initialize models
const User = UserModel(sequelize);
const Admin = AdminModel(sequelize);
const Cafeteria = CafeteriaModel(sequelize);
const MenuItem = MenuItemModel(sequelize);
const Order = OrderModel(sequelize);
const OrderItem = OrderItemModel(sequelize);
const Notification = NotificationModel(sequelize);
const Banner = BannerModel(sequelize);
const Payment = PaymentModel(sequelize);

// Relations
Cafeteria.hasMany(MenuItem, { foreignKey: "cafeteriaId" });
MenuItem.belongsTo(Cafeteria, { foreignKey: "cafeteriaId" });

User.hasMany(Order, { foreignKey: "studentId" });
Order.belongsTo(User, { foreignKey: "studentId" });

Cafeteria.hasMany(Order, { foreignKey: "cafeteriaId" });
Order.belongsTo(Cafeteria, { foreignKey: "cafeteriaId" });

Order.hasMany(OrderItem, { foreignKey: "orderId", as: "items" });
OrderItem.belongsTo(Order, { foreignKey: "orderId" });

MenuItem.hasMany(OrderItem, { foreignKey: "menuItemId" });
OrderItem.belongsTo(MenuItem, { foreignKey: "menuItemId" });

// Export
export {
  sequelize,
  User,
  Cafeteria,
  MenuItem,
  Order,
  OrderItem,
  Banner,
  Notification,
  Admin,
  Payment,
};

export const CafeteriaQr = CafeteriaQrModel(sequelize);