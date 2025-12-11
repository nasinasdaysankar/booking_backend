import { DataTypes } from "sequelize";

export default (sequelize) => {
  const Banner = sequelize.define("Banner", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    imageUrl: { type: DataTypes.STRING, allowNull: false },
    cafeteriaId: { type: DataTypes.INTEGER, allowNull: false } // NEW FIELD
  }, {
    tableName: "banners",
    timestamps: true
  });

  return Banner;
};
