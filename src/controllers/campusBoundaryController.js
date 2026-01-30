import { CampusBoundary } from "../models/index.js";

export const getCampusBoundary = async (req, res) => {
    try {
        const boundaryPoints = await CampusBoundary.findAll({
            order: [["pointOrder", "ASC"]],
        });

        res.status(200).json({
            success: true,
            data: boundaryPoints,
        });
    } catch (error) {
        console.error("Error fetching campus boundary:", error);
        res.status(500).json({
            success: false,
            message: "Server error fetching campus boundary",
        });
    }
};
