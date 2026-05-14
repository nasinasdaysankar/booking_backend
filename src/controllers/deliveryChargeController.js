import { DeliveryChargeConfig, Admin } from '../models/index.js';
import { Op } from 'sequelize';

export const submitDeliveryChargeConfig = async (req, res) => {
    try {
        const { ranges } = req.body;
        const adminId = req.user.id;

        const cafeteriaId = req.user.cafeteriaId;

        if (!cafeteriaId) {
            return res.status(400).json({ success: false, message: 'Admin not associated with a cafeteria' });
        }

        if (!ranges || !Array.isArray(ranges) || ranges.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid ranges provided' });
        }

        // Create new config in PENDING status
        const config = await DeliveryChargeConfig.create({
            ranges,
            status: 'PENDING',
            adminId,
            cafeteriaId
        });


        res.status(201).json({ success: true, data: config });
    } catch (error) {
        console.error('Submit delivery charge config error:', error);
        res.status(500).json({ success: false, message: 'Failed to submit configuration' });
    }
};

export const getPendingConfigs = async (req, res) => {
    try {
        const configs = await DeliveryChargeConfig.findAll({
            where: { status: 'PENDING' },
            include: [{ model: Admin, as: 'creator', attributes: ['name', 'staffId'] }],
            order: [['createdAt', 'DESC']]
        });

        res.json({ success: true, data: configs });
    } catch (error) {
        console.error('Get pending configs error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch pending configurations' });
    }
};

export const approveConfig = async (req, res) => {
    try {
        const { id } = req.params;
        const approverId = req.user.id || 0; // superadminAuth might set req.user

        const config = await DeliveryChargeConfig.findByPk(id);
        if (!config) {
            return res.status(404).json({ success: false, message: 'Configuration not found' });
        }

        // 1. Mark all current active configs FOR THIS CAFETERIA as inactive
        await DeliveryChargeConfig.update(
            { isActive: false },
            { where: { cafeteriaId: config.cafeteriaId, isActive: true } }
        );

        // 2. Approve this one and make it active
        await config.update({
            status: 'APPROVED',
            approverId,
            isActive: true
        });


        res.json({ success: true, message: 'Configuration approved and activated' });
    } catch (error) {
        console.error('Approve config error:', error);
        res.status(500).json({ success: false, message: 'Failed to approve configuration' });
    }
};

export const rejectConfig = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const config = await DeliveryChargeConfig.findByPk(id);
        if (!config) {
            return res.status(404).json({ success: false, message: 'Configuration not found' });
        }

        await config.update({
            status: 'REJECTED',
            rejectionReason: reason
        });

        res.json({ success: true, message: 'Configuration rejected' });
    } catch (error) {
        console.error('Reject config error:', error);
        res.status(500).json({ success: false, message: 'Failed to reject configuration' });
    }
};

export const getActiveConfig = async (req, res) => {
    try {
        let { cafeteriaId } = req.query;
        
        // If not provided in query, check if the authenticated user has a cafeteriaId (e.g. Admin)
        if (!cafeteriaId && req.user && req.user.cafeteriaId) {
            cafeteriaId = req.user.cafeteriaId;
        }

        const where = { isActive: true, status: 'APPROVED' };
        
        if (cafeteriaId) {
            where.cafeteriaId = cafeteriaId;
        }


        const config = await DeliveryChargeConfig.findOne({
            where,
            order: [['updatedAt', 'DESC']]
        });

        res.json({ success: true, data: config });

    } catch (error) {
        console.error('Get active config error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch active configuration' });
    }
};
