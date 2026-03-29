import { MenuItem, sequelize, Banner } from "../models/index.js";
import { Op } from "sequelize";
import { menuCacheGet, menuCacheSet, analyticsCacheGet, analyticsCacheSet, CACHE_KEYS, clearMenuCache } from "../utils/cache.js";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, getS3Bucket } from "../config/aws_s3.js";
import slugify from "slugify";
import { emitStockUpdate } from "../socket.js";


/* ================== ADD SINGLE MENU ITEM ================== */
export const addMenuItem = async (req, res) => {
  try {
    const { cafeteriaId, name, price, imageUrl, category, isTodaySpecial, isParcelAvailable, stock, trackStock } = req.body;

    if (!cafeteriaId || !name || !price)
      return res.status(400).json({ success: false, message: "Missing fields" });

    const today = new Date().toISOString().split("T")[0];

    const item = await MenuItem.create({
      cafeteriaId,
      name,
      price,
      imageUrl,
      category,
      isTodaySpecial: isTodaySpecial === true,
      isParcelAvailable: isParcelAvailable !== undefined ? isParcelAvailable : true,
      stock: stock || 0,
      trackStock: trackStock === true,

      specialDate: isTodaySpecial ? today : null,
    });

    res.json({ success: true, message: "Item Added ✔", data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: "Insert failed", error: err.message });
  }
};


/* ================== BULK MENU INSERT ================== */
export const addBulkMenuItems = async (req, res) => {
  try {

    // FIXED → reads array under items[]
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ success: false, message: "Items array required" });

    const result = await MenuItem.bulkCreate(items);

    res.json({
      success: true,
      inserted: result.length,
      message: "Bulk Menu Inserted ✔",
      data: result
    });

  } catch (err) {
    res.status(500).json({ success: false, message: "Bulk failed", error: err.message });
  }
};


/* ================== GET ALL MENU ITEMS ================== */
export const getAllMenuItems = async (req, res) => {
  try {
    const items = await MenuItem.findAll();

    // 🚀 FILTER BY HIDDEN CATEGORIES
    const hiddenBanners = await Banner.findAll({ where: { isVisible: false } });
    const hiddenMap = {}; // cafeteriaId -> set of categoryNames
    hiddenBanners.forEach(b => {
      const cid = Number(b.cafeteriaId);
      if (!hiddenMap[cid]) hiddenMap[cid] = new Set();
      hiddenMap[cid].add(b.name.toLowerCase().trim());
    });

    const filtered = items.filter(item => {
      const cid = Number(item.cafeteriaId);
      if (!hiddenMap[cid]) return true;
      const cat = item.category?.toLowerCase().trim();
      return !hiddenMap[cid].has(cat);
    });

    res.json({ success: true, count: filtered.length, data: filtered });
  } catch (err) {
    res.status(500).json({ success: false, message: "Fetch failed", error: err.message });
  }
};


/* ================== SEARCH BY CATEGORY ================== */
export const getBeveragesMenu = async (req, res) => {
  try {
    const categoryName = req.params.category;
    const items = await MenuItem.findAll({ where: { category: categoryName } });

    // 🚀 FILTER BY HIDDEN CATEGORIES
    const hiddenBanners = await Banner.findAll({ where: { isVisible: false } });
    const hiddenMap = {}; 
    hiddenBanners.forEach(b => {
      const cid = Number(b.cafeteriaId);
      if (!hiddenMap[cid]) hiddenMap[cid] = new Set();
      hiddenMap[cid].add(b.name.toLowerCase().trim());
    });

    const filtered = items.filter(item => {
      const cid = Number(item.cafeteriaId);
      if (!hiddenMap[cid]) return true;
      const cat = item.category?.toLowerCase().trim();
      return !hiddenMap[cid].has(cat);
    });

    res.json({ success: true, category: categoryName, count: filtered.length, data: filtered });

  } catch (err) {
    res.status(500).json({ success: false, message: "Category fetch failed", error: err.message });
  }
};
export const getDeletedMenuItems = async (req, res) => {
  const { cafeteriaId } = req.query;

  const items = await MenuItem.findAll({
    where: {
      cafeteriaId,
      isDeleted: true,
    },
    order: [['updatedAt', 'DESC']],
  });

  res.json({
    success: true,
    data: items,
  });
};


/* ================== GET BY CAFETERIA ================== */
import { Cafeteria } from "../models/index.js";

export const getMenuByCafeteria = async (req, res) => {
  try {
    const cafeteriaId = req.params.id;

    const cafeteria = await Cafeteria.findByPk(cafeteriaId);
    if (!cafeteria) {
      return res.status(404).json({
        success: false,
        message: "Cafeteria not found",
      });
    }

    // 🔥 Clean expired today specials
    const today = new Date().toISOString().split("T")[0];
    // await MenuItem.update(
    //   { isTodaySpecial: false, specialDate: null },
    //   {
    //     where: {
    //       isTodaySpecial: true,
    //       specialDate: { [Op.ne]: today },
    //     },
    //   }
    // );

    // ✅ FETCH MENU ITEMS FIRST (Admin sees ALL items regardless of availability)
    let items = await MenuItem.findAll({
      where: {
        cafeteriaId,
        isDeleted: false,
        // ✅ NOTE: Do NOT filter by isAvailable here — admin must see unavailable items too
      },
      order: [
        ["isTodaySpecial", "DESC"],
        ["name", "ASC"],
      ],
    });

    // 🚀 ADMIN VIEW: Skip hidden category filtering so admins can manage all items
    // (Banners only affect the public menu)

    return res.json({
      success: true,
      cafeteriaOpen: cafeteria.isOpen,
      cafeteriaOffline: cafeteria.isOffline,
      count: items.length,
      data: items,
    });

  } catch (err) {
    console.error("getMenuByCafeteria error:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};



/* ================== SINGLE IMAGE UPDATE ================== */
export const updateSingleImage = async (req, res) => {
  try {
    await MenuItem.update({ imageUrl: req.body.imageUrl }, { where: { id: req.params.id } });
    res.json({ success: true, message: "Image Updated ✔" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ================== SOFT DELETE MENU ITEM ================== */
export const deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;

    const [updated] = await MenuItem.update(
      { isDeleted: true, isAvailable: false },
      { where: { id } }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    res.json({
      success: true,
      message: "Menu item deleted (soft delete) ✔",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Delete failed",
      error: err.message,
    });
  }
};


/* ================== BULK IMAGE UPDATE ================== */
export const updateMultipleImages = async (req, res) => {
  try {
    const { items } = req.body;
    if (!items) return res.status(400).json({ message: "Items required" });

    for (const item of items)
      if (item.id) await MenuItem.update({ imageUrl: item.imageUrl }, { where: { id: item.id } });

    res.json({ success: true, message: "Images Updated ✔" });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const updateCategoryBulk = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: "Items array required" });

    for (const item of items) {
      await MenuItem.update(
        { category: item.category },
        { where: { name: item.name } }
      );
    }

    res.json({ success: true, message: "Categories Updated Successfully ✔" });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
export const updateImageById = async (req, res) => {
  try {
    const { id, imageUrl } = req.body;

    if (!id || !imageUrl)
      return res.status(400).json({ success: false, message: "id & imageUrl required" });

    await MenuItem.update(
      { imageUrl },
      { where: { id } }
    );

    res.json({ success: true, message: "Image updated successfully!" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const uploadBulkImages = async (req, res) => {
  try {
    const cafeteriaId = req.body.cafeteriaId;
    const files = req.files;

    let results = [];

    for (const file of files) {
      const originalName = file.originalname.replace(/\.(jpg|jpeg|png)$/i, "");
      console.log("Searching:", originalName);

      const item = await MenuItem.findOne({
        where: {
          cafeteriaId,
          name: sequelize.where(
            sequelize.fn("LOWER", sequelize.col("name")),
            "LIKE",
            "%" + originalName.toLowerCase() + "%"
          )
        }
      });

      if (!item) {
        results.push({ file: originalName, status: "NOT FOUND" });
        continue;
      }

      const uploadResult = await cloudinary.v2.uploader.upload(file.path, {
        folder: "restaurant_items"
      });

      await item.update({ imageUrl: uploadResult.secure_url });

      results.push({
        id: item.id,
        name: item.name,
        url: uploadResult.secure_url,
        status: "UPDATED"
      });

      fs.unlinkSync(file.path); // delete temp file
    }

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
/* ================== UPDATE MENU ITEM (Edit & Toggle) ================== */
export const updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, category, isAvailable, isTodaySpecial, imageUrl, isParcelAvailable, stock, trackStock } = req.body;

    const item = await MenuItem.findByPk(id);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    const today = new Date().toISOString().split("T")[0];

    if (name) item.name = name;
    if (price) item.price = price;
    if (category) item.category = category;
    if (isAvailable !== undefined) item.isAvailable = isAvailable;
    if (isParcelAvailable !== undefined) item.isParcelAvailable = isParcelAvailable;
    if (imageUrl) item.imageUrl = imageUrl;
    if (stock !== undefined) item.stock = stock;
    if (trackStock !== undefined) item.trackStock = trackStock;

    // ⭐ Today Special logic
    if (isTodaySpecial !== undefined) {
      if (isTodaySpecial === true) {
        item.isTodaySpecial = true;
        item.specialDate = today;
      } else {
        item.isTodaySpecial = false;
        item.specialDate = null;
      }
    }

    await item.save();

    // 🔔 REALTIME STOCK ALERT (if stock is explicitly set to 0)
    if (stock !== undefined && stock === 0) {
      emitStockUpdate(item.cafeteriaId, {
        menuItemId: item.id,
        name: item.name,
        stock: 0,
        reason: "MANUAL_UPDATE",
        message: `🚨 ${item.name} is now out of stock!`
      });
    }

    res.json({ success: true, message: "Item Updated ✔", data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: "Update failed", error: err.message });
  }
};



// controllers/menuController.js
export const getMostLovedItems = async (req, res) => {
  try {
    const cafeteriaId = req.query.cafeteriaId;
    const cacheKey = CACHE_KEYS.MOST_LOVED(cafeteriaId);

    // ✅ CHECK REDIS CACHE
    const cached = await analyticsCacheGet(cacheKey);
    if (cached) {
      return res.json({ success: true, cached: true, data: cached });
    }

    let cafeteriaFilter = "";
    if (cafeteriaId) {
      cafeteriaFilter = `AND mi."cafeteriaid" = ${cafeteriaId}`;
    }

    // ✅ Use name-based matching as fallback when menuitemid is NULL/0
    const [items] = await sequelize.query(`
      SELECT
        mi.id,
        mi.name,
        mi.price,
        mi.category,
        mi."imageurl" AS "imageUrl",
        CAST(mi."cafeteriaid" AS INTEGER) AS "cafeteriaId",
        COUNT(oi.id) AS "orderCount"
      FROM order_items oi
      JOIN menu_items mi ON (
        (oi."menuitemid" IS NOT NULL AND oi."menuitemid" > 0 AND mi.id = oi."menuitemid")
        OR
        (oi."menuitemid" IS NULL OR oi."menuitemid" = 0) AND LOWER(mi.name) = LOWER(oi.name)
      )
      JOIN orders o ON o.id = oi."orderid"
      WHERE o.status IN ('PAID', 'PREPARING', 'READY', 'PICKED_UP', 'COMPLETED')
      ${cafeteriaFilter}
      GROUP BY mi.id, mi.name, mi.price, mi.category, mi.imageurl, mi.cafeteriaid
      ORDER BY "orderCount" DESC
      LIMIT 10
    `);

    // ✅ SAVE TO REDIS (5 min TTL)
    if (items.length > 0) {
      // 🚀 FILTER BY HIDDEN CATEGORIES
      const hiddenBanners = await Banner.findAll({ where: { isVisible: false } });
      const hiddenMap = {};
      hiddenBanners.forEach(b => {
        const cid = Number(b.cafeteriaId);
        if (!hiddenMap[cid]) hiddenMap[cid] = new Set();
        hiddenMap[cid].add(b.name.toLowerCase().trim());
      });

      const filtered = items.filter(item => {
        const cid = Number(item.cafeteriaId);
        if (!hiddenMap[cid]) return true;
        const cat = item.category?.toLowerCase().trim();
        return !hiddenMap[cid].has(cat);
      });
      
      await analyticsCacheSet(cacheKey, filtered);
      
      return res.json({
        success: true,
        cached: false,
        data: filtered,
      });
    }

    res.json({
      success: true,
      cached: false,
      data: items,
    });
  } catch (err) {
    console.error("Most loved error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};


export const getTodaySpecials = async (req, res) => {
  try {
    const cafeteriaId = req.params.id;
    const cacheKey = CACHE_KEYS.TODAY_SPECIAL(cafeteriaId);

    // ✅ CHECK REDIS CACHE
    const cached = await menuCacheGet(cacheKey);
    if (cached) {
      return res.json({ success: true, cached: true, ...cached });
    }

    const today = new Date().toISOString().split("T")[0];

    const cafeteria = await Cafeteria.findByPk(cafeteriaId);
    if (!cafeteria) {
      return res.status(404).json({
        success: false,
        message: "Cafeteria not found",
      });
    }

    // 🔥 BLOCK today special when cafeteria is closed
    if (!cafeteria.isOpen) {
      return res.json({
        success: true,
        cafeteriaOpen: false,
        data: [],
      });
    }

    let items = await MenuItem.findAll({
      where: {
        cafeteriaId,
        isTodaySpecial: true,
        specialDate: today,
        isAvailable: true,
        isDeleted: false,
      },
    });

    // 🚀 FILTER BY HIDDEN CATEGORIES
    const hiddenBanners = await Banner.findAll({
      where: { cafeteriaId, isVisible: false }
    });
    const hiddenNames = new Set(hiddenBanners.map(b => b.name.toLowerCase().trim()));

    if (hiddenNames.size > 0) {
      items = items.filter(item => {
        const cat = item.category?.toLowerCase().trim();
        return !hiddenNames.has(cat);
      });
    }

    const response = { cafeteriaOpen: true, data: items };

    // ✅ SAVE TO REDIS (2 min TTL)
    await menuCacheSet(cacheKey, response);

    res.json({
      success: true,
      cached: false,
      ...response,
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};



export const restoreMenuItem = async (req, res) => {
  try {
    const { id } = req.params;

    const [updated] = await MenuItem.update(
      {
        isDeleted: false,
        isAvailable: true
      },
      { where: { id } }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    const item = await MenuItem.findByPk(id);

    res.json({
      success: true,
      message: "Menu item restored successfully ✔",
      data: item,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Restore failed",
      error: err.message,
    });
  }
};


/**
 * 🚀 PUBLIC MENU (FAST, CACHED, LIGHT)
 * Used by Flutter users
 * URL: /api/menu/public/:cafeteriaId
 */
/**
 * 🚀 PUBLIC MENU (FAST, CACHED, LIGHT)
 * URL: /api/menu/public/:cafeteriaId
 */
export const getPublicMenuByCafeteria = async (req, res) => {
  try {
    const cafeteriaId = Number(req.params.cafeteriaId);

    if (!cafeteriaId) {
      return res.status(400).json({
        success: false,
        message: "Invalid cafeteria id",
      });
    }

    const cacheKey = CACHE_KEYS.MENU_PUBLIC(cafeteriaId);

    // ✅ REDIS CACHE HIT
    const cached = await menuCacheGet(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        cached: true,
        ...cached,
      });
    }

    // ✅ CHECK CAFETERIA
    const cafeteria = await Cafeteria.findByPk(cafeteriaId, {
      attributes: ["id", "isOpen", "isOffline"],
    });

    if (!cafeteria) {
      return res.status(404).json({
        success: false,
        message: "Cafeteria not found",
      });
    }

    // ✅ FETCH MENU (INDEX-FRIENDLY QUERY)
    let items = await MenuItem.findAll({
      where: {
        cafeteriaId,
        isAvailable: true,
        isDeleted: false,
      },
      attributes: [
        "id",
        "name",
        "price",
        "imageUrl",
        "category",
        "isTodaySpecial",
        "isParcelAvailable",
      ],
      order: [
        ["isTodaySpecial", "DESC"],
        ["name", "ASC"],
      ],
    });

    // 🚀 FILTER BY HIDDEN CATEGORIES
    const hiddenBanners = await Banner.findAll({
      where: { cafeteriaId, isVisible: false }
    });
    const hiddenNames = new Set(hiddenBanners.map(b => b.name.toLowerCase().trim()));

    if (hiddenNames.size > 0) {
      items = items.filter(item => {
        const cat = item.category?.toLowerCase().trim();
        return !hiddenNames.has(cat);
      });
    }

    // ✅ BUILD RESPONSE OBJECT
    const response = {
      cafeteriaOpen: cafeteria.isOpen,
      cafeteriaOffline: cafeteria.isOffline,
      count: items.length,
      data: items,
    };

    // ✅ SAVE TO REDIS CACHE
    await menuCacheSet(cacheKey, response);

    return res.json({
      success: true,
      cached: false,
      ...response,
    });

  } catch (err) {
    console.error("❌ Public menu error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch menu",
    });
  }
};
/**
 * 🚀 REPLACE MENU ITEM IMAGE (S3)
 * URL: /api/menu/replace-image/:id
 */
export const replaceMenuImage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }

    const item = await MenuItem.findByPk(id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Menu item not found" });
    }

    const s3 = getS3Client();
    const bucket = getS3Bucket();

    // 1. DELETE OLD IMAGE FROM S3 (optional, if it was an S3 image)
    if (item.imageUrl && item.imageUrl.includes(".amazonaws.com/")) {
      try {
        const urlParts = item.imageUrl.split(".amazonaws.com/");
        if (urlParts.length > 1) {
          const oldS3Key = urlParts[1];
          await s3.send(
            new DeleteObjectCommand({
              Bucket: bucket,
              Key: oldS3Key,
            })
          );
        }
      } catch (s3DelErr) {
        console.error("Failed to delete old menu image from S3:", s3DelErr.message);
      }
    }

    // 2. UPLOAD NEW IMAGE
    const safeName = slugify(item.name, { lower: true });
    const ext = req.file.mimetype === "image/png" ? "png" : "jpg";
    const newS3Key = `images/menu/${safeName}-${Date.now()}.${ext}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: newS3Key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
    );

    const newImageUrl = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${newS3Key}`;

    // 3. UPDATE DB
    item.imageUrl = newImageUrl;
    await item.save();

    // 4. CLEAR CACHE
    await clearMenuCache();

    return res.json({
      success: true,
      message: "Image replaced successfully ✨",
      imageUrl: newImageUrl
    });

  } catch (err) {
    console.error("replaceMenuImage error:", err);
    return res.status(500).json({
      success: false,
      message: "Replacement failed",
      error: err.message
    });
  }
};


/* ================== VALIDATE CART ITEMS BEFORE PAYMENT ================== */
/**
 * POST /api/menu/validate-cart
 * Body: { items: [{ menuItemId, quantity }] }
 * Returns: { valid: bool, issues: [{ menuItemId, name, reason }] }
 */
export const validateCartItems = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Items array required" });
    }

    const ids = items.map((i) => i.menuItemId).filter(Boolean);

    const dbItems = await MenuItem.findAll({
      where: { id: ids },
      attributes: ["id", "name", "isAvailable", "isDeleted", "stock", "trackStock"],
    });

    const dbMap = {};
    dbItems.forEach((i) => { dbMap[i.id] = i; });

    const issues = [];

    for (const cartItem of items) {
      const db = dbMap[cartItem.menuItemId];

      if (!db || db.isDeleted) {
        issues.push({
          menuItemId: cartItem.menuItemId,
          name: cartItem.name || `Item #${cartItem.menuItemId}`,
          reason: "removed", // item no longer exists in menu
        });
        continue;
      }

      if (!db.isAvailable) {
        issues.push({
          menuItemId: db.id,
          name: db.name,
          reason: "unavailable",
        });
        continue;
      }

      // trackStock = true means we enforce stock count
      const effectiveTrackStock = true; // treat all items as stock-tracked per system policy
      if (effectiveTrackStock && db.stock <= 0) {
        issues.push({
          menuItemId: db.id,
          name: db.name,
          reason: "out_of_stock",
        });
        continue;
      }

      // If stock-tracked and requested qty exceeds available stock
      if (effectiveTrackStock && db.stock < cartItem.quantity) {
        issues.push({
          menuItemId: db.id,
          name: db.name,
          reason: "insufficient_stock",
          available: db.stock,
          requested: cartItem.quantity,
        });
      }
    }

    return res.json({
      success: true,
      valid: issues.length === 0,
      issues,
    });
  } catch (err) {
    console.error("validateCartItems error:", err);
    return res.status(500).json({ success: false, message: "Validation failed", error: err.message });
  }
};

// --------------------------------------------------
// GET RECENT STOCK-OUTS (last 5 minutes)
// Called by admin app on socket reconnect to recover missed STOCK_UPDATE events
// --------------------------------------------------
export const getRecentStockOuts = async (req, res) => {
  try {
    const cafeteriaId = req.user.cafeteriaId;
    const fiveMinutesAgo = new Date(Date.now() - 60 * 60 * 1000); // 1 hour window

    const items = await MenuItem.findAll({
      where: {
        cafeteriaId,
        trackStock: true,
        stock: 0,
        isAvailable: false,
        updatedAt: { [Op.gte]: fiveMinutesAgo },
      },
      attributes: ["id", "name", "stock", "updatedAt"],
    });

    return res.json({ success: true, items });
  } catch (err) {
    console.error("getRecentStockOuts error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
