// import { DataTypes } from 'sequelize';

// export default (sequelize) => {
//   const User = sequelize.define('User', {
//     id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
//     name: { type: DataTypes.STRING, allowNull: true },
//     email: { type: DataTypes.STRING, allowNull: false, unique: true },
//     passwordHash: { type: DataTypes.STRING, allowNull: true },

//      phone: {                     // ✅ ADD THIS
//     type: DataTypes.STRING,
//     allowNull: true,
//   },


//   otpCode: {
//   type: DataTypes.STRING,
// },
// otpExpiry: {
//   type: DataTypes.DATE,
// },

// fcmToken: {
//   type: DataTypes.STRING,
//   allowNull: true,
// },


//     role: { // 'student' or 'staff'
//       type: DataTypes.ENUM('student', 'staff', 'admin'),
//       allowNull: false,
//       defaultValue: 'student'
//     },
//     cafeteriaId: { // for staff users
//       type: DataTypes.INTEGER,
//       allowNull: true
//     }
//   }, {
//     tableName: 'users',
//     timestamps: true
//   });

//   return User;
// };

import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING, allowNull: true, field: "passwordhash" },
    // googleId: { type: DataTypes.STRING, allowNull: true },  // TODO: Uncomment after running migration

    phone: {                     // ✅ ADD THIS
      type: DataTypes.STRING,
      allowNull: true,
    },


    otpCode: {
      type: DataTypes.STRING,
      field: "otpcode",
    },
    otpExpiry: {
      type: DataTypes.DATE,
      field: "otpexpiry",
    },

    fcmToken: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "fcmtoken",
    },


    role: { // 'student' or 'staff'
      type: DataTypes.ENUM('student', 'staff', 'admin'),
      allowNull: false,
      defaultValue: 'student'
    },
    cafeteriaId: { // for staff users
      type: DataTypes.INTEGER,
      allowNull: true,
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
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  });

  return User;
};
