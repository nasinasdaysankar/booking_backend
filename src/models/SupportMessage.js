import { DataTypes } from "sequelize";

export default (sequelize) => {
    const SupportMessage = sequelize.define(
        "SupportMessage",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            ticketId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: "ticket_id",
            },
            senderId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: "sender_id",
                comment: "ID of the user, admin, or 0 for superadmin",
            },
            senderType: {
                type: DataTypes.ENUM("user", "admin", "owner", "delivery"),
                allowNull: false,
                field: "sender_type",
                comment: "user = customer, admin = cafeteria owner, owner = velish support, delivery = delivery partner",
            },
            message: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            mediaUrl1: {
                type: DataTypes.STRING,
                allowNull: true,
                field: "media_url1",
                comment: "First optional image URL",
            },
            mediaUrl2: {
                type: DataTypes.STRING,
                allowNull: true,
                field: "media_url2",
                comment: "Second optional image URL",
            },
        },
        {
            tableName: "support_messages",
            timestamps: true,
            underscored: true,
        }
    );

    return SupportMessage;
};
