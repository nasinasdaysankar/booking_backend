// import { DataTypes } from 'sequelize';

// export default (sequelize) => {
//   const MenuItem = sequelize.define('MenuItem', {
//     id: { 
//       type: DataTypes.INTEGER, 
//       primaryKey: true, 
//       autoIncrement: true 
//     },

//     cafeteriaId: { 
//       type: DataTypes.INTEGER, 
//       allowNull: false 
//     },

//     name: { 
//       type: DataTypes.STRING, 
//       allowNull: false 
//     },

//     price: { 
//       type: DataTypes.DECIMAL(10, 2), 
//       allowNull: false 
//     },

//     estPrepTimeMinutes: { 
//       type: DataTypes.INTEGER, 
//       allowNull: false, 
//       defaultValue: 5 
//     },

//     isAvailable: { 
//       type: DataTypes.BOOLEAN, 
//       allowNull: false, 
//       defaultValue: true 
//     },

//     // 🔥 Cloudinary Image URL
//     imageUrl: { 
//       type: DataTypes.STRING, 
//       allowNull: true 
//     },

//     // 🔥 CATEGORY FIELD ADDED
//     category: { 
//       type: DataTypes.STRING, 
//       allowNull: true 
//     }
    
//   }, {
//     tableName: 'menu_items',
//     timestamps: true
//   });

//   return MenuItem;
// };



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
      },

      // ✅ Available for ordering
      isAvailable: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      // 🗑 Soft delete
      isDeleted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      // 🖼 Image
      imageUrl: {
        type: DataTypes.STRING,
        allowNull: true,
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
      },
isParcelAvailable: {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: true,
},
      // 📅 Which date it is special for (YYYY-MM-DD)
      specialDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },

      // 📝 Optional note shown to users
      specialNote: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: "menu_items",
      timestamps: true,

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
