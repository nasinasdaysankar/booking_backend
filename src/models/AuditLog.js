import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const AuditLog = sequelize.define('AuditLog', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        adminId: { type: DataTypes.INTEGER, allowNull: true },
        adminName: { type: DataTypes.STRING, allowNull: true }, // Store snapshot of name
        action: { type: DataTypes.STRING, allowNull: false },
        details: { type: DataTypes.JSONB, allowNull: true },
        ipAddress: { type: DataTypes.STRING, allowNull: true },
    }, {
        tableName: 'audit_logs',
        timestamps: true
    });
    return AuditLog;
};
