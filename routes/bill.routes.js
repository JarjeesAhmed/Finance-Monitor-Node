const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Bill = require('../models/Bill');

// Get all bills
router.get('/', auth, async (req, res) => {
  try {
    const bills = await Bill.find({ user: req.user.id });
    res.json(bills);
  } catch (error) {
    console.error('Get Bills Error:', error);
    res.status(500).json({ error: 'Error fetching bills' });
  }
});

// Create a new bill
router.post('/', auth, async (req, res) => {
  console.log('Request Body:', req.body);
  const { name, amount, dueDate, category, isRecurring, frequency } = req.body;
  try {
    const bill = new Bill({
      user: req.user.id,
      name,
      amount,
      dueDate,
      category,
      isRecurring,
      frequency,
    });
    await bill.save();
    res.status(201).json(bill);
  } catch (error) {
    console.error('Create Bill Error:', error);
    res.status(400).json({ error: 'Error creating bill' });
  }
});

// Update a bill
router.put('/:id', auth, async (req, res) => {
  const { name, amount, dueDate, isRecurring, frequency } = req.body;
  try {
    const bill = await Bill.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { name, amount, dueDate, isRecurring, frequency },
      { new: true }
    );
    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }
    res.json(bill);
  } catch (error) {
    console.error('Update Bill Error:', error);
    res.status(400).json({ error: 'Error updating bill' });
  }
});

// Delete a bill
router.delete('/:id', auth, async (req, res) => {
  try {
    const bill = await Bill.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }
    res.json({ message: 'Bill deleted successfully' });
  } catch (error) {
    console.error('Delete Bill Error:', error);
    res.status(500).json({ error: 'Error deleting bill' });
  }
});

// Mark bill as paid
router.patch('/:id/pay', auth, async (req, res) => {
  try {
    const bill = await Bill.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { isPaid: true },
      { new: true }
    );
    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }
    res.json(bill);
  } catch (error) {
    console.error('Mark Bill as Paid Error:', error);
    res.status(500).json({ error: 'Error marking bill as paid' });
  }
});

module.exports = router;
