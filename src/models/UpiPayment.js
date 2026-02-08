import { DataTypes } from "sequelize";

export default (sequelize) => {
    const UpiPayment = sequelize.define("UpiPayment", {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },

        orderId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "orders",
                key: "id",
            },
        },

        // Virtual UPI ID for this payment
        vpa: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: "Virtual Payment Address (e.g., velish_ord123@cashfree)",
        },

        // Payee name shown in UPI app
        payeeName: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "Velish Canteen",
        },

        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },

        // Transaction reference for UPI Intent
        transactionRef: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            comment: "Unique reference for this UPI transaction",
        },

        status: {
            type: DataTypes.ENUM("PENDING", "SUCCESS", "FAILED", "EXPIRED"),
            defaultValue: "PENDING",
        },

        // UTR number from successful payment (from webhook)
        utrNumber: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: "Unique Transaction Reference from UPI network",
        },

        // Sender details (from webhook)
        senderVpa: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: "Payer's VPA (e.g., student@okaxis)",
        },

        senderName: {
            type: DataTypes.STRING,
            allowNull: true,
        },

        // Webhook tracking
        webhookReceivedAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },

        webhookPayload: {
            type: DataTypes.JSONB,
            allowNull: true,
            comment: "Raw webhook data for debugging",
        },

        // Payment expiry (optional - for cleanup)
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: "Payment expires after this time",
        },

    }, {
        tableName: "upi_payments",
        timestamps: true,
        indexes: [
            { fields: ["orderId"] },
            { fields: ["vpa"] },  // Not unique - all payments go to same VPA
            { fields: ["transactionRef"], unique: true },
            { fields: ["status"] },
            { fields: ["utrNumber"] },
        ],
    });

    return UpiPayment;
};
