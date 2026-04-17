import { SupportTicket, SupportMessage } from './src/models/index.js';

async function debugTicket(id) {
    try {
        const ticket = await SupportTicket.findByPk(id);
        console.log("=== TICKET ===");
        console.log(JSON.stringify(ticket, null, 2));

        const messages = await SupportMessage.findAll({ where: { ticketId: id } });
        console.log("\n=== MESSAGES ===");
        console.log(JSON.stringify(messages, null, 2));
    } catch (err) {
        console.error(err);
    }
}

debugTicket(process.argv[2] || 46);
