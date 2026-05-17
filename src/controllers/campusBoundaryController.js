import { CampusBoundary } from "../models/index.js";

// Public endpoint: Get boundaries grouped by campus name
export const getCampusBoundary = async (req, res) => {
    try {
        const boundaryPoints = await CampusBoundary.findAll({
            order: [["name", "ASC"], ["pointOrder", "ASC"]],
        });

        // Group points by campus name
        const campuses = {};
        for (const point of boundaryPoints) {
            if (!campuses[point.name]) {
                campuses[point.name] = [];
            }
            campuses[point.name].push({
                latitude: parseFloat(point.latitude),
                longitude: parseFloat(point.longitude)
            });
        }

        const data = Object.keys(campuses).map(name => ({
            name,
            points: campuses[name]
        }));

        res.status(200).json({
            success: true,
            data: data,
        });
    } catch (error) {
        console.error("Error fetching campus boundary:", error);
        res.status(500).json({
            success: false,
            message: "Server error fetching campus boundary",
        });
    }
};

// Superadmin: Create or Update a Campus Boundary
export const createOrUpdateCampusBoundary = async (req, res) => {
    try {
        const { name, points } = req.body;
        
        if (!name || !points || !Array.isArray(points)) {
            return res.status(400).json({ success: false, message: "Name and points array are required" });
        }

        // 1. Delete existing points for this campus
        await CampusBoundary.destroy({ where: { name } });

        // 2. Insert new points
        const pointsToInsert = points.map((p, index) => ({
            name: name,
            pointOrder: index,
            latitude: p.lat || p.latitude,
            longitude: p.lng || p.longitude,
            label: `Point ${index + 1}`
        }));

        await CampusBoundary.bulkCreate(pointsToInsert);

        res.status(200).json({
            success: true,
            message: "Campus boundary saved successfully",
        });
    } catch (error) {
        console.error("Error saving campus boundary:", error);
        res.status(500).json({
            success: false,
            message: "Server error saving campus boundary",
        });
    }
};

// Superadmin: Delete a Campus Boundary
export const deleteCampusBoundary = async (req, res) => {
    try {
        const { name } = req.params;
        
        if (!name) {
            return res.status(400).json({ success: false, message: "Campus name is required" });
        }

        await CampusBoundary.destroy({ where: { name } });

        res.status(200).json({
            success: true,
            message: "Campus boundary deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting campus boundary:", error);
        res.status(500).json({
            success: false,
            message: "Server error deleting campus boundary",
        });
    }
};

