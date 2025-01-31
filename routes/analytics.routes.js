const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const { startOfMonth, endOfMonth, format, subMonths } = require('date-fns');

// Get expense analytics
router.get('/expenses', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : startOfMonth(subMonths(new Date(), 2));
    const end = endDate ? new Date(endDate) : endOfMonth(new Date());

    // Get all expenses within the date range
    const expenses = await Transaction.find({
      user: req.user.id,
      type: 'expense',
      date: { $gte: start, $lte: end }
    }).sort({ date: 1 });

    // Calculate monthly expenses
    const monthlyExpenses = [];
    const monthlyTotals = expenses.reduce((acc, expense) => {
      const monthKey = startOfMonth(new Date(expense.date)).toISOString();
      acc[monthKey] = (acc[monthKey] || 0) + expense.amount;
      return acc;
    }, {});

    Object.entries(monthlyTotals).forEach(([month, amount]) => {
      monthlyExpenses.push({
        month,
        amount
      });
    });

    // Calculate category breakdown
    const categoryTotals = expenses.reduce((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
      return acc;
    }, {});

    const categoryBreakdown = Object.entries(categoryTotals).map(([name, value]) => ({
      name,
      value
    }));

    // Calculate total expenses
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    // Calculate average monthly expense
    const numberOfMonths = monthlyExpenses.length || 1;
    const averageExpense = totalExpenses / numberOfMonths;

    // Calculate highest monthly expense
    const highestExpense = Math.max(...Object.values(monthlyTotals), 0);

    // Find most frequent category
    const categoryFrequency = expenses.reduce((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + 1;
      return acc;
    }, {});
    const mostFrequentCategory = Object.entries(categoryFrequency).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

    res.json({
      monthlyExpenses,
      categoryBreakdown,
      totalExpenses,
      averageExpense,
      highestExpense,
      mostFrequentCategory
    });
  } catch (error) {
    console.error('Get Expense Analytics Error:', error);
    res.status(500).json({ error: 'Error fetching expense analytics' });
  }
});

module.exports = router;
