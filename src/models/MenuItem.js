import { DataTypes } from "sequelize";

export default (sequelize) => {
  const MenuItem = sequelize.define(
    "MenuItem",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      cafeteriaId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "cafeteriaid",
      },

      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },

      // ⏱ Estimated preparation time
      estPrepTimeMinutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5,
        field: "estpreptimeminutes",
      },

      // ✅ Available for ordering
      isAvailable: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: "isavailable",
      },

      // 🗑 Soft delete
      isDeleted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "isdeleted",
      },

      // 🖼 Image
      imageUrl: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "imageurl",
      },

      // 🍔 Category
      category: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      // 🔥 TODAY'S SPECIAL SYSTEM
      isTodaySpecial: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "istodayspecial",
      },
      isParcelAvailable: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: "isparcelavailable",
      },
      // 📅 Which date it is special for (YYYY-MM-DD)
      specialDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: "specialdate",
      },

      // 📝 Optional note shown to users
      specialNote: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "specialnote",
      },

      createdAt: {
        type: DataTypes.DATE,
        field: "created_at",
      },

      updatedAt: {
        type: DataTypes.DATE,
        field: "updated_at",
      },
    },
    {
      tableName: "menu_items",
      timestamps: true,
      underscored: true,
      createdAt: "created_at",
      updatedAt: "updated_at",

      indexes: [
        { fields: ["cafeteriaId"] },
        { fields: ["isAvailable"] },
        { fields: ["isDeleted"] },
        { fields: ["isTodaySpecial"] },
        { fields: ["specialDate"] },
      ],
    }
  );

  return MenuItem;
};
