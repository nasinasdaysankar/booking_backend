import { Payment, Order, OrderItem, sequelize } from "/Users/nasinaudaysankar/booking_backend-5/src/models/index.js";
import { Op, QueryTypes } from "sequelize";
import dayjs from "dayjs";

const backfill = async () => {
    const todayStart = dayjs().startOf("day").toDate();
    const todayEnd = dayjs().endOf("day").toDate();

    const orders = await Order.findAll({
        where: {
            status: "PAID",
            createdAt: {
                [Op.between]: [todayStart, todayEnd],
            },
            dailyOrderNumber: null,
        },
        order: [["createdAt", "ASC"]],
    });

    console.log(`Found ${orders.length} orders to backfill for today.`);

    const cafeteriaCounters = {};

    for (const order of orders) {
        const cid = order.cafeteriaId;
        if (!cafeteriaCounters[cid]) {
            // Get current max from DB or start from 1
            const maxVal = await Order.max("dailyOrderNumber", {
                where: {
                    cafeteriaId: cid,
                    createdAt: {
                        [Op.between]: [todayStart, todayEnd],
                    },
                }
            });
            cafeteriaCounters[cid] = (maxVal || 0) + 1;
        }

        await order.update({ dailyOrderNumber: cafeteriaCounters[cid] });
        console.log(`Updated Order #${order.id} with Daily Number ${cafeteriaCounters[cid]}`);

        // Also update the external counter table
        await sequelize.query(
            `
      INSERT INTO daily_order_counters (cafeteria_id, date, counter)
      VALUES (:cid, :date, :counter)
      ON CONFLICT (cafeteria_id, date)
      DO UPDATE SET counter = GREATEST(daily_order_counters.counter, EXCLUDED.counter)
      `,
            {
                replacements: {
                    cid,
                    date: dayjs().format("YYYY-MM-DD"),
                    counter: cafeteriaCounters[cid]
                },
                type: QueryTypes.INSERT,
            }
        );

        cafeteriaCounters[cid]++;
    }

    process.exit(0);
};

backfill();
