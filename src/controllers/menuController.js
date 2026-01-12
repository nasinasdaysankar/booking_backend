
// import { MenuItem, sequelize } from "../models/index.js";

// /* ================== ADD SINGLE MENU ITEM ================== */
// export const addMenuItem = async (req, res) => {
//   try {
//     const { cafeteriaId, name, price, imageUrl, category } = req.body;

//     if (!cafeteriaId || !name || !price)
//       return res.status(400).json({ success:false, message:"Missing fields" });

//     const item = await MenuItem.create({ cafeteriaId, name, price, imageUrl, category });

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


// /* ================== GET BY CAFETERIA ================== */
// export const getMenuByCafeteria = async (req, res) => {
//   try {
//     const items = await MenuItem.findAll({ where:{ cafeteriaId:req.params.id }});

//     res.json({ success:true, count:items.length, data:items });
//   } catch (err) {
//     res.status(500).json({ success:false, message:"Fetch failed", error:err.message });
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
//     const { name, price, category, isAvailable } = req.body;

//     // Create an object with only the fields provided in the body
//     const updateData = {};
//     if (name) updateData.name = name;
//     if (price) updateData.price = price;
//     if (category) updateData.category = category;
    
//     // Explicit check for boolean, as 'if (isAvailable)' fails on false
//     if (isAvailable !== undefined) updateData.isAvailable = isAvailable;

//     const [updated] = await MenuItem.update(updateData, { where: { id } });

//     if (updated) {
//       const updatedItem = await MenuItem.findByPk(id);
//       res.json({ success: true, message: "Item Updated ✔", data: updatedItem });
//     } else {
//       res.status(404).json({ success: false, message: "Item not found" });
//     }

//   } catch (err) {
//     res.status(500).json({ success: false, message: "Update failed", error: err.message });
//   }
// };


// // controllers/menuController.js
// export const getMostLovedItems = async (req, res) => {
//   try {
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
//       GROUP BY mi.id
//       ORDER BY "orderCount" DESC
//       LIMIT 10
//     `);

//     res.json({
//       success: true,
//       data: items,
//     });
//   } catch (err) {
//     console.error("Most loved items error:", err);
//     res.status(500).json({ success: false, error: err.message });
//   }
// };








import { MenuItem, sequelize } from "../models/index.js";
import { Op } from "sequelize";


/* ================== ADD SINGLE MENU ITEM ================== */
export const addMenuItem = async (req, res) => {
  try {
    const { cafeteriaId, name, price, imageUrl, category, isTodaySpecial } = req.body;

    if (!cafeteriaId || !name || !price)
      return res.status(400).json({ success:false, message:"Missing fields" });

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

    res.json({ success:true, message:"Item Added ✔", data:item });
  } catch (err) {
    res.status(500).json({ success:false, message:"Insert failed", error:err.message });
  }
};


/* ================== BULK MENU INSERT ================== */
export const addBulkMenuItems = async (req, res) => {
  try {

    // FIXED → reads array under items[]
    const { items } = req.body;  

    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ success:false, message:"Items array required" });

    const result = await MenuItem.bulkCreate(items);

    res.json({
      success:true,
      inserted:result.length,
      message:"Bulk Menu Inserted ✔",
      data:result
    });

  } catch (err) {
    res.status(500).json({ success:false, message:"Bulk failed", error:err.message });
  }
};


/* ================== GET ALL MENU ITEMS ================== */
export const getAllMenuItems = async (req, res) => {
  try {
    const items = await MenuItem.findAll();
    res.json({ success:true, count:items.length, data:items });
  } catch (err) {
    res.status(500).json({ success:false, message:"Fetch failed", error:err.message });
  }
};


/* ================== SEARCH BY CATEGORY ================== */
export const getBeveragesMenu = async (req, res) => {
  try {
    const category = req.params.category;
    const items = await MenuItem.findAll({ where:{ category } });

    res.json({ success:true, category, count:items.length, data:items });

  } catch (err) {
    res.status(500).json({ success:false, message:"Category fetch failed", error:err.message });
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

    const isOpen = cafeteria.isOpen === true;

    // Always return these top-level flags
    const baseResponse = {
      success: true,
      isOpen,
      cafeteriaName: cafeteria.name || `Cafeteria ${cafeteriaId}`,
      message: isOpen ? "Open" : "Currently closed",
    };

    if (!isOpen) {
      return res.json({
        ...baseResponse,
        closed: true,
        data: [],           // no menu items
      });
    }

    // ────────────────────────────────────────
    // Only reached when open
    // ────────────────────────────────────────

    // Clean expired specials
    const today = new Date().toISOString().split("T")[0];
    await MenuItem.update(
      { isTodaySpecial: false, specialDate: null },
      {
        where: {
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

    res.json({
      ...baseResponse,
      closed: false,
      count: items.length,
      data: items,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};



/* ================== SINGLE IMAGE UPDATE ================== */
export const updateSingleImage = async (req, res) => {
  try {
    await MenuItem.update({ imageUrl:req.body.imageUrl },{ where:{ id:req.params.id }});
    res.json({success:true,message:"Image Updated ✔"});
  } catch(err){
    res.status(500).json({success:false,error:err.message});
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
export const updateMultipleImages = async(req,res)=>{
  try{
    const { items } = req.body;
    if(!items) return res.status(400).json({message:"Items required"});

    for(const item of items)
      if(item.id) await MenuItem.update({imageUrl:item.imageUrl},{where:{id:item.id}});

    res.json({success:true,message:"Images Updated ✔"});

  }catch(err){
    res.status(500).json({success:false,error:err.message});
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
    res.status(500).json({ success:false, error: err.message });
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
    const { name, price, category, isAvailable, isTodaySpecial } = req.body;

    const item = await MenuItem.findByPk(id);
    if (!item) return res.status(404).json({ success:false, message:"Item not found" });

    const today = new Date().toISOString().split("T")[0];

    if (name) item.name = name;
    if (price) item.price = price;
    if (category) item.category = category;
    if (isAvailable !== undefined) item.isAvailable = isAvailable;

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

    res.json({ success:true, message:"Item Updated ✔", data:item });
  } catch (err) {
    res.status(500).json({ success:false, message:"Update failed", error:err.message });
  }
};



// controllers/menuController.js
export const getMostLovedItems = async (req, res) => {
  try {
    const cafeteriaId = req.query.cafeteriaId;

    let cafeteriaFilter = "";
    if (cafeteriaId) {
      cafeteriaFilter = `AND mi."cafeteriaId" = ${cafeteriaId}`;
    }

    const [items] = await sequelize.query(`
      SELECT
        mi.id,
        mi.name,
        mi.price,
        mi."imageUrl",
        mi."cafeteriaId",
        COUNT(oi.id) AS "orderCount"
      FROM order_items oi
      JOIN menu_items mi ON mi.id = oi."menuItemId"
      JOIN orders o ON o.id = oi."orderId"
      WHERE o.status IN ('PAID', 'PREPARING', 'READY', 'COMPLETED')
      ${cafeteriaFilter}
      GROUP BY mi.id
      ORDER BY "orderCount" DESC
      LIMIT 10
    `);

    res.json({
      success: true,
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
    const today = new Date().toISOString().split("T")[0];

    const cafeteria = await Cafeteria.findByPk(cafeteriaId);
    if (!cafeteria || cafeteria.isOpen === false) {
      return res.json({
        success: true,
        closed: true,
        data: [],
      });
    }

    const items = await MenuItem.findAll({
      where: {
        cafeteriaId,
        isTodaySpecial: true,
        specialDate: today,
        isAvailable: true,
        isDeleted: false,
      },
    });

    res.json({
      success: true,
      closed: false,
      data: items,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
