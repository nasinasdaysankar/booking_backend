import sequelize from "../config/db.js";

import UserModel from "./User.js";
import AdminModel from "./Admin.js";
import CafeteriaModel from "./Cafeteria.js";
import MenuItemModel from "./MenuItem.js";
import OrderModel from "./Order.js";
import OrderItemModel from "./OrderItem.js";
import BannerModel from "./Banner.js";
import PaymentModel from "./Payment.js";

import CommissionModel from "./Commission.js";
import VendorModel from "./Vendor.js";
import AuditLogModel from "./AuditLog.js";
import SystemSettingModel from "./SystemSetting.js";
import AdminFcmTokenModel from "./AdminFcmToken.js";
import UserFcmTokenModel from "./UserFcmToken.js";
import UserStreakModel from "./UserStreak.js";
import OrderFeedbackModel from "./OrderFeedback.js";
import AppFeedbackModel from "./AppFeedback.js";
import UserActivityModel from "./UserActivity.js";
import SupportTicketModel from "./SupportTicket.js";
import CampusBoundaryModel from "./CampusBoundary.js";

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
const Banner = BannerModel(sequelize);
const Payment = PaymentModel(sequelize);

const Commission = CommissionModel(sequelize);
const Vendor = VendorModel(sequelize);
const AuditLog = AuditLogModel(sequelize);
const SystemSetting = SystemSettingModel(sequelize);
const AdminFcmToken = AdminFcmTokenModel(sequelize);
const UserFcmToken = UserFcmTokenModel(sequelize);

const UserStreak = UserStreakModel(sequelize);

// ⭐ FEEDBACK MODEL
const OrderFeedback = OrderFeedbackModel(sequelize);
const AppFeedback = AppFeedbackModel(sequelize);
const UserActivity = UserActivityModel(sequelize);
const SupportTicket = SupportTicketModel(sequelize);
const CampusBoundary = CampusBoundaryModel(sequelize);


// ================= RELATIONS =================

// Cafeteria → Menu
Cafeteria.hasMany(MenuItem, { foreignKey: { name: "cafeteriaId", field: "cafeteriaid" } });
MenuItem.belongsTo(Cafeteria, { foreignKey: { name: "cafeteriaId", field: "cafeteriaid" } });

// User → Orders
User.hasMany(Order, { foreignKey: { name: "studentId", field: "studentid" } });
Order.belongsTo(User, { foreignKey: { name: "studentId", field: "studentid" } });

// Cafeteria → Orders
Cafeteria.hasMany(Order, { foreignKey: { name: "cafeteriaId", field: "cafeteriaid" }, as: "orders" });
Order.belongsTo(Cafeteria, { foreignKey: { name: "cafeteriaId", field: "cafeteriaid" }, as: "Cafeteria" });

// Order → OrderItems
Order.hasMany(OrderItem, { foreignKey: { name: "orderId", field: "orderid" }, as: "items" });
OrderItem.belongsTo(Order, { foreignKey: { name: "orderId", field: "orderid" }, as: "order" });

// MenuItem → OrderItems
MenuItem.hasMany(OrderItem, { foreignKey: { name: "menuItemId", field: "menuitemid" } });
OrderItem.belongsTo(MenuItem, { foreignKey: { name: "menuItemId", field: "menuitemid" }, as: "menuItem" });


// ================= FEEDBACK RELATIONS =================

// Order → Feedback
Order.hasOne(OrderFeedback, { foreignKey: { name: "orderId", field: "orderid" } });
OrderFeedback.belongsTo(Order, { foreignKey: { name: "orderId", field: "orderid" } });

// User → Feedback
User.hasMany(OrderFeedback, { foreignKey: { name: "studentId", field: "studentid" } });
OrderFeedback.belongsTo(User, { foreignKey: { name: "studentId", field: "studentid" } });

// Cafeteria → Feedback
Cafeteria.hasMany(OrderFeedback, { foreignKey: { name: "cafeteriaId", field: "cafeteriaid" } });
OrderFeedback.belongsTo(Cafeteria, { foreignKey: { name: "cafeteriaId", field: "cafeteriaid" } });

// User → App Feedback
User.hasMany(AppFeedback, { foreignKey: { name: "userId", field: "userid" } });
AppFeedback.belongsTo(User, { foreignKey: { name: "userId", field: "userid" }, as: "user" });


// ================= COMMISSION RELATIONS =================
Commission.belongsTo(Order, { foreignKey: { name: "orderId", field: "orderid" } }); // [NEW]
Commission.belongsTo(Cafeteria, { foreignKey: { name: "cafeteriaId", field: "cafeteriaid" } }); // [NEW]

// ================= VENDOR RELATIONS =================
Vendor.belongsTo(Cafeteria, { foreignKey: { name: "cafeteriaId", field: "cafeteriaid" } }); // [NEW]
Cafeteria.hasOne(Vendor, { foreignKey: { name: "cafeteriaId", field: "cafeteriaid" } }); // [NEW]

// ================= FCM RELATIONS =================

// Admin → AdminFcmToken
Admin.hasMany(AdminFcmToken, { foreignKey: { name: "adminId", field: "adminid" } });
AdminFcmToken.belongsTo(Admin, { foreignKey: { name: "adminId", field: "adminid" } });

// User → UserFcmToken
User.hasMany(UserFcmToken, { foreignKey: { name: "userId", field: "userid" } });
UserFcmToken.belongsTo(User, { foreignKey: { name: "userId", field: "userid" } });

// User → Streak
User.hasMany(UserStreak, { foreignKey: { name: "userId", field: "userid" } });
UserStreak.belongsTo(User, { foreignKey: { name: "userId", field: "userid" } });

// Cafeteria → Streak
Cafeteria.hasMany(UserStreak, { foreignKey: { name: "cafeteriaId", field: "cafeteriaid" } });
UserStreak.belongsTo(Cafeteria, { foreignKey: { name: "cafeteriaId", field: "cafeteriaid" } });

// User → Activity
User.hasMany(UserActivity, { foreignKey: { name: "userId", field: "userid" } });
UserActivity.belongsTo(User, { foreignKey: { name: "userId", field: "userid" } });

// User → Support Tickets (constraints: false to allow admin IDs too)
User.hasMany(SupportTicket, { foreignKey: { name: "userId", field: "userid" }, constraints: false });
SupportTicket.belongsTo(User, { foreignKey: { name: "userId", field: "userid" }, as: "user", constraints: false });

// ================= SYSTEM RELATIONS =================
AuditLog.belongsTo(Admin, { foreignKey: { name: "adminId", field: "adminid" } });
Admin.hasMany(AuditLog, { foreignKey: { name: "adminId", field: "adminid" } });

Payment.belongsTo(Order, { foreignKey: { name: "orderId", field: "orderid" } });
Order.hasMany(Payment, { foreignKey: { name: "orderId", field: "orderid" } });


// ================= EXPORT =================
export {
  sequelize,
  User,
  Admin,
  Cafeteria,
  MenuItem,
  Order,
  OrderItem,
  Banner,
  Payment,

  Commission,
  Vendor,
  AuditLog,
  SystemSetting,
  AdminFcmToken,
  UserFcmToken,
  UserStreak,
  OrderFeedback,   // ⭐ IMPORTANT
  AppFeedback,
  UserActivity,
  SupportTicket, // 🎫 SUPPORT TICKETS
  CampusBoundary,
};
