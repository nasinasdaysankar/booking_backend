import { Cafeteria } from "../models/index.js";
import { emitCafeteriaUpdate } from "../socket.js";
import { clearCafeteriaCache, clearMenuCache } from "../utils/cache.js";

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
        "bufferTime",
        "isBusy",
        "openTime",
        "closeTime",
        "visibilityRadius",
        "requestedVisibilityRadius",
        "radiusRequestStatus",
        "radiusRequestFeedback",
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
        "isBusy",
        "openTime",
        "closeTime",
        "visibilityRadius",
        "requestedVisibilityRadius",
        "radiusRequestStatus",
        "radiusRequestFeedback",
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
      isBusy,
      openTime,
      closeTime,
      visibilityRadius,
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
    if (isBusy !== undefined) cafeteria.isBusy = isBusy;
    if (openTime !== undefined) cafeteria.openTime = openTime;
    if (closeTime !== undefined) cafeteria.closeTime = closeTime;

    if (visibilityRadius !== undefined) {
      // Only process radius changes if the new value is different from the currently active value.
      // E.g., if it's already 60, don't put it in 'pending' again when updating buffer time!
      if (Number(visibilityRadius) !== Number(cafeteria.visibilityRadius)) {
        if (visibilityRadius <= 40) {
          cafeteria.visibilityRadius = visibilityRadius;
          cafeteria.radiusRequestStatus = "none";
          cafeteria.requestedVisibilityRadius = null;
          cafeteria.radiusRequestFeedback = null;
        } else {
          // If the admin is requesting a DIFFERENT radius > 40, set it to pending.
          if (Number(visibilityRadius) !== Number(cafeteria.requestedVisibilityRadius)) {
            cafeteria.requestedVisibilityRadius = visibilityRadius;
            cafeteria.radiusRequestStatus = "pending";
          }
        }
      }
    }

    await cafeteria.save();

    // 🗑️ Clear Cache instantly so changes are visible to users
    await clearCafeteriaCache();
    await clearMenuCache(cafeteriaId);

    console.log(`✅ Cafeteria ${cafeteriaId} updated by admin ${req.user.id}`);

    // Emit real-time update to all connected clients
    emitCafeteriaUpdate(cafeteriaId, {
      isOpen: cafeteria.isOpen,
      isOffline: cafeteria.isOffline,
      isBusy: cafeteria.isBusy
    });

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
        isBusy: cafeteria.isBusy,
        openTime: cafeteria.openTime,
        closeTime: cafeteria.closeTime,
        visibilityRadius: cafeteria.visibilityRadius,
        requestedVisibilityRadius: cafeteria.requestedVisibilityRadius,
        radiusRequestStatus: cafeteria.radiusRequestStatus,
        radiusRequestFeedback: cafeteria.radiusRequestFeedback,
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
