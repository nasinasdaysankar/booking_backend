import { DataTypes } from "sequelize";

export default (sequelize) => {
    const SupportTicket = sequelize.define(
        "SupportTicket",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            userId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: "userid",
            },
            category: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: "e.g. Order Issues, Payment, Account, App Issues, Other",
            },
            question: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: "The predefined question the user selected",
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: "Optional additional details (only for 'Other' category)",
            },
            status: {
                type: DataTypes.ENUM("open", "in_progress", "resolved"),
                defaultValue: "open",
                allowNull: false,
            },
            adminResponse: {
                type: DataTypes.TEXT,
                allowNull: true,
                field: "admin_response",
                comment: "The owner/admin's resolution response",
            },
            resolvedAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: "resolved_at",
            },
            ownerRequestedConfirmation: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                field: "owner_requested_confirmation",
                comment: "If true, owner asked the user if the problem is solved",
            },
            userEmail: {
                type: DataTypes.STRING,
                allowNull: true,
                field: "user_email",
                comment: "Email provided by user if problem not solved",
            },
            userPhone: {
                type: DataTypes.STRING,
                allowNull: true,
                field: "user_phone",
                comment: "Phone provided by user if problem not solved",
            },
            platform: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: "Android or iOS",
            },
            source: {
                type: DataTypes.ENUM("user", "admin", "delivery"),
                defaultValue: "user",
                allowNull: false,
                comment: "Whether ticket was submitted from user app, admin app, or delivery app",
            },
            isMediaEnabled: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                field: "is_media_enabled",
                comment: "Whether the user/admin can upload images to this ticket (controlled by owner)",
            },
            userUnreadCount: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                field: "user_unread_count",
                comment: "Number of unread messages for the user/admin",
            },
            ownerUnreadCount: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                field: "owner_unread_count",
                comment: "Number of unread messages for the velish support team",
            },
        },
        {
            tableName: "support_tickets",
            timestamps: true,
            underscored: true,
        }
    );

    return SupportTicket;
};
