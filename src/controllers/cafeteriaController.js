// import { Cafeteria, MenuItem } from '../models/index.js';

// export const getCafeterias = async (req, res) => {
//   try {
//     const cafes = await Cafeteria.findAll();
//     res.json(cafes);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Error fetching cafeterias' });
//   }
// };

// export const getCafeteriaMenu = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const items = await MenuItem.findAll({ where: { cafeteriaId: id, isAvailable: true } });
//     res.json(items);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Error fetching menu' });
//   }
// };

import { Cafeteria, MenuItem } from '../models/index.js';

export const getCafeterias = async (req, res) => {
  try {
    const cafes = await Cafeteria.findAll({
      attributes: [
        'id',
        'name',
        'location',
        'isOpen',
        'staticQrToken',
        'isUserVisible'   // 🔥 THIS WAS MISSING
      ],
      order: [['id', 'ASC']]
    });
    
    res.json({
      success: true,
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
    const cafeteria = await Cafeteria.findByPk(id);
    
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
      closed: !cafeteria.isOpen,
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


