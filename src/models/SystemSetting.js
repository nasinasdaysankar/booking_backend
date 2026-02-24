import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const SystemSetting = sequelize.define('SystemSetting', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        key: { type: DataTypes.STRING, unique: true, allowNull: false },
        value: { type: DataTypes.TEXT, allowNull: true },
        type: { type: DataTypes.ENUM('STRING', 'BOOLEAN', 'NUMBER', 'JSON'), defaultValue: 'STRING' },
        description: { type: DataTypes.STRING, allowNull: true },
        group: { type: DataTypes.STRING, defaultValue: 'GENERAL' },
        isPublic: { type: DataTypes.BOOLEAN, defaultValue: false, field: "ispublic" }, // If true, exposed to public API

        createdAt: {
            type: DataTypes.DATE,
            field: "created_at"
        },

        updatedAt: {
            type: DataTypes.DATE,
            field: "updated_at"
        },
    }, {
        tableName: 'system_settings',
        timestamps: true,
        underscored: true,
        createdAt: "created_at",
        updatedAt: "updated_at"
    });
    return SystemSetting;
};
