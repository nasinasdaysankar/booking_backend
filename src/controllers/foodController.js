import { MenuItem } from "../models/index.js";

export const createMenuItem = async (req, res) => {
  try {
    const { cafeteriaId, name, price, imageUrl } = req.body;

    const item = await MenuItem.create({
      cafeteriaId,
      name,
      price,
      imageUrl,
      isAvailable: true
    });

    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error creating item" });
  }
};
