import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const AffiliateProduct = sequelize.define('AffiliateProduct', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.TEXT, allowNull: false },
    category: { type: DataTypes.STRING, allowNull: false },
    imageUrl: { type: DataTypes.TEXT, allowNull: true, field: 'image_url' },
    affiliateLink: { type: DataTypes.TEXT, allowNull: false, field: 'affiliate_link' },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: "is_active",
    },
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
