import sequelize from '../config/db.js';
import UserModel from './User.js';
import CafeteriaModel from './Cafeteria.js';
import MenuItemModel from './MenuItem.js';
import OrderModel from './Order.js';
import OrderItemModel from './OrderItem.js';
import NotificationModel from "./notificationModel.js";   // FIXED PATH ✔
import BannerModel from './Banner.js'; // <-- Imported

// Initialize models
const User = UserModel(sequelize);
const Cafeteria = CafeteriaModel(sequelize);
const MenuItem = MenuItemModel(sequelize);
const Order = OrderModel(sequelize);
const OrderItem = OrderItemModel(sequelize);
const Notification = NotificationModel(sequelize);  // MUST EXPORT LIKE THIS ✔

const Banner = BannerModel(sequelize);   // <-- ADDED NOW 🟢

// Relations
Cafeteria.hasMany(MenuItem, { foreignKey: 'cafeteriaId' });
MenuItem.belongsTo(Cafeteria, { foreignKey: 'cafeteriaId' });

User.hasMany(Order, { foreignKey: 'studentId' });
Order.belongsTo(User, { foreignKey: 'studentId' });

Cafeteria.hasMany(Order, { foreignKey: 'cafeteriaId' });
Order.belongsTo(Cafeteria, { foreignKey: 'cafeteriaId' });

Order.hasMany(OrderItem, { foreignKey: 'orderId' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });

MenuItem.hasMany(OrderItem, { foreignKey: 'menuItemId' });
OrderItem.belongsTo(MenuItem, { foreignKey: 'menuItemId' });

// Export everything
export { sequelize, User, Cafeteria, MenuItem, Order, OrderItem, Banner, Notification};
