import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING, allowNull: true },

     phone: {                     // ✅ ADD THIS
    type: DataTypes.STRING,
    allowNull: true,
  },
  

  otpCode: {
  type: DataTypes.STRING,
},
otpExpiry: {
  type: DataTypes.DATE,
},

    role: { // 'student' or 'staff'
      type: DataTypes.ENUM('student', 'staff', 'admin'),
      allowNull: false,
      defaultValue: 'student'
    },
    cafeteriaId: { // for staff users
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    tableName: 'users',
    timestamps: true
  });

  return User;
};
