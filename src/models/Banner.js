import { DataTypes } from "sequelize";

export default (sequelize) => {
  const Banner = sequelize.define("Banner", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    imageUrl: { type: DataTypes.STRING, allowNull: false, field: "imageurl" },
    cafeteriaId: { type: DataTypes.INTEGER, allowNull: false, field: "cafeteriaid" }, // NEW FIELD

    createdAt: {
      type: DataTypes.DATE,
      field: "created_at"
    },

    updatedAt: {
      type: DataTypes.DATE,
      field: "updated_at"
    }
  }, {
    tableName: "banners",
    timestamps: true,
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at"
  });

  return Banner;
};
