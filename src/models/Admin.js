import { DataTypes } from "sequelize";
import bcrypt from "bcryptjs";

export default (sequelize) => {
  const Admin = sequelize.define(
    "Admin",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      staffId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: "staffid",
      },

      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      role: {
        type: DataTypes.ENUM("admin", "staff", "super_admin"),
        defaultValue: "staff",
      },

      cafeteriaId: {
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
    },
    {
      tableName: "admins",
      timestamps: true,
      underscored: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      hooks: {
        beforeSave: async (admin) => {
          if (admin.changed("password") && admin.password) {
            console.log(`🔐 [ADMIN MODEL] Hashing updated password for Admin ID: ${admin.id || 'NEW'}`);
            admin.password = await bcrypt.hash(admin.password, 10);
          }
        },
      },
    }
  );

  return Admin;
};

