import { Cafeteria, MenuItem } from '../models/index.js';
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
        'campusName'
      ],
      where: {
        isOnlineOrderEnabled: true,
        isUserVisible: true
      },
      order: [['id', 'ASC']]
    });

    // ✅ SAVE TO REDIS CACHE
    await cafeteriaCacheSet(cacheKey, cafes);

    res.json({
      success: true,
      cached: false,
      data: cafes
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
      attributes: ['id', 'name', 'isOpen', 'isOffline', 'isBusy', 'isOnlineOrderEnabled', 'isUserVisible', 'promoImageUrl', 'promoImageUrl2']
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