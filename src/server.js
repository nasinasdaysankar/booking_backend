// ⚠️ CRITICAL: Load environment configuration first
import "./config/env.js";

// Now all other imports can use process.env safely
import app from "./app.js";
import http from "http";
import { Server } from "socket.io";
import dns from "node:dns";

// ✅ Fix for Railway DNS lookup issues (Node 17+)
dns.setDefaultResultOrder("ipv4first");

import { sequelize, Cafeteria } from "./models/index.js";
import { connectRedis, isRedisReady } from "./config/redis.js";
import logger from "./utils/logger.js";
import compression from "compression";

import { initSocket } from "./socket.js";
import { initNotificationScheduler } from "./cron/notificationScheduler.js";
import { initCafeteriaScheduler } from "./cron/cafeteriaScheduler.js";
import { initStockScheduler } from "./cron/stockScheduler.js";

const PORT = process.env.PORT || 8080;
const SHOULD_SYNC = process.env.DB_SYNC === "true";

// Debug: Check if env vars are loaded
logger.info("🔍 Environment Check:");
logger.info("✅ NODE_ENV: " + process.env.NODE_ENV);
logger.info("✅ PORT: " + process.env.PORT);
logger.info("✅ AWS_REGION: " + (process.env.AWS_REGION ? "✅ Loaded" : "❌ Missing"));
logger.info("✅ AWS_S3_BUCKET_NAME: " + (process.env.AWS_S3_BUCKET_NAME ? "✅ Loaded" : "❌ Missing"));

// ========== HTTP SERVER ==========
const server = http.createServer(app);

// ========== SOCKET.IO SERVER ==========
const io = new Server(server, {
  cors: { origin: "*" },
});
//uday
// ✅ STORE SOCKET INSTANCE
initSocket(io);

// ========== SOCKET EVENTS ==========
io.on("connection", (socket) => {
  logger.info("⚡ Socket connected: " + socket.id);

  // ===== ADMIN joins cafeteria =====
  socket.on("JOIN_CAFETERIA", (cafeteriaId) => {
    const room = `cafeteria_${cafeteriaId}`;
    socket.join(room);
    logger.info(`🏪 Admin joined room: ${room}`);
  });

  // ===== USER joins personal room =====
  socket.on("JOIN_USER", (userId) => {
    const room = `user_${userId}`;
    socket.join(room);
    logger.info(`👤 User joined room: ${room}`);
  });

  // ===== PARTNER joins personal room =====
  socket.on("JOIN_PARTNER_ROOM", (partnerId) => {
    const room = `partner_${partnerId}`;
    socket.join(room);
    logger.info(`🛵 Partner joined room: ${room}`);
  });

  // ===== SUPPORT TICKET rooms =====
  socket.on("JOIN_TICKET", (ticketId) => {
    const room = `ticket_${ticketId}`;
    socket.join(room);
    logger.info(`🎫 Socket ${socket.id} joined room: ${room}`);
  });

  socket.on("LEAVE_TICKET", (ticketId) => {
    const room = `ticket_${ticketId}`;
    socket.leave(room);
    logger.info(`🎫 Socket ${socket.id} left room: ${room}`);
  });

  socket.on("disconnect", () => {
    logger.info("❌ Socket disconnected: " + socket.id);
  });
});


// ========== START SERVER ==========
const start = async () => {
  try {
    logger.info("🔗 Connecting to database...");
    await sequelize.authenticate();
    logger.info("✅ Database connected");

    // ✅ Ensure is_blocked column exists on users table (safe migration)
    try {
      await sequelize.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false`
      );
      logger.info("✅ users.is_blocked column ensured");
    } catch (colErr) {
      logger.warn("⚠️ Could not ensure is_blocked column: " + colErr.message);
    }

    // ✅ Ensure is_active column exists on admins table for suspension support
    try {
      await sequelize.query(
        `ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`
      );
      logger.info("✅ admins.is_active column ensured");
    } catch (colErr) {
      logger.warn("⚠️ Could not ensure admins is_active column: " + colErr.message);
    }

    // ✅ Ensure device_info column exists on admin_fcm_tokens
    try {
      await sequelize.query(
        `ALTER TABLE admin_fcm_tokens ADD COLUMN IF NOT EXISTS device_info VARCHAR(255) DEFAULT 'Unknown Device'`
      );
      logger.info("✅ admin_fcm_tokens.device_info column ensured");
    } catch (colErr) {
      logger.warn("⚠️ Could not ensure admin_fcm_tokens device_info column: " + colErr.message);
    }

    // ✅ Ensure ready_reminder_count exists on orders table
    try {
      await sequelize.query(
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS ready_reminder_count INTEGER NOT NULL DEFAULT 0`
      );
      await sequelize.query(
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_partner_id INTEGER`
      );
      await sequelize.query(
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_otp VARCHAR(6)`
      );
      await sequelize.query(
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_otp_expires_at TIMESTAMP WITH TIME ZONE`
      );
      await sequelize.query(
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT`
      );
      await sequelize.query(
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS room_number VARCHAR(255)`
      );
      await sequelize.query(
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS block_name VARCHAR(255)`
      );
      await sequelize.query(
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS receiver_phone VARCHAR(50)`
      );
      await sequelize.query(
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7)`
      );
      await sequelize.query(
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7)`
      );
      await sequelize.query(
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_order_id VARCHAR(255)`
      );
      await sequelize.query(
        `ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'ASSIGNED'`
      );
      await sequelize.query(
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS support_status VARCHAR(20) DEFAULT 'NONE'`
      );
      await sequelize.query(
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS support_reported_at TIMESTAMP WITH TIME ZONE`
      );
      await sequelize.query(
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS support_notes TEXT`
      );
      await sequelize.query(
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMP WITH TIME ZONE`
      );
      await sequelize.query(
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE`
      );
      await sequelize.query(
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE`
      );
      await sequelize.query(
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS affiliate_reward JSONB`
      );
      await sequelize.query(
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_charge DECIMAL(10, 2) DEFAULT 0.00`
      );
      logger.info("✅ orders delivery, support, affiliate, delivery_charge and status ENUM ensured");

    } catch (colErr) {
      logger.warn("⚠️ Could not ensure orders delivery/support columns: " + colErr.message);
    }

    // ✅ Ensure uninstalled columns exist on users table
    try {
      await sequelize.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_uninstalled BOOLEAN NOT NULL DEFAULT false`
      );
      await sequelize.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS uninstalled_at TIMESTAMP WITH TIME ZONE`
      );
      await sequelize.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_account_deleted BOOLEAN NOT NULL DEFAULT false`
      );
      await sequelize.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS account_deleted_at TIMESTAMP WITH TIME ZONE`
      );
      await sequelize.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS original_email VARCHAR(255)`
      );
      logger.info("✅ users.is_uninstalled and deletion columns ensured");
    } catch (colErr) {
      logger.warn("⚠️ Could not ensure uninstalled/deletion status columns: " + colErr.message);
    }

    // ✅ Ensure visibility_radius columns exist on cafeterias table
    try {
      await sequelize.query(
        `ALTER TABLE cafeterias ADD COLUMN IF NOT EXISTS visibility_radius DOUBLE PRECISION DEFAULT 10`
      );
      await sequelize.query(
        `ALTER TABLE cafeterias ADD COLUMN IF NOT EXISTS requested_visibility_radius DOUBLE PRECISION`
      );
      // Ensure the ENUM type exists if using postgres, but since we just store the string we just use VARCHAR
      await sequelize.query(
        `ALTER TABLE cafeterias ADD COLUMN IF NOT EXISTS radius_request_status VARCHAR(20) DEFAULT 'none'`
      );
      await sequelize.query(
        `ALTER TABLE cafeterias ADD COLUMN IF NOT EXISTS radius_request_feedback TEXT`
      );
      await sequelize.query(
        `ALTER TABLE cafeterias ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10, 2) DEFAULT 20.00`
      );
      await sequelize.query(
        `ALTER TABLE cafeterias ADD COLUMN IF NOT EXISTS is_online_order_enabled BOOLEAN DEFAULT true`
      );
      logger.info("✅ cafeterias.visibility_radius, delivery_fee and online_order_toggle columns ensured");
    } catch (colErr) {
      logger.warn("⚠️ Could not ensure cafeterias visibility radius/delivery columns: " + colErr.message);
    }

    // ✅ Ensure delivery rating columns exist on order_feedbacks table
    try {
      await sequelize.query(
        `ALTER TABLE order_feedbacks ADD COLUMN IF NOT EXISTS delivery_partner_id INTEGER REFERENCES delivery_partners(id)`
      );
      await sequelize.query(
        `ALTER TABLE order_feedbacks ADD COLUMN IF NOT EXISTS delivery_rating INTEGER`
      );
      await sequelize.query(
        `ALTER TABLE order_feedbacks ADD COLUMN IF NOT EXISTS delivery_comment TEXT`
      );
      logger.info("✅ order_feedbacks delivery columns ensured");
    } catch (colErr) {
      logger.warn("⚠️ Could not ensure order_feedbacks columns: " + colErr.message);
    }

    // ✅ Ensure 'ACCEPTED' exists in enum_orders_status
    try {
      await sequelize.query(
        `ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'ACCEPTED' AFTER 'ASSIGNED'`
      );
      logger.info("✅ enum_orders_status.ACCEPTED ensured");
    } catch (enumErr) {
      // Ignore if already exists
    }

    // ✅ Ensure order_type column and enum exist
    try {
      await sequelize.query(
        `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_orders_order_type') THEN
            CREATE TYPE "enum_orders_order_type" AS ENUM ('DINE_IN', 'DELIVERY');
          END IF;
        END $$;`
      );
      await sequelize.query(
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type "enum_orders_order_type" NOT NULL DEFAULT 'DINE_IN'`
      );
      logger.info("✅ orders.order_type column ensured");
    } catch (orderTypeErr) {
      logger.warn("⚠️ Could not ensure orders.order_type: " + orderTypeErr.message);
    }

    // ✅ Ensure is_busy, is_offline, open_time, close_time columns exist on cafeterias table
    try {
      await sequelize.query(
        `ALTER TABLE cafeterias ADD COLUMN IF NOT EXISTS is_busy BOOLEAN NOT NULL DEFAULT false`
      );
      await sequelize.query(
        `ALTER TABLE cafeterias ADD COLUMN IF NOT EXISTS is_offline BOOLEAN NOT NULL DEFAULT false`
      );
      await sequelize.query(
        `ALTER TABLE cafeterias ADD COLUMN IF NOT EXISTS open_time VARCHAR(5)`
      );
      await sequelize.query(
        `ALTER TABLE cafeterias ADD COLUMN IF NOT EXISTS close_time VARCHAR(5)`
      );
      await sequelize.query(
        `ALTER TABLE cafeterias ADD COLUMN IF NOT EXISTS owner_pin VARCHAR(255)`
      );
      logger.info("✅ cafeterias missing columns ensured");

    } catch (colErr) {
      logger.warn("⚠️ Could not ensure cafeterias missing columns: " + colErr.message);
    }

    // ✅ Ensure edit_reason column exists on inventory_batches table
    try {
      await sequelize.query(
        `ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS edit_reason VARCHAR(255)`
      );
      logger.info("✅ inventory_batches.edit_reason column ensured");
    } catch (colErr) {
      logger.warn("⚠️ Could not ensure inventory_batches edit_reason column: " + colErr.message);
    }

    // ✅ Ensure auto_stock_update columns exist on menu_items table
    try {
      await sequelize.query(
        `ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS autostockupdate BOOLEAN NOT NULL DEFAULT false`
      );
      await sequelize.query(
        `ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS defaultstockquantity INTEGER NOT NULL DEFAULT 0`
      );
      logger.info("✅ menu_items auto stock update columns ensured");
    } catch (colErr) {
      logger.warn("⚠️ Could not ensure menu_items auto stock update columns: " + colErr.message);
    }

    // ✅ Ensure support system tables and columns (media, unread tracking, source)
    try {
      // 🎫 1. Create support_tickets if missing
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS support_tickets (
          id SERIAL PRIMARY KEY,
          userid INTEGER NOT NULL,
          category VARCHAR(100) NOT NULL,
          question VARCHAR(255) NOT NULL,
          description TEXT,
          status VARCHAR(20) DEFAULT 'open',
          admin_response TEXT,
          resolved_at TIMESTAMP WITH TIME ZONE,
          owner_requested_confirmation BOOLEAN DEFAULT false,
          user_email VARCHAR(255),
          user_phone VARCHAR(255),
          platform VARCHAR(50),
          source VARCHAR(20) DEFAULT 'user',
          is_media_enabled BOOLEAN DEFAULT false,
          user_unread_count INTEGER DEFAULT 0,
          owner_unread_count INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL
        )
      `);

      // 💬 2. Create support_messages if missing
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS support_messages (
          id SERIAL PRIMARY KEY,
          ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
          sender_id INTEGER NOT NULL,
          sender_type VARCHAR(20) NOT NULL,
          message TEXT NOT NULL,
          media_url1 VARCHAR(255),
          media_url2 VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL
        )
      `);

      // 🛠️ 3. Ensure all columns exist (in case tables were partially created)
      await sequelize.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS is_media_enabled BOOLEAN NOT NULL DEFAULT false`);
      await sequelize.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS user_unread_count INTEGER NOT NULL DEFAULT 0`);
      await sequelize.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS owner_unread_count INTEGER NOT NULL DEFAULT 0`);
      await sequelize.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'user'`);
      
      await sequelize.query(`ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS media_url1 VARCHAR(255)`);
      await sequelize.query(`ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS media_url2 VARCHAR(255)`);
      
      logger.info("✅ support_tickets and support_messages tables/columns ensured");
    } catch (colErr) {
      logger.warn("⚠️ Could not ensure support system tables/columns: " + colErr.message);
    }

    // ✅ Ensure delivery_charge_configs table exists
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS delivery_charge_configs (
          id SERIAL PRIMARY KEY,
          cafeteria_id INTEGER NOT NULL REFERENCES cafeterias(id) ON DELETE CASCADE,
          ranges JSONB NOT NULL DEFAULT '[]',
          status VARCHAR(20) DEFAULT 'PENDING',
          admin_id INTEGER,
          approver_id INTEGER,
          is_active BOOLEAN DEFAULT false,
          feedback TEXT,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL
        )
      `);

      // Safe migrations for existing table
      await sequelize.query(`ALTER TABLE delivery_charge_configs ADD COLUMN IF NOT EXISTS cafeteria_id INTEGER REFERENCES cafeterias(id) ON DELETE CASCADE`).catch(() => {});
      await sequelize.query(`ALTER TABLE delivery_charge_configs ADD COLUMN IF NOT EXISTS admin_id INTEGER`).catch(() => {});
      await sequelize.query(`ALTER TABLE delivery_charge_configs ADD COLUMN IF NOT EXISTS approver_id INTEGER`).catch(() => {});
      await sequelize.query(`ALTER TABLE delivery_charge_configs ADD COLUMN IF NOT EXISTS rejection_reason TEXT`).catch(() => {});
      await sequelize.query(`ALTER TABLE delivery_charge_configs ADD COLUMN IF NOT EXISTS ranges JSONB NOT NULL DEFAULT '[]'`).catch(() => {});
      
      // Cleanup if old column exists
      try {
        await sequelize.query(`ALTER TABLE delivery_charge_configs RENAME COLUMN cafeteriaid TO cafeteria_id`);
      } catch (e) {}

      logger.info("✅ delivery_charge_configs table ensured");
    } catch (colErr) {
      logger.warn("⚠️ Could not ensure delivery_charge_configs table: " + colErr.message);
    }


    // ✅ Ensure affiliate_products columns are TEXT to support long URLs
    try {
      await sequelize.query(`ALTER TABLE affiliate_products ALTER COLUMN title TYPE TEXT`);
      await sequelize.query(`ALTER TABLE affiliate_products ALTER COLUMN image_url TYPE TEXT`);
      await sequelize.query(`ALTER TABLE affiliate_products ALTER COLUMN affiliate_link TYPE TEXT`);
      logger.info("✅ affiliate_products columns updated to TEXT");
    } catch (colErr) {
      logger.warn("⚠️ Could not update affiliate_products columns: " + colErr.message);
    }

    //Redis
    // ============================================
    // 🔥 REDIS CONNECTION
    // ============================================
    console.log("🔗 Connecting to Redis...");
    await connectRedis();
    console.log(isRedisReady() ? "✅ Redis connected" : "⚠️ Redis unavailable (running without cache)");

    if (SHOULD_SYNC) {
      await sequelize.sync({ alter: false });
      logger.info("🧱 Sequelize sync done");
    } else {
      logger.warn("⚠️ Sequelize sync skipped");
    }


    // ============================================
    // 🔥 COMPRESSION - BEFORE ROUTES FOR EFFICIENCY
    // ============================================
    app.use(compression());
    logger.info("✅ Compression enabled");

    logger.info("✅ Routes mounted");

    // ========== CAFETERIA SEED ==========
    const count = await Cafeteria.count();
    if (count === 0) {
      await Cafeteria.bulkCreate([
        { name: "ANANTHA AAHARA", location: "Main Block" },
        { name: "AROMOS", location: "Block A" },
        { name: "DHANAPANI", location: "Block B" },
        { name: "FOODCLUB", location: "Block C" },
      ]);
      logger.info("📌 Cafeterias seeded");
    }

    // ========== START LISTENING ==========
    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info("⚡ WebSocket enabled");
      logger.info("🔥 Optimized for 700-1000 concurrent users");

      initNotificationScheduler(); // ⏰ Start Cron
      initCafeteriaScheduler(); // ⏰ Start Cafeteria Scheduler
      initStockScheduler(); // ⏰ Start Stock Scheduler
    });

  } catch (err) {
    logger.error("❌ Server failed: " + err.message);
    process.exit(1);
  }
};

start();