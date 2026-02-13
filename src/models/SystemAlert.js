import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const SystemAlert = sequelize.define('SystemAlert', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        type: { type: DataTypes.STRING, allowNull: false }, // e.g. 'LOW_STOCK', 'ERROR', 'PAYMENT_FAILURE'
        title: { type: DataTypes.STRING, allowNull: false },
        message: { type: DataTypes.TEXT, allowNull: false },
        priority: { type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'), defaultValue: 'MEDIUM' },
        status: { type: DataTypes.ENUM('ACTIVE', 'RESOLVED', 'ACKNOWLEDGED'), defaultValue: 'ACTIVE' },
        cafeteriaId: { type: DataTypes.INTEGER, allowNull: true },
        metadata: { type: DataTypes.JSONB, allowNull: true },
    }, {
        tableName: 'system_alerts',
        timestamps: true
    });
    return SystemAlert;
};
