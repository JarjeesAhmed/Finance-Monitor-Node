const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const auth = require('../middleware/auth');

// Default categories
const defaultCategories = {
  income: ['Salary', 'Freelance', 'Investment', 'Bank Transfer', 'Other'],
  expense: [
    'Food',
    'Transportation',
    'Housing',
    'Entertainment',
    'Shopping',
    'Healthcare',
    'Education',
    'Travel',
    'Gifts',
    'Bills',
    'Other'
  ]
};

// Initialize default categories
const initializeDefaultCategories = async () => {
  try {
    const existingCategories = await Category.find({ isDefault: true });
    if (existingCategories.length === 0) {
      const defaultCategoryDocs = [];
      
      // Create income categories
      for (const name of defaultCategories.income) {
        defaultCategoryDocs.push({
          name,
          type: 'income',
          isDefault: true
        });
      }
      
      // Create expense categories
      for (const name of defaultCategories.expense) {
        defaultCategoryDocs.push({
          name,
          type: 'expense',
          isDefault: true
        });
      }
      
      await Category.insertMany(defaultCategoryDocs);
      console.log('Default categories initialized');
    }
  } catch (error) {
    console.error('Error initializing default categories:', error);
  }
};

// Initialize default categories when the server starts
initializeDefaultCategories();

// Get all categories (including default and user's custom categories)
router.get('/', auth, async (req, res) => {
  try {
    const categories = await Category.find({
      $or: [
        { user: req.user._id },
        { isDefault: true }
      ]
    }).sort({ name: 1 });

    // Organize categories by type
    const organizedCategories = {
      income: categories.filter(cat => cat.type === 'income').map(cat => ({
        ...cat.toObject(),
        isCustom: !cat.isDefault
      })),
      expense: categories.filter(cat => cat.type === 'expense').map(cat => ({
        ...cat.toObject(),
        isCustom: !cat.isDefault
      }))
    };

    res.json(organizedCategories);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching categories' });
  }
});

// Add new custom category
router.post('/', auth, async (req, res) => {
  try {
    const { name, type } = req.body;

    // Check if category already exists (either default or user's)
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp('^' + name + '$', 'i') },
      type,
      $or: [
        { user: req.user._id },
        { isDefault: true }
      ]
    });

    if (existingCategory) {
      return res.status(400).json({ message: 'Category already exists' });
    }

    const category = new Category({
      name,
      type,
      user: req.user._id
    });

    await category.save();
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: 'Error creating category' });
  }
});

// Delete custom category
router.delete('/:id', auth, async (req, res) => {
  try {
    const category = await Category.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    if (category.isDefault) {
      return res.status(400).json({ message: 'Cannot delete default category' });
    }

    await category.remove();
    res.json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting category' });
  }
});

module.exports = router;
