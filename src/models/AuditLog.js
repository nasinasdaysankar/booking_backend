import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const AuditLog = sequelize.define('AuditLog', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        adminId: { type: DataTypes.INTEGER, allowNull: true, field: "adminid" },
        action: { type: DataTypes.STRING, allowNull: false },
        details: { type: DataTypes.JSONB, allowNull: true },

        createdAt: {
            type: DataTypes.DATE,
            field: "created_at"
        },

        updatedAt: {
            type: DataTypes.DATE,
            field: "updated_at"
        },
    }, {
        tableName: 'audit_logs',
        timestamps: true,
        underscored: true,
        createdAt: "created_at",
        updatedAt: "updated_at"
    });
    return AuditLog;
};
