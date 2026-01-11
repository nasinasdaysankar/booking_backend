// controllers/adminCafeteriaController.js
import { Cafeteria } from "../models/index.js";

export const getCafeteriaDetails = async (req, res) => {
  try {
    const cafeteriaId = parseInt(req.params.id);

    // Security: Ensure admin can only access their own cafeteria
    if (req.user.cafeteriaId !== cafeteriaId) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You can only view your own cafeteria"
      });
    }

   const cafeteria = await Cafeteria.findByPk(cafeteriaId, {
  attributes: ['id', 'name', 'location', 'isOpen', 'staticQrToken']
});


    if (!cafeteria) {
      return res.status(404).json({
        success: false,
        message: "Cafeteria not found"
      });
    }

    res.json({
      success: true,
      id: cafeteria.id,
      name: cafeteria.name,
      location: cafeteria.location || null
    });
  } catch (error) {
    console.error("Get cafeteria details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cafeteria details"
    });
  }
};


export const getMyCafeterias = async (req, res) => {
  try {
    const ownerId = req.user.id; // ADMIN ID

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

export const updateCafeteria = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location, isOpen } = req.body;
    const adminCafeteriaId = req.user.cafeteriaId;

    // Verify admin can only update their own cafeteria
    if (parseInt(id) !== adminCafeteriaId) {
      return res.status(403).json({ 
        message: "You can only update your own cafeteria" 
      });
    }

    const cafeteria = await Cafeteria.findByPk(id);

    if (!cafeteria) {
      return res.status(404).json({ message: "Cafeteria not found" });
    }

    // Update only provided fields
    if (name !== undefined) cafeteria.name = name;
    if (location !== undefined) cafeteria.location = location;
    if (isOpen !== undefined) cafeteria.isOpen = isOpen;

    await cafeteria.save();

    console.log(`✅ Cafeteria ${id} updated by admin ${req.user.id}`);

    return res.json({
      message: "Cafeteria updated successfully",
      data: {
        id: cafeteria.id,
        name: cafeteria.name,
        location: cafeteria.location,
        isOpen: cafeteria.isOpen,
        staticQrToken: cafeteria.staticQrToken,
      },
    });
  } catch (err) {
    console.error("UPDATE CAFETERIA ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};