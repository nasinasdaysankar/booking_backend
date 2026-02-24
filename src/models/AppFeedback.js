import { DataTypes } from "sequelize";

export default (sequelize) => {
    const AppFeedback = sequelize.define("AppFeedback", {
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: "userid",
        },
        rating: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1,
                max: 5,
            },
        },
        comment: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        platform: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        appVersion: {
            type: DataTypes.STRING,
            allowNull: true,
            field: "appversion",
        },

        createdAt: {
            type: DataTypes.DATE,
            field: "created_at",
        },

        updatedAt: {
            type: DataTypes.DATE,
            field: "updated_at",
        },
    }, {
        tableName: 'app_feedbacks',
        timestamps: true,
        underscored: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
    });

    return AppFeedback;
};
