const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Goal = require('../models/Goal');

// Get all goals
router.get('/', auth, async (req, res) => {
  try {
    const goals = await Goal.find({ user: req.user.id });
    res.json(goals);
  } catch (error) {
    console.error('Get Goals Error:', error);
    res.status(500).json({ error: 'Error fetching goals' });
  }
});

// Create a new goal
router.post('/', auth, async (req, res) => {
  const { name, currentAmount, targetDate , category} = req.body;
  try {
    const goal = new Goal({
      user: req.user.id,
      name,
      targetAmount:currentAmount,
      targetDate,
      category,
      isCompleted: false,
    });
    await goal.save();
    res.status(201).json(goal);
  } catch (error) {
    console.error('Create Goal Error:', error);
    res.status(400).json({ error: 'Error creating goal' });
  }
});

// Update a goal
router.put('/:id', auth, async (req, res) => {
  const { name, currentAmount, targetDate, isCompleted } = req.body;
  try {
    const goal = await Goal.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { name, targetAmount:currentAmount, targetDate, isCompleted },
      { new: true }
    );
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    res.json(goal);
  } catch (error) {
    console.error('Update Goal Error:', error);
    res.status(400).json({ error: 'Error updating goal' });
  }
});

// Delete a goal
router.delete('/:id', auth, async (req, res) => {
  try {
    const goal = await Goal.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    res.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    console.error('Delete Goal Error:', error);
    res.status(500).json({ error: 'Error deleting goal' });
  }
});

// Contribute to a goal
router.patch('/:id/contribute', auth, async (req, res) => {
  const { amount } = req.body; // The contribution amount
  try {
    const goal = await Goal.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $inc: { currentAmount: amount } }, // Assuming 'currentAmount' tracks the progress
      { new: true }
    );
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    res.json(goal);
  } catch (error) {
    console.error('Contribute to Goal Error:', error);
    res.status(400).json({ error: 'Error contributing to goal' });
  }
});

module.exports = router;
