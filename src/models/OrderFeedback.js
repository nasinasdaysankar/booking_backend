import { DataTypes } from "sequelize";

export default (sequelize) => {
  const OrderFeedback = sequelize.define("OrderFeedback", {
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "orderid",
    },
    studentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "studentid",
    },
    cafeteriaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "cafeteriaid",
    },

    createdAt: {
      type: DataTypes.DATE,
      field: "created_at",
    },

    updatedAt: {
      type: DataTypes.DATE,
      field: "updated_at",
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5,
      },
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    deliveryRating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "delivery_rating",
      validate: {
        min: 1,
        max: 5,
      },
    },
    deliveryComment: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "delivery_comment",
    },
    deliveryPartnerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "delivery_partner_id",
    },
  }, {
    tableName: 'order_feedbacks',
    timestamps: true,
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  });

  return OrderFeedback;
};
