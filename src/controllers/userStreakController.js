import { UserStreak } from "../models/index.js";

export const getUserStreak = async (req, res) => {
  try {
    const userId = req.user.id;
    const cafeteriaId = Number(req.params.cafeteriaId);

    const streak = await UserStreak.findOne({
      where: { userId, cafeteriaId },
    });

    if (!streak) {
      return res.json({
        currentStreak: 0,
        discount: 0,
        nextRewardAt: 50,
      });
    }

    let discount = 0;
    let nextRewardAt = 50;

    if (streak.currentStreak >= 80) {
      discount = 25;
      nextRewardAt = 0;
    } else if (streak.currentStreak >= 70) {
      discount = 20;
      nextRewardAt = 80;
    } else if (streak.currentStreak >= 50) {
      discount = 15;
      nextRewardAt = 70;
    }

    console.log(
      `🔥 STREAK FETCH → user=${userId}, caf=${cafeteriaId}, streak=${streak.currentStreak}`
    );

    return res.json({
      currentStreak: streak.currentStreak,
      discount,
      nextRewardAt,
    });
  } catch (err) {
    console.error("❌ getUserStreak error:", err);
    res.status(500).json({ message: "Failed to fetch streak" });
  }
};
