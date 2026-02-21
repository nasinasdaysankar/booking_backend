import { DataTypes } from "sequelize";

export default (sequelize) => {
    const AppFeedback = sequelize.define("AppFeedback", {
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
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
        },
    });

    return AppFeedback;
};
