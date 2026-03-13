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
            platform: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: "Android or iOS",
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
