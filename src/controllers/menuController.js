// import { MenuItem, sequelize } from "../models/index.js";
// import { Op } from "sequelize";


// /* ================== ADD SINGLE MENU ITEM ================== */
// export const addMenuItem = async (req, res) => {
//   try {
//     const { cafeteriaId, name, price, imageUrl, category, isTodaySpecial } = req.body;

//     if (!cafeteriaId || !name || !price)
//       return res.status(400).json({ success:false, message:"Missing fields" });

//     const today = new Date().toISOString().split("T")[0];

//     const item = await MenuItem.create({
//       cafeteriaId,
//       name,
//       price,
//       imageUrl,
//       category,
//       isTodaySpecial: isTodaySpecial === true,
//       specialDate: isTodaySpecial ? today : null,
//     });

//     res.json({ success:true, message:"Item Added ✔", data:item });
//   } catch (err) {
//     res.status(500).json({ success:false, message:"Insert failed", error:err.message });
//   }
// };


// /* ================== BULK MENU INSERT ================== */
// export const addBulkMenuItems = async (req, res) => {
//   try {

//     // FIXED → reads array under items[]
//     const { items } = req.body;  

//     if (!Array.isArray(items) || items.length === 0)
//       return res.status(400).json({ success:false, message:"Items array required" });

//     const result = await MenuItem.bulkCreate(items);

//     res.json({
//       success:true,
//       inserted:result.length,
//       message:"Bulk Menu Inserted ✔",
//       data:result
//     });

//   } catch (err) {
//     res.status(500).json({ success:false, message:"Bulk failed", error:err.message });
//   }
// };


// /* ================== GET ALL MENU ITEMS ================== */
// export const getAllMenuItems = async (req, res) => {
//   try {
//     const items = await MenuItem.findAll();
//     res.json({ success:true, count:items.length, data:items });
//   } catch (err) {
//     res.status(500).json({ success:false, message:"Fetch failed", error:err.message });
//   }
// };


// /* ================== SEARCH BY CATEGORY ================== */
// export const getBeveragesMenu = async (req, res) => {
//   try {
//     const category = req.params.category;
//     const items = await MenuItem.findAll({ where:{ category } });

//     res.json({ success:true, category, count:items.length, data:items });

//   } catch (err) {
//     res.status(500).json({ success:false, message:"Category fetch failed", error:err.message });
//   }
// };
// export const getDeletedMenuItems = async (req, res) => {
//   const { cafeteriaId } = req.query;

//   const items = await MenuItem.findAll({
//     where: {
//       cafeteriaId,
//       isDeleted: true,
//     },
//     order: [['updatedAt', 'DESC']],
//   });

//   res.json({
//     success: true,
//     data: items,
//   });
// };


// /* ================== GET BY CAFETERIA ================== */
// import { Cafeteria } from "../models/index.js";

// export const getMenuByCafeteria = async (req, res) => {
//   try {
//     const cafeteriaId = req.params.id;

//     // Only check cafeteria exists
//     const cafeteria = await Cafeteria.findByPk(cafeteriaId);
//     if (!cafeteria) {
//       return res.status(404).json({
//         success: false,
//         message: "Cafeteria not found",
//       });
//     }

//     // 🔥 Clean expired specials
//     const today = new Date().toISOString().split("T")[0];
//     await MenuItem.update(
//       { isTodaySpecial: false, specialDate: null },
//       {
//         where: {
//           isTodaySpecial: true,
//           specialDate: { [Op.ne]: today },
//         },
//       }
//     );

//     // 🔥 ALWAYS return menu (even if cafeteria closed)
//     const items = await MenuItem.findAll({
//       where: {
//         cafeteriaId,
//         isDeleted: false,
//         isAvailable: true,
//       },
//       order: [
//         ["isTodaySpecial", "DESC"],
//         ["name", "ASC"],
//       ],
//     });

//     res.json({
//       success: true,
//       cafeteriaOpen: cafeteria.isOpen, // frontend may show status
//       count: items.length,
//       data: items,
//     });

//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };


// /* ================== SINGLE IMAGE UPDATE ================== */
// export const updateSingleImage = async (req, res) => {
//   try {
//     await MenuItem.update({ imageUrl:req.body.imageUrl },{ where:{ id:req.params.id }});
//     res.json({success:true,message:"Image Updated ✔"});
//   } catch(err){
//     res.status(500).json({success:false,error:err.message});
//   }
// };

// /* ================== SOFT DELETE MENU ITEM ================== */
// export const deleteMenuItem = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const [updated] = await MenuItem.update(
//       { isDeleted: true, isAvailable: false },
//       { where: { id } }
//     );

//     if (!updated) {
//       return res.status(404).json({
//         success: false,
//         message: "Item not found",
//       });
//     }

//     res.json({
//       success: true,
//       message: "Menu item deleted (soft delete) ✔",
//     });
//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: "Delete failed",
//       error: err.message,
//     });
//   }
// };


// /* ================== BULK IMAGE UPDATE ================== */
// export const updateMultipleImages = async(req,res)=>{
//   try{
//     const { items } = req.body;
//     if(!items) return res.status(400).json({message:"Items required"});

//     for(const item of items)
//       if(item.id) await MenuItem.update({imageUrl:item.imageUrl},{where:{id:item.id}});

//     res.json({success:true,message:"Images Updated ✔"});

//   }catch(err){
//     res.status(500).json({success:false,error:err.message});
//   }
// };

// export const updateCategoryBulk = async (req, res) => {
//   try {
//     const { items } = req.body;

//     if (!Array.isArray(items) || items.length === 0)
//       return res.status(400).json({ message: "Items array required" });

//     for (const item of items) {
//       await MenuItem.update(
//         { category: item.category },
//         { where: { name: item.name } }
//       );
//     }

//     res.json({ success: true, message: "Categories Updated Successfully ✔" });

//   } catch (err) {
//     res.status(500).json({ success:false, error: err.message });
//   }
// };
// export const updateImageById = async (req, res) => {
//   try {
//     const { id, imageUrl } = req.body;

//     if (!id || !imageUrl) 
//       return res.status(400).json({ success: false, message: "id & imageUrl required" });

//     await MenuItem.update(
//       { imageUrl },
//       { where: { id } }
//     );

//     res.json({ success: true, message: "Image updated successfully!" });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

// export const uploadBulkImages = async (req, res) => {
//   try {
//     const cafeteriaId = req.body.cafeteriaId;
//     const files = req.files;

//     let results = [];

//     for (const file of files) {
//       const originalName = file.originalname.replace(/\.(jpg|jpeg|png)$/i, "");
//       console.log("Searching:", originalName);

//       const item = await MenuItem.findOne({
//         where: {
//           cafeteriaId,
//           name: sequelize.where(
//             sequelize.fn("LOWER", sequelize.col("name")),
//             "LIKE",
//             "%" + originalName.toLowerCase() + "%"
//           )
//         }
//       });

//       if (!item) {
//         results.push({ file: originalName, status: "NOT FOUND" });
//         continue;
//       }

//       const uploadResult = await cloudinary.v2.uploader.upload(file.path, {
//         folder: "restaurant_items"
//       });

//       await item.update({ imageUrl: uploadResult.secure_url });

//       results.push({ 
//         id: item.id, 
//         name: item.name, 
//         url: uploadResult.secure_url, 
//         status: "UPDATED" 
//       });

//       fs.unlinkSync(file.path); // delete temp file
//     }

//     res.json({ success: true, results });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };
// /* ================== UPDATE MENU ITEM (Edit & Toggle) ================== */
// export const updateMenuItem = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { name, price, category, isAvailable, isTodaySpecial } = req.body;

//     const item = await MenuItem.findByPk(id);
//     if (!item) return res.status(404).json({ success:false, message:"Item not found" });

//     const today = new Date().toISOString().split("T")[0];

//     if (name) item.name = name;
//     if (price) item.price = price;
//     if (category) item.category = category;
//     if (isAvailable !== undefined) item.isAvailable = isAvailable;

//     // ⭐ Today Special logic
//     if (isTodaySpecial !== undefined) {
//       if (isTodaySpecial === true) {
//         item.isTodaySpecial = true;
//         item.specialDate = today;
//       } else {
//         item.isTodaySpecial = false;
//         item.specialDate = null;
//       }
//     }

//     await item.save();

//     res.json({ success:true, message:"Item Updated ✔", data:item });
//   } catch (err) {
//     res.status(500).json({ success:false, message:"Update failed", error:err.message });
//   }
// };



// // controllers/menuController.js
// export const getMostLovedItems = async (req, res) => {
//   try {
//     const cafeteriaId = req.query.cafeteriaId;

//     let cafeteriaFilter = "";
//     if (cafeteriaId) {
//       cafeteriaFilter = `AND mi."cafeteriaId" = ${cafeteriaId}`;
//     }

//     const [items] = await sequelize.query(`
//       SELECT
//         mi.id,
//         mi.name,
//         mi.price,
//         mi."imageUrl",
//         mi."cafeteriaId",
//         COUNT(oi.id) AS "orderCount"
//       FROM order_items oi
//       JOIN menu_items mi ON mi.id = oi."menuItemId"
//       JOIN orders o ON o.id = oi."orderId"
//       WHERE o.status IN ('PAID', 'PREPARING', 'READY', 'COMPLETED')
//       ${cafeteriaFilter}
//       GROUP BY mi.id
//       ORDER BY "orderCount" DESC
//       LIMIT 10
//     `);

//     res.json({
//       success: true,
//       data: items,
//     });
//   } catch (err) {
//     console.error("Most loved error:", err);
//     res.status(500).json({ success: false, error: err.message });
//   }
// };


// export const getTodaySpecials = async (req, res) => {
//   try {
//     const cafeteriaId = req.params.id;
//     const today = new Date().toISOString().split("T")[0];

//     const cafeteria = await Cafeteria.findByPk(cafeteriaId);
//     if (!cafeteria) {
//       return res.status(404).json({
//         success: false,
//         message: "Cafeteria not found",
//       });
//     }

//     // 🔥 BLOCK today special when cafeteria is closed
//     if (!cafeteria.isOpen) {
//       return res.json({
//         success: true,
//         cafeteriaOpen: false,
//         data: [],   // hide today special
//       });
//     }

//     const items = await MenuItem.findAll({
//       where: {
//         cafeteriaId,
//         isTodaySpecial: true,
//         specialDate: today,
//         isAvailable: true,
//         isDeleted: false,
//       },
//     });

//     res.json({
//       success: true,
//       cafeteriaOpen: true,
//       data: items,
//     });

//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };



// export const restoreMenuItem = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const [updated] = await MenuItem.update(
//       { 
//         isDeleted: false, 
//         isAvailable: true 
//       },
//       { where: { id } }
//     );

//     if (!updated) {
//       return res.status(404).json({
//         success: false,
//         message: "Item not found",
//       });
//     }

//     const item = await MenuItem.findByPk(id);

//     res.json({
//       success: true,
//       message: "Menu item restored successfully ✔",
//       data: item,
//     });
//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: "Restore failed",
//       error: err.message,
//     });
//   }
// };










import { MenuItem, Cafeteria, sequelize } from "../models/index.js";
import { Op } from "sequelize";

// ==================== ADMIN: GET THEIR OWN CAFETERIA MENU ====================
export const getMyMenu = async (req, res) => {
  try {
    // ✅ Admin auth middleware should set req.user.cafeteriaId
    const cafeteriaId = req.user?.cafeteriaId;

    if (!cafeteriaId) {
      console.error("❌ Admin not linked to cafeteria");
      return res.status(403).json({
        success: false,
        message: "Admin account not linked to any cafeteria",
      });
    }

    // ✅ Verify cafeteria exists
    const cafeteria = await Cafeteria.findByPk(cafeteriaId);
    if (!cafeteria) {
      console.error(`❌ Cafeteria ${cafeteriaId} not found`);
      return res.status(404).json({
        success: false,
        message: "Cafeteria not found",
      });
    }

    // 🔥 Clean expired specials
    const today = new Date().toISOString().split("T")[0];
    await MenuItem.update(
      { isTodaySpecial: false, specialDate: null },
      {
        where: {
          cafeteriaId,
          isTodaySpecial: true,
          specialDate: { [Op.ne]: today },
        },
      }
    );

    // ✅ Get admin's cafeteria menu
    const items = await MenuItem.findAll({
      where: {
        cafeteriaId,
        isDeleted: false,
        isAvailable: true,
      },
      order: [
        ["isTodaySpecial", "DESC"],
        ["name", "ASC"],
      ],
      attributes: [
        "id",
        "name",
        "price",
        "imageUrl",
        "category",
        "isTodaySpecial",
        "isAvailable",
        "isParcelAvailable",
        "estPrepTimeMinutes",
        "createdAt",
      ],
    });

    console.log(`✅ Fetched ${items.length} items for admin cafeteria ${cafeteriaId}`);

    return res.json({
      success: true,
      cafeteriaOpen: cafeteria.isOpen,
      cafeteriaName: cafeteria.name, // ✅ Include cafeteria details
      count: items.length,
      data: items,
    });
  } catch (err) {
    console.error("❌ getMyMenu error:", err.message);
    console.error("❌ Stack:", err.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch menu",
      error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
    });
  }
};

// ==================== USER: GET PUBLIC MENU FOR SPECIFIC CAFETERIA ====================
export const getPublicMenuByCafeteria = async (req, res) => {
  try {
    const cafeteriaId = req.params.cafeteriaId;

    // ✅ Validate cafeteriaId is a number
    if (!cafeteriaId || isNaN(cafeteriaId)) {
      console.error(`❌ Invalid cafeteriaId: ${cafeteriaId}`);
      return res.status(400).json({
        success: false,
        message: "Valid cafeteriaId required",
      });
    }

    // ✅ Verify cafeteria exists
    const cafeteria = await Cafeteria.findByPk(cafeteriaId);
    if (!cafeteria) {
      console.error(`❌ Cafeteria ${cafeteriaId} not found`);
      return res.status(404).json({
        success: false,
        message: "Cafeteria not found",
      });
    }

    // 🔥 Clean expired specials
    const today = new Date().toISOString().split("T")[0];
    await MenuItem.update(
      { isTodaySpecial: false, specialDate: null },
      {
        where: {
          cafeteriaId,
          isTodaySpecial: true,
          specialDate: { [Op.ne]: today },
        },
      }
    );

    // ✅ Get public menu
    const items = await MenuItem.findAll({
      where: {
        cafeteriaId,
        isDeleted: false,
        isAvailable: true,
      },
      order: [
        ["isTodaySpecial", "DESC"],
        ["name", "ASC"],
      ],
      attributes: [
        "id",
        "name",
        "price",
        "imageUrl",
        "category",
        "isTodaySpecial",
        "isParcelAvailable",
        "estPrepTimeMinutes",
        "specialNote",
      ],
    });

    console.log(`✅ Fetched ${items.length} public items for cafeteria ${cafeteriaId}`);

    return res.json({
      success: true,
      cafeteriaOpen: cafeteria.isOpen,
      cafeteriaName: cafeteria.name,
      cafeteriaAddress: cafeteria.address, // ✅ Optional: Add location
      count: items.length,
      data: items,
    });
  } catch (err) {
    console.error(`❌ getPublicMenuByCafeteria error:`, err.message);
    console.error("❌ Stack:", err.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch menu",
      error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
    });
  }
};

// ==================== LEGACY: Keep for backwards compatibility ====================
export const getMenuByCafeteria = async (req, res) => {
  try {
    const cafeteriaId = req.params.id;

    // ✅ Validate input
    if (!cafeteriaId || isNaN(cafeteriaId)) {
      console.error(`❌ Invalid cafeteriaId: ${cafeteriaId}`);
      return res.status(400).json({
        success: false,
        message: "Valid cafeteriaId required",
      });
    }

    // Redirect to new endpoint
    const cafeteria = await Cafeteria.findByPk(cafeteriaId);
    if (!cafeteria) {
      return res.status(404).json({
        success: false,
        message: "Cafeteria not found",
      });
    }

    const today = new Date().toISOString().split("T")[0];
    await MenuItem.update(
      { isTodaySpecial: false, specialDate: null },
      {
        where: {
          cafeteriaId,
          isTodaySpecial: true,
          specialDate: { [Op.ne]: today },
        },
      }
    );

    const items = await MenuItem.findAll({
      where: {
        cafeteriaId,
        isDeleted: false,
        isAvailable: true,
      },
      order: [
        ["isTodaySpecial", "DESC"],
        ["name", "ASC"],
      ],
    });

    return res.json({
      success: true,
      cafeteriaOpen: cafeteria.isOpen,
      count: items.length,
      data: items,
    });
  } catch (err) {
    console.error("❌ getMenuByCafeteria error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch menu",
      error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
    });
  }
};

// ==================== ADD SINGLE MENU ITEM ====================
export const addMenuItem = async (req, res) => {
  try {
    const { cafeteriaId, name, price, imageUrl, category, isTodaySpecial } = req.body;

    if (!cafeteriaId || !name || !price) {
      return res.status(400).json({
        success: false,
        message: "cafeteriaId, name, and price are required",
      });
    }

    const today = new Date().toISOString().split("T")[0];

    const item = await MenuItem.create({
      cafeteriaId,
      name,
      price,
      imageUrl,
      category,
      isTodaySpecial: isTodaySpecial === true,
      specialDate: isTodaySpecial ? today : null,
    });

    console.log(`✅ Menu item added: ${item.name} for cafeteria ${cafeteriaId}`);

    res.json({ success: true, message: "Item Added ✔", data: item });
  } catch (err) {
    console.error("❌ addMenuItem error:", err.message);
    res.status(500).json({
      success: false,
      message: "Insert failed",
      error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
    });
  }
};

// ==================== BULK MENU INSERT ====================
export const addBulkMenuItems = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Items array required",
      });
    }

    // ✅ Validate each item has required fields
    const invalidItems = items.filter((item) => !item.cafeteriaId || !item.name || !item.price);
    if (invalidItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: `${invalidItems.length} items missing required fields (cafeteriaId, name, price)`,
      });
    }

    const result = await MenuItem.bulkCreate(items);

    console.log(`✅ Bulk insert: ${result.length} items added`);

    res.json({
      success: true,
      inserted: result.length,
      message: "Bulk Menu Inserted ✔",
      data: result,
    });
  } catch (err) {
    console.error("❌ addBulkMenuItems error:", err.message);
    res.status(500).json({
      success: false,
      message: "Bulk insert failed",
      error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
    });
  }
};

// ==================== GET ALL MENU ITEMS ====================
export const getAllMenuItems = async (req, res) => {
  try {
    const items = await MenuItem.findAll({
      where: {
        isDeleted: false,
        isAvailable: true,
      },
      attributes: [
        "id",
        "cafeteriaId",
        "name",
        "price",
        "category",
        "imageUrl",
        "isTodaySpecial",
      ],
    });

    console.log(`✅ Fetched ${items.length} total menu items`);

    res.json({ success: true, count: items.length, data: items });
  } catch (err) {
    console.error("❌ getAllMenuItems error:", err.message);
    res.status(500).json({
      success: false,
      message: "Fetch failed",
      error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
    });
  }
};

// ==================== SEARCH BY CATEGORY ====================
export const getBeveragesMenu = async (req, res) => {
  try {
    const category = req.params.category;

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category required",
      });
    }

    const items = await MenuItem.findAll({
      where: {
        category,
        isDeleted: false,
        isAvailable: true,
      },
    });

    console.log(`✅ Fetched ${items.length} items for category: ${category}`);

    res.json({ success: true, category, count: items.length, data: items });
  } catch (err) {
    console.error("❌ getBeveragesMenu error:", err.message);
    res.status(500).json({
      success: false,
      message: "Category fetch failed",
      error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
    });
  }
};

// ==================== GET DELETED ITEMS ====================
export const getDeletedMenuItems = async (req, res) => {
  try {
    const { cafeteriaId } = req.query;

    if (!cafeteriaId) {
      return res.status(400).json({
        success: false,
        message: "cafeteriaId required",
      });
    }

    const items = await MenuItem.findAll({
      where: {
        cafeteriaId,
        isDeleted: true,
      },
      order: [["updatedAt", "DESC"]],
    });

    console.log(`✅ Fetched ${items.length} deleted items for cafeteria ${cafeteriaId}`);

    res.json({
      success: true,
      data: items,
    });
  } catch (err) {
    console.error("❌ getDeletedMenuItems error:", err.message);
    res.status(500).json({
      success: false,
      message: "Fetch failed",
      error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
    });
  }
};

// ==================== UPDATE MENU ITEM ====================
export const updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, category, isAvailable, isTodaySpecial } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Menu item ID required",
      });
    }

    const item = await MenuItem.findByPk(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    const today = new Date().toISOString().split("T")[0];

    if (name) item.name = name;
    if (price) item.price = price;
    if (category) item.category = category;
    if (isAvailable !== undefined) item.isAvailable = isAvailable;

    if (isTodaySpecial !== undefined) {
      item.isTodaySpecial = isTodaySpecial === true;
      item.specialDate = isTodaySpecial ? today : null;
    }

    await item.save();

    console.log(`✅ Menu item updated: ${item.name}`);

    res.json({ success: true, message: "Item Updated ✔", data: item });
  } catch (err) {
    console.error("❌ updateMenuItem error:", err.message);
    res.status(500).json({
      success: false,
      message: "Update failed",
      error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
    });
  }
};

// ==================== DELETE MENU ITEM ====================
export const deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Menu item ID required",
      });
    }

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

    console.log(`✅ Menu item soft deleted: ID ${id}`);

    res.json({
      success: true,
      message: "Menu item deleted ✔",
    });
  } catch (err) {
    console.error("❌ deleteMenuItem error:", err.message);
    res.status(500).json({
      success: false,
      message: "Delete failed",
      error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
    });
  }
};

// ==================== RESTORE MENU ITEM ====================
export const restoreMenuItem = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Menu item ID required",
      });
    }

    const [updated] = await MenuItem.update(
      { isDeleted: false, isAvailable: true },
      { where: { id } }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    const item = await MenuItem.findByPk(id);

    console.log(`✅ Menu item restored: ID ${id}`);

    res.json({
      success: true,
      message: "Menu item restored ✔",
      data: item,
    });
  } catch (err) {
    console.error("❌ restoreMenuItem error:", err.message);
    res.status(500).json({
      success: false,
      message: "Restore failed",
      error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
    });
  }
};

// ==================== TODAY SPECIALS ====================
export const getTodaySpecials = async (req, res) => {
  try {
    const cafeteriaId = req.params.id;

    if (!cafeteriaId || isNaN(cafeteriaId)) {
      return res.status(400).json({
        success: false,
        message: "Valid cafeteriaId required",
      });
    }

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

    const today = new Date().toISOString().split("T")[0];

    const items = await MenuItem.findAll({
      where: {
        cafeteriaId,
        isTodaySpecial: true,
        specialDate: today,
        isAvailable: true,
        isDeleted: false,
      },
    });

    console.log(`✅ Fetched ${items.length} today specials for cafeteria ${cafeteriaId}`);

    res.json({
      success: true,
      cafeteriaOpen: true,
      data: items,
    });
  } catch (err) {
    console.error("❌ getTodaySpecials error:", err.message);
    res.status(500).json({
      success: false,
      message: "Fetch failed",
      error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
    });
  }
};

// ==================== MOST LOVED ITEMS ====================
export const getMostLovedItems = async (req, res) => {
  try {
    const cafeteriaId = req.query.cafeteriaId;

    if (!cafeteriaId) {
      return res.status(400).json({
        success: false,
        message: "cafeteriaId required",
      });
    }

    const [items] = await sequelize.query(
      `
      SELECT
        mi.id,
        mi.name,
        mi.price,
        mi."imageUrl",
        mi."cafeteriaId",
        COUNT(oi.id)::INT AS "orderCount"
      FROM order_items oi
      JOIN menu_items mi ON mi.id = oi."menuItemId"
      JOIN orders o ON o.id = oi."orderId"
      WHERE 
        mi."cafeteriaId" = :cafeteriaId
        AND o."paymentStatus" = 'SUCCESS'
      GROUP BY mi.id, mi.name, mi.price, mi."imageUrl", mi."cafeteriaId"
      ORDER BY "orderCount" DESC
      LIMIT 10
    `,
      {
        replacements: { cafeteriaId },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    console.log(`✅ Fetched ${items.length} most loved items for cafeteria ${cafeteriaId}`);

    res.json({
      success: true,
      data: items,
    });
  } catch (err) {
    console.error("❌ getMostLovedItems error:", err.message);
    res.status(500).json({
      success: false,
      message: "Fetch failed",
      error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
    });
  }
};