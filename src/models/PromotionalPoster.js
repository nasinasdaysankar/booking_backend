import { DataTypes } from "sequelize";

export default (sequelize) => {
  const PromotionalPoster = sequelize.define("PromotionalPoster", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    imageUrl: { type: DataTypes.STRING, allowNull: false, field: "imageurl" },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_active" },

    createdAt: {
      type: DataTypes.DATE,
      field: "created_at"
    },

    updatedAt: {
      type: DataTypes.DATE,
      field: "updated_at"
    }
  }, {
    tableName: "promotional_posters",
    timestamps: true,
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at"
  });

  return PromotionalPoster;
};
