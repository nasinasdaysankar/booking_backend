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



import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const MenuItem = sequelize.define('MenuItem', {
    id: { 
      type: DataTypes.INTEGER, 
      primaryKey: true, 
      autoIncrement: true 
    },

    cafeteriaId: { 
      type: DataTypes.INTEGER, 
      allowNull: false 
    },

    name: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },

    price: { 
      type: DataTypes.DECIMAL(10, 2), 
      allowNull: false 
    },

    estPrepTimeMinutes: { 
      type: DataTypes.INTEGER, 
      allowNull: false, 
      defaultValue: 5 
    },

    isAvailable: { 
      type: DataTypes.BOOLEAN, 
      allowNull: false, 
      defaultValue: true 
    },
// models/MenuItem.js
isDeleted: {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: false,
},

    // 🔥 Cloudinary Image URL
    imageUrl: { 
      type: DataTypes.STRING, 
      allowNull: true 
    },

    // 🔥 CATEGORY FIELD ADDED
    category: { 
      type: DataTypes.STRING, 
      allowNull: true 
    }
    
  }, {
    tableName: 'menu_items',
    timestamps: true
  });

  return MenuItem;
};
