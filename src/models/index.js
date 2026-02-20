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
import CommissionModel from "./Commission.js";
import VendorModel from "./Vendor.js";
import UpiPaymentModel from "./UpiPayment.js";
import AuditLogModel from "./AuditLog.js";
import SystemSettingModel from "./SystemSetting.js";
import SystemAlertModel from "./SystemAlert.js";

import AdminFcmTokenModel from "./AdminFcmToken.js";
import UserFcmTokenModel from "./UserFcmToken.js";
import UserStreakModel from "./UserStreak.js";
import OrderFeedbackModel from "./OrderFeedback.js";
import InventoryModel from "./Inventory.js";
import InventoryLogModel from "./InventoryLog.js";

import app from "../app.js";
import http from "http";
import { Server } from "socket.io";

import dotenv from "dotenv";

const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : process.env.NODE_ENV === "test"
      ? ".env.test"
      : ".env.local";

dotenv.config({ path: envFile });



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
const Commission = CommissionModel(sequelize);
const Vendor = VendorModel(sequelize);
const UpiPayment = UpiPaymentModel(sequelize);
const AuditLog = AuditLogModel(sequelize);
const SystemSetting = SystemSettingModel(sequelize);
const SystemAlert = SystemAlertModel(sequelize);

const AdminFcmToken = AdminFcmTokenModel(sequelize);
const UserFcmToken = UserFcmTokenModel(sequelize);

const UserStreak = UserStreakModel(sequelize);

// ⭐ FEEDBACK MODEL
const OrderFeedback = OrderFeedbackModel(sequelize);

// 📦 INVENTORY MODELS
const Inventory = InventoryModel(sequelize);
const InventoryLog = InventoryLogModel(sequelize);


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
Order.hasMany(OrderItem, { foreignKey: "orderId", as: "items" });
OrderItem.belongsTo(Order, { foreignKey: "orderId", as: "order" });

// MenuItem → OrderItems
MenuItem.hasMany(OrderItem, { foreignKey: "menuItemId" });
OrderItem.belongsTo(MenuItem, { foreignKey: "menuItemId", as: "menuItem" });


// ================= FEEDBACK RELATIONS =================

// Order → Feedback
Order.hasOne(OrderFeedback, { foreignKey: "orderId" });
OrderFeedback.belongsTo(Order, { foreignKey: "orderId" });

// User → Feedback
User.hasMany(OrderFeedback, { foreignKey: "studentId" });
OrderFeedback.belongsTo(User, { foreignKey: "studentId" });

// Cafeteria → Feedback
Cafeteria.hasMany(OrderFeedback, { foreignKey: "cafeteriaId" });
OrderFeedback.belongsTo(Cafeteria, { foreignKey: "cafeteriaId" });


// ================= COMMISSION RELATIONS =================
Commission.belongsTo(Order, { foreignKey: "orderId" }); // [NEW]
Commission.belongsTo(Cafeteria, { foreignKey: "cafeteriaId" }); // [NEW]

// ================= VENDOR RELATIONS =================
Vendor.belongsTo(Cafeteria, { foreignKey: "cafeteriaId" }); // [NEW]
Cafeteria.hasOne(Vendor, { foreignKey: "cafeteriaId" }); // [NEW]

// ================= UPI PAYMENT RELATIONS =================
Order.hasOne(UpiPayment, { foreignKey: "orderId" }); // [NEW]
UpiPayment.belongsTo(Order, { foreignKey: "orderId" }); // [NEW]


// ================= FCM RELATIONS =================

// Admin → AdminFcmToken
Admin.hasMany(AdminFcmToken, { foreignKey: "adminId" });
AdminFcmToken.belongsTo(Admin, { foreignKey: "adminId" });

// User → UserFcmToken
User.hasMany(UserFcmToken, { foreignKey: "userId" });
UserFcmToken.belongsTo(User, { foreignKey: "userId" });

// User → Streak
User.hasMany(UserStreak, { foreignKey: "userId" });
UserStreak.belongsTo(User, { foreignKey: "userId" });

// Cafeteria → Streak
Cafeteria.hasMany(UserStreak, { foreignKey: "cafeteriaId" });
UserStreak.belongsTo(Cafeteria, { foreignKey: "cafeteriaId" });

// ================= SYSTEM RELATIONS =================
SystemAlert.belongsTo(Cafeteria, { foreignKey: "cafeteriaId", as: "Cafeteria" });
Cafeteria.hasMany(SystemAlert, { foreignKey: "cafeteriaId", as: "alerts" });

AuditLog.belongsTo(Admin, { foreignKey: "adminId" });
Admin.hasMany(AuditLog, { foreignKey: "adminId" });

Payment.belongsTo(Order, { foreignKey: "orderId" });
Order.hasMany(Payment, { foreignKey: "orderId" });

// ================= INVENTORY RELATIONS =================
MenuItem.hasOne(Inventory, { foreignKey: "menuItemId", as: "inventory" });
Inventory.belongsTo(MenuItem, { foreignKey: "menuItemId", as: "menuItem" });

Cafeteria.hasMany(Inventory, { foreignKey: "cafeteriaId" });
Inventory.belongsTo(Cafeteria, { foreignKey: "cafeteriaId" });

MenuItem.hasMany(InventoryLog, { foreignKey: "menuItemId" });
InventoryLog.belongsTo(MenuItem, { foreignKey: "menuItemId" });


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
  Commission,
  Vendor,
  AuditLog,
  SystemSetting,
  SystemAlert,
  AdminFcmToken,
  UserFcmToken,
  UserStreak,
  OrderFeedback,   // ⭐ IMPORTANT
  UpiPayment, // [NEW] Auto Collect
  Inventory, // 📦 Inventory
  InventoryLog, // 📦 Inventory Log
};
