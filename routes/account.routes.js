const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Account = require('../models/Account');

// Get all accounts
router.get('/', auth, async (req, res) => {
  try {
    const accounts = await Account.find({ user: req.user.id });
    res.json(accounts);
  } catch (error) {
    console.error('Get Accounts Error:', error);
    res.status(500).json({ error: 'Error fetching accounts' });
  }
});

// Create a new account
router.post('/', auth, async (req, res) => {
  const { name, type, balance } = req.body;
  try {
    const account = new Account({
      user: req.user.id,
      name,
      type,
      balance,
    });
    await account.save();
    res.status(201).json(account);
  } catch (error) {
    console.error('Create Account Error:', error);
    res.status(400).json({ error: 'Error creating account' });
  }
});

// Update an account
router.put('/:id', auth, async (req, res) => {
  const { name, type, balance } = req.body;
  try {
    const account = await Account.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { name, type, balance },
      { new: true }
    );
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json(account);
  } catch (error) {
    console.error('Update Account Error:', error);
    res.status(400).json({ error: 'Error updating account' });
  }
});

// Delete an account
router.delete('/:id', auth, async (req, res) => {
  try {
    const account = await Account.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete Account Error:', error);
    res.status(500).json({ error: 'Error deleting account' });
  }
});

module.exports = router;
