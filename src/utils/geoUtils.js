export const isPointInPolygon = (point, polygon) => {
    let x = parseFloat(point.longitude), y = parseFloat(point.latitude);
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        let xi = parseFloat(polygon[i].longitude), yi = parseFloat(polygon[i].latitude);
        let xj = parseFloat(polygon[j].longitude), yj = parseFloat(polygon[j].latitude);
        let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

import { Cafeteria, CampusBoundary } from '../models/index.js';

export const syncAllCafeteriaCampuses = async () => {
    try {
        const cafes = await Cafeteria.findAll();
        const boundaryPoints = await CampusBoundary.findAll({
            order: [["name", "ASC"], ["pointOrder", "ASC"]],
        });

        const campuses = {};
        for (const point of boundaryPoints) {
            if (!campuses[point.name]) campuses[point.name] = [];
            campuses[point.name].push({
                latitude: parseFloat(point.latitude),
                longitude: parseFloat(point.longitude)
            });
        }

        for (const cafe of cafes) {
            if (cafe.latitude && cafe.longitude) {
                let foundCampus = null;
                const cafePoint = { latitude: parseFloat(cafe.latitude), longitude: parseFloat(cafe.longitude) };
                
                for (const [campusName, polygon] of Object.entries(campuses)) {
                    if (polygon.length >= 3 && isPointInPolygon(cafePoint, polygon)) {
                        foundCampus = campusName;
                        break;
                    }
                }

                const newIsInside = foundCampus !== null;
                const newCampusName = foundCampus;

                if (cafe.isInsideCampus !== newIsInside || cafe.campusName !== newCampusName) {
                    cafe.isInsideCampus = newIsInside;
                    cafe.campusName = newCampusName;
                    await cafe.save();
                }
            } else {
                if (cafe.isInsideCampus === true || cafe.campusName !== null) {
                    cafe.isInsideCampus = false;
                    cafe.campusName = null;
                    await cafe.save();
                }
            }
        }
        
        console.log("✅ Synced cafeterias to campuses successfully.");
    } catch (error) {
        console.error("Error syncing cafeterias to campuses:", error);
    }
};
