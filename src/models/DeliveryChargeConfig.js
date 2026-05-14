import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const DeliveryChargeConfig = sequelize.define('DeliveryChargeConfig', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        // ranges: [{ minKm: number, maxKm: number, price: number }]
        ranges: {
            type: DataTypes.JSONB,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
            defaultValue: 'PENDING'
        },
        adminId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'admin_id'
        },
        cafeteriaId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'cafeteria_id'
        },

        approverId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: 'approver_id'
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            field: 'is_active'
        },
        rejectionReason: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'rejection_reason'
        }
    }, {
        tableName: 'delivery_charge_configs',
        timestamps: true,
        underscored: true
    });

    return DeliveryChargeConfig;
};
