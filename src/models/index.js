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

// ================= INIT MODELS =================
const User = UserModel(sequelize);
const Admin = AdminModel(sequelize);
const Cafeteria = CafeteriaModel(sequelize);
const MenuItem = MenuItemModel(sequelize);
const Order = OrderModel(sequelize);
const OrderItem = OrderItemModel(sequelize);
const Notification = NotificationModel(sequelize);
const Banner = BannerModel(sequelize);
const Payment = PaymentModel(sequelize);
const CafeteriaQr = CafeteriaQrModel(sequelize);

// ================= RELATIONS =================

// Cafeteria → Menu
Cafeteria.hasMany(MenuItem, { foreignKey: "cafeteriaId" });
MenuItem.belongsTo(Cafeteria, { foreignKey: "cafeteriaId" });

// User → Orders
User.hasMany(Order, { foreignKey: "studentId" });
Order.belongsTo(User, { foreignKey: "studentId" });

// Cafeteria → Orders
Cafeteria.hasMany(Order, { foreignKey: "cafeteriaId" });
Order.belongsTo(Cafeteria, { foreignKey: "cafeteriaId" });

// Order → OrderItems
Order.hasMany(OrderItem, {
  foreignKey: "orderId",
  as: "items", // ✅ IMPORTANT
});
OrderItem.belongsTo(Order, {
  foreignKey: "orderId",
  as: "order",
});

// MenuItem → OrderItems
MenuItem.hasMany(OrderItem, {
  foreignKey: "menuItemId",
});
OrderItem.belongsTo(MenuItem, {
  foreignKey: "menuItemId",
  as: "menuItem", // ✅ IMPORTANT
});

// ================= EXPORT =================
export {
  sequelize,
  User,
  Admin,
  Cafeteria,
  MenuItem,
  Order,
  OrderItem,
  Notification,
  Banner,
  Payment,
  CafeteriaQr,
};
