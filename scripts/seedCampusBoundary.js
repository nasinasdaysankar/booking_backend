import { CampusBoundary, sequelize } from "../src/models/index.js";

const boundaryPoints = [
    { lat: 12.731379, lng: 77.706545, label: "Main gate start" },
    { lat: 12.731184, lng: 77.707430, label: "Parking Side turning right" },
    { lat: 12.731816, lng: 77.707721, label: "Back side building starting point of TB" },
    { lat: 12.732372, lng: 77.708094, label: "Ending backside of TB" },
    { lat: 12.732114, lng: 77.708606, label: "Front ending of the TB" },
    { lat: 12.732180, lng: 77.709182, label: "Cricket pitch left top corner" },
    { lat: 12.731774, lng: 77.710563, label: "Cricket pitch right top corner" },
    { lat: 12.730535, lng: 77.710522, label: "Cricket pitch right end" },
    { lat: 12.729672, lng: 77.710492, label: "On Temple" },
    { lat: 12.729204, lng: 77.710529, label: "HOR 2 Back" },
    { lat: 12.728174, lng: 77.710472, label: "HOR 1 Back" },
    { lat: 12.727154, lng: 77.710460, label: "Bus Stand Corner" },
    { lat: 12.727243, lng: 77.709481, label: "Staff Quarters back center" },
    { lat: 12.727328, lng: 77.708903, label: "Anantha Aahara Back Center" },
    { lat: 12.727385, lng: 77.708487, label: "Football Court End Bottom Right" },
    { lat: 12.727440, lng: 77.707799, label: "Football Court End Bottom Left" },
    { lat: 12.728142, lng: 77.707896, label: "Football Court left middle" },
    { lat: 12.728755, lng: 77.708108, label: "Football Court left top" },
    { lat: 12.729070, lng: 77.708184, label: "Basketball Court BackSide Center" },
    { lat: 12.729404, lng: 77.708156, label: "Aromas Back Side corner" },
    { lat: 12.729589, lng: 77.707736, label: "Electricity Back Side" },
    { lat: 12.729710, lng: 77.707270, label: "Water Tank Back Side" },
    { lat: 12.729913, lng: 77.706692, label: "Back Side of the Admin Block Corner Straight" },
    { lat: 12.729982, lng: 77.706264, label: "Admin Block Guest House" },
    { lat: 12.730057, lng: 77.706016, label: "Corner of the Guest House" },
    { lat: 12.731379, lng: 77.706545, label: "Main gate start (closing)" },
];

const seedCampusBoundary = async () => {
    try {
        await sequelize.authenticate();
        console.log("✅ Database connected.");

        // Sync model (create table if not exists)
        await CampusBoundary.sync({ force: true }); // ⚠️ WARNING: Drops table and recreates
        console.log("✅ CampusBoundary table synced.");

        // Insert data
        const promises = boundaryPoints.map((point, index) => {
            // Handle the case where I missed 'lng' key in line 25 above if copy-paste error occures
            const longitude = point.lng !== undefined ? point.lng : 77.706016;

            return CampusBoundary.create({
                pointOrder: index + 1,
                latitude: point.lat,
                longitude: longitude,
                label: point.label,
                name: "Main Campus",
            });
        });

        await Promise.all(promises);
        console.log(`✅ Successfully seeded ${promises.length} boundary points.`);

        process.exit(0);
    } catch (error) {
        console.error("❌ Error seeding campus boundary:", error);
        process.exit(1);
    }
};

seedCampusBoundary();
