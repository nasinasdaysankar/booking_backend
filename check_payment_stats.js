import dotenv from "dotenv";
dotenv.config();
import { Sequelize, DataTypes } from "sequelize";

const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: "postgres",
    logging: false,
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false,
        },
    },
});

async function check() {
    try {
        const [results] = await sequelize.query('SELECT DISTINCT status FROM payments');
        console.log('--- ACTUAL PAYMENT STATUSES IN DB ---');
        console.log(results);

        const [counts] = await sequelize.query('SELECT status, COUNT(*) FROM payments GROUP BY status');
        console.log('--- COUNTS BY STATUS ---');
        console.log(counts);
    } catch (err) {
        console.error(err);
    } finally {
        await sequelize.close();
    }
}

check();
