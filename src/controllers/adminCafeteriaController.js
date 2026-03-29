import { Cafeteria } from "../models/index.js";

/**
 * 🔐 GET LOGGED-IN ADMIN'S CAFETERIA DETAILS
 * Used in Admin Dashboard (single cafeteria view)
 */
export const getCafeteriaDetails = async (req, res) => {
  try {
    const cafeteriaId = Number(req.params.id);

    // 🔒 Admin can access only their cafeteria
    if (req.user.cafeteriaId !== cafeteriaId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const cafeteria = await Cafeteria.findByPk(cafeteriaId, {
      attributes: [
        "id",
        "name",
        "latitude",
        "longitude",
        "isOpen",
        "isOffline",
        "isInsideCampus",

        "gstType",
        "gstAmount",
        "platformFeeType",
        "platformFeeAmount",
        "commissionType",
        "commissionAmount",
        "bufferTime",
      ],
    });

    if (!cafeteria) {
      return res.status(404).json({
        success: false,
        message: "Cafeteria not found",
      });
    }

    return res.json({
      success: true,
      data: cafeteria,
    });
  } catch (error) {
    console.error("❌ Get cafeteria error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch cafeteria",
    });
  }
};

/**
 * 🏪 GET ALL CAFETERIAS OWNED BY LOGGED-IN ADMIN
 * Used for dropdown / switching cafeterias
 */
export const getMyCafeterias = async (req, res) => {
  try {
    const ownerId = req.user.id;

    const cafeterias = await Cafeteria.findAll({
      where: { ownerId },
      attributes: [
        "id",
        "name",
        "latitude",
        "longitude",

        "isOpen",
        "isOffline",
        "isInsideCampus",
        "gstType",
        "gstAmount",
        "platformFeeType",
        "platformFeeAmount",
        "commissionType",
        "commissionAmount",
        "bufferTime",
      ],
      order: [["createdAt", "ASC"]],
    });

    return res.json({
      success: true,
      cafeterias,
    });
  } catch (err) {
    console.error("❌ Fetch cafeterias error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch cafeterias",
    });
  }
};

/**
 * ✏️ UPDATE CAFETERIA (ADMIN ONLY)
 * Supports name, location, latitude, longitude, isOpen
 */
export const updateCafeteria = async (req, res) => {
  try {
    const cafeteriaId = Number(req.params.id);
    const adminCafeteriaId = req.user.cafeteriaId;

    const {
      name,
      latitude,
      longitude,
      isOpen,
      isOffline,
      isInsideCampus,
      gstType,
      gstAmount,
      platformFeeType,
      platformFeeAmount,
      commissionType,
      commissionAmount,
      bufferTime,
    } = req.body;

    // 🔒 Admin can update only their cafeteria
    if (cafeteriaId !== adminCafeteriaId) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own cafeteria",
      });
    }

    const cafeteria = await Cafeteria.findByPk(cafeteriaId);

    if (!cafeteria) {
      return res.status(404).json({
        success: false,
        message: "Cafeteria not found",
      });
    }

    // ✅ Update only provided fields
    if (name !== undefined) cafeteria.name = name;
    if (latitude !== undefined) cafeteria.latitude = latitude;
    if (longitude !== undefined) cafeteria.longitude = longitude;
    if (isOpen !== undefined) cafeteria.isOpen = isOpen;
    if (isOffline !== undefined) cafeteria.isOffline = isOffline;
    if (isInsideCampus !== undefined) cafeteria.isInsideCampus = isInsideCampus;
    if (gstType !== undefined) cafeteria.gstType = gstType;
    if (gstAmount !== undefined) cafeteria.gstAmount = gstAmount;
    if (platformFeeType !== undefined) cafeteria.platformFeeType = platformFeeType;
    if (platformFeeAmount !== undefined) cafeteria.platformFeeAmount = platformFeeAmount;
    if (commissionType !== undefined) cafeteria.commissionType = commissionType;
    if (commissionAmount !== undefined) cafeteria.commissionAmount = commissionAmount;
    if (bufferTime !== undefined) cafeteria.bufferTime = bufferTime;

    await cafeteria.save();

    console.log(`✅ Cafeteria ${cafeteriaId} updated by admin ${req.user.id}`);

    return res.json({
      success: true,
      message: "Cafeteria updated successfully",
      data: {
        id: cafeteria.id,
        name: cafeteria.name,
        latitude: cafeteria.latitude,
        longitude: cafeteria.longitude,
        isOpen: cafeteria.isOpen,
        isOffline: cafeteria.isOffline,
        isInsideCampus: cafeteria.isInsideCampus,

        gstType: cafeteria.gstType,
        gstAmount: cafeteria.gstAmount,
        platformFeeType: cafeteria.platformFeeType,
        platformFeeAmount: cafeteria.platformFeeAmount,
        commissionType: cafeteria.commissionType,
        commissionAmount: cafeteria.commissionAmount,
        bufferTime: cafeteria.bufferTime,
      },
    });
  } catch (err) {
    console.error("❌ UPDATE CAFETERIA ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
