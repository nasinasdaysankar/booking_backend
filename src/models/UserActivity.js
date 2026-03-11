import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const UserActivity = sequelize.define('UserActivity', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        userId: { type: DataTypes.INTEGER, allowNull: true, field: "userid" },
        activityType: { type: DataTypes.STRING, allowNull: false, field: "activitytype" }, // 'APP_OPEN', 'SESSION_END'
        sessionId: { type: DataTypes.STRING, allowNull: true, field: "sessionid" },
        durationSeconds: { type: DataTypes.INTEGER, allowNull: true, field: "durationseconds" },
        metadata: { type: DataTypes.JSONB, allowNull: true },

        createdAt: {
            type: DataTypes.DATE,
            field: "created_at"
        },

        updatedAt: {
            type: DataTypes.DATE,
            field: "updated_at"
        },
    }, {
        tableName: 'user_activities',
        timestamps: true,
        underscored: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
        indexes: [
            { fields: ['userid'] },
            { fields: ['activitytype'] },
            { fields: ['created_at'] }
        ]
    });
    return UserActivity;
};
