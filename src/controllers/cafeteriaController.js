import { Cafeteria, MenuItem } from '../models/index.js';

export const getCafeterias = async (req, res) => {
  try {
    const cafes = await Cafeteria.findAll();
    res.json(cafes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching cafeterias' });
  }
};

export const getCafeteriaMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const items = await MenuItem.findAll({ where: { cafeteriaId: id, isAvailable: true } });
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching menu' });
  }
};


export const getMyCafeterias = async (req, res) => {
  try {
    const ownerId = req.user.id; // 🔥 ADMIN ID from JWT

    const cafeterias = await Cafeteria.findAll({
      where: { ownerId },
      attributes: ["id", "name", "location", "staticQrToken", "isOpen"],
      order: [["createdAt", "ASC"]],
    });

    return res.json({
      success: true,
      cafeterias,
    });
  } catch (err) {
    console.error("❌ Fetch cafeterias error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cafeterias",
    });
  }
};