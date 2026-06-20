import { Cafeteria, MenuItem, CampusBoundary } from '../models/index.js';
import { cafeteriaCacheGet, cafeteriaCacheSet, CACHE_KEYS } from '../utils/cache.js';

// ============================================
// ✅ GET CAFETERIAS (WITH REDIS CACHING)
// ============================================
export const getCafeterias = async (req, res) => {
  try {
    const cacheKey = CACHE_KEYS.CAFETERIAS_ALL;

    // ✅ CHECK REDIS CACHE FIRST
    const cached = await cafeteriaCacheGet(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        cached: true,
        data: cached
      });
    }

    // ✅ CACHE MISS - Query DB
    const cafes = await Cafeteria.findAll({
      attributes: [
        'id',
        'name',
        'isOpen',
        'isOffline',
        'isUserVisible',
        'isInsideCampus',
        'latitude',
        'longitude',
        'gstType',
        'gstAmount',
        'platformFeeType',
        'platformFeeAmount',
        'commissionType',
        'commissionAmount',
        'promoVideoUrl',
        'promoImageUrl',
        'promoImageUrl2',
        'isPureVeg',
        'openTime',
        'closeTime',
        'showGst',
        'showPlatformFee',
        'showCommission',
        'fssaiLicense',
        'isBusy',
        'visibilityRadius',
        'isOnlineOrderEnabled',
        'isDeliveryEnabled',
        'isDineInEnabled',
        'isManualOrderEnabled',
        'isCampusOnly',
        'campusName',
        'isDeliveryAllowed'
      ],
      where: {
        isOnlineOrderEnabled: true,
        isUserVisible: true
      },
      order: [['id', 'ASC']]
    });

    const userRole = req.user ? req.user.role : null;
    const isAdmin = ["admin", "superadmin", "manager", "staff"].includes(userRole);

    let cafesJson = cafes.map(c => c.toJSON());

    // 🛡️ Redact sensitive business parameters for non-admin requests
    if (!isAdmin) {
      cafesJson = cafesJson.map(cafe => {
        delete cafe.commissionType;
        delete cafe.commissionAmount;
        delete cafe.showCommission;
        return cafe;
      });
    }

    // --- Dynamic Campus Mapping ---
    try {
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
        
        const isPointInPolygon = (point, polygon) => {
            let x = point.longitude, y = point.latitude;
            let inside = false;
            for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                let xi = polygon[i].longitude, yi = polygon[i].latitude;
                let xj = polygon[j].longitude, yj = polygon[j].latitude;
                let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        };

        for (const cafe of cafesJson) {
            if (cafe.latitude && cafe.longitude) {
                let foundCampus = null;
                const cafePoint = { latitude: parseFloat(cafe.latitude), longitude: parseFloat(cafe.longitude) };
                for (const [campusName, polygon] of Object.entries(campuses)) {
                    if (polygon.length >= 3 && isPointInPolygon(cafePoint, polygon)) {
                        foundCampus = campusName;
                        break;
                    }
                }
                
                if (foundCampus) {
                    cafe.isInsideCampus = true;
                    cafe.campusName = foundCampus;
                }
            }
        }
    } catch (geoErr) {
        console.error("Error calculating dynamic campus mapping:", geoErr);
    }
    // ------------------------------

    // ✅ SAVE TO REDIS CACHE
    await cafeteriaCacheSet(cacheKey, cafesJson);

    res.json({
      success: true,
      cached: false,
      data: cafesJson
    });
  } catch (err) {
    console.error('Error fetching cafeterias:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching cafeterias'
    });
  }
};


export const getCafeteriaMenu = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if cafeteria exists
    const cafeteria = await Cafeteria.findByPk(id, {
      attributes: ['id', 'name', 'isOpen', 'isOffline', 'isBusy', 'isOnlineOrderEnabled', 'isUserVisible', 'promoImageUrl', 'promoImageUrl2', 'fssaiLicense']
    });

    if (!cafeteria) {
      return res.status(404).json({
        success: false,
        message: 'Cafeteria not found'
      });
    }

    const items = await MenuItem.findAll({
      where: {
        cafeteriaId: id,
        isAvailable: true
      },
      order: [['name', 'ASC']]
    });

    res.json({
      success: true,
      cafeteriaOpen: cafeteria.isOpen,
      cafeteriaOffline: cafeteria.isOffline,
      cafeteriaBusy: cafeteria.isBusy,
      isOnlineOrderEnabled: cafeteria.isOnlineOrderEnabled,
      isUserVisible: cafeteria.isUserVisible,
      fssaiLicense: cafeteria.fssaiLicense,
      data: items
    });
  } catch (err) {
    console.error('Error fetching menu:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching menu'
    });
  }
};