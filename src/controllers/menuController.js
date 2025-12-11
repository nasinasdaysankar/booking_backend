import { MenuItem } from "../models/index.js";

/* ================== ADD SINGLE MENU ITEM ================== */
export const addMenuItem = async (req, res) => {
  try {
    const { cafeteriaId, name, price, imageUrl, category } = req.body;

    if (!cafeteriaId || !name || !price)
      return res.status(400).json({ success:false, message:"Missing fields" });

    const item = await MenuItem.create({ cafeteriaId, name, price, imageUrl, category });

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


/* ================== GET BY CAFETERIA ================== */
export const getMenuByCafeteria = async (req, res) => {
  try {
    const items = await MenuItem.findAll({ where:{ cafeteriaId:req.params.id }});

    res.json({ success:true, count:items.length, data:items });
  } catch (err) {
    res.status(500).json({ success:false, message:"Fetch failed", error:err.message });
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