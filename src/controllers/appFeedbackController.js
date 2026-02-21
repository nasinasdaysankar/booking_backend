import { AppFeedback, User } from "../models/index.js";

export const submitAppFeedback = async (req, res) => {
    try {
        console.log("📥 RECEIVED APP FEEDBACK:", req.body);
        const { rating, comment, platform, appVersion } = req.body;
        const userId = req.user.id;
        console.log("👤 USER ID:", userId);

        const feedback = await AppFeedback.create({
            userId,
            rating,
            comment: comment || "",
            platform,
            appVersion,
        });

        return res.status(201).json({
            success: true,
            message: "Feedback submitted successfully",
            feedback,
        });
    } catch (error) {
        console.error("❌ submitAppFeedback ERROR:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const getAllAppFeedback = async (req, res) => {
    try {
        const feedback = await AppFeedback.findAll({
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["id", "name", "email", "phone"],
                },
            ],
            order: [["createdAt", "DESC"]],
        });

        return res.json(feedback);
    } catch (error) {
        console.error("❌ getAllAppFeedback ERROR:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
};
