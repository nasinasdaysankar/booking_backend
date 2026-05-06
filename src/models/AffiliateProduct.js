import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const AffiliateProduct = sequelize.define('AffiliateProduct', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.TEXT, allowNull: false },
    category: { type: DataTypes.STRING, allowNull: false },
    subcategory: { type: DataTypes.STRING, allowNull: false },
    gender: { type: DataTypes.STRING, allowNull: true, defaultValue: 'unisex' }, // 'male', 'female', 'unisex'
    imageUrl: { type: DataTypes.TEXT, allowNull: true, field: 'image_url' },
    affiliateLink: { type: DataTypes.TEXT, allowNull: false, field: 'affiliate_link' },
    createdAt: {
      type: DataTypes.DATE,
      field: "created_at",
    },
    updatedAt: {
      type: DataTypes.DATE,
      field: "updated_at",
    },
  }, {
    tableName: 'affiliate_products',
    timestamps: true,
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  });

  return AffiliateProduct;
};
