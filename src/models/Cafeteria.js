// // models/Cafeteria.js
// import { DataTypes } from "sequelize";

// export default (sequelize) => {
//   const Cafeteria = sequelize.define(
//     "Cafeteria",
//     {
//       id: {
//         type: DataTypes.INTEGER,
//         primaryKey: true,
//         autoIncrement: true,
//         allowNull: false,
//       },

//       name: {
//         type: DataTypes.STRING(100),
//         allowNull: false,
//         validate: {
//           notEmpty: { msg: "Cafeteria name is required" },
//           len: { args: [3, 100], msg: "Name must be between 3 and 100 characters" },
//         },
//       },

//       location: {
//         type: DataTypes.STRING(150),
//         allowNull: true,
//       },

//       isOpen: {
//         type: DataTypes.BOOLEAN,
//         allowNull: false,
//         defaultValue: true,
//       },

//       // 🔥 THIS IS THE KEY FIX
//       isUserVisible: {
//         type: DataTypes.BOOLEAN,
//         allowNull: false,
//         defaultValue: false,
//         field: "isUserVisible", // maps to DB column
//       },

//       staticQrToken: {
//         type: DataTypes.STRING(255),
//         allowNull: false,
//         unique: true,
//         comment: "Static QR token used for cafeteria identification",
//       },

//       // Owner
//       ownerId: {
//         type: DataTypes.INTEGER,
//         allowNull: false,
//         field: "ownerid", // maps JS ownerId → DB ownerid
//       },
//     },
//     {
//       tableName: "cafeterias",
//       timestamps: true,
//       indexes: [
//         { fields: ["staticQrToken"] },
//         { fields: ["ownerid"] },
//         { fields: ["isUserVisible"] }, // 🔥 helps filtering
//       ],
//     }
//   );

//   return Cafeteria;
// };
// models/Cafeteria.js
import { DataTypes } from "sequelize";

export default (sequelize) => {
  const Cafeteria = sequelize.define(
    "Cafeteria",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },

      // ✅ FIXED LOCATION (Anantha Aahara)
      latitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
      },

      longitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
      },

      isOpen: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },

      isUserVisible: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      staticQrToken: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },

      ownerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "ownerid",
      },
    },
    {
      tableName: "cafeterias",
      timestamps: true,
    }
  );

  return Cafeteria;
};
