import { User } from "../models/index.js";

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await user.update({
      name: name ?? user.name,
      phone: phone ?? user.phone,
    });

    return res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("❌ updateProfile error:", err);
    res.status(500).json({ message: "Profile update failed" });
  }
};
