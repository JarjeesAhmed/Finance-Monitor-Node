const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const fs = require('fs').promises;
const path = require('path');

// Helper function to delete file
const deleteFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error('Error deleting file:', error);
  }
};

// Get all transactions for a user
router.get('/', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id })
      .sort({ date: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// Add new transaction with optional receipt image
router.post('/', auth, upload.single('receiptImage'), async (req, res) => {
  try {
    const { type, amount, category, description, date } = req.body;

    let receiptImage = null;
    if (req.file) {
      // Create relative path for the image
      const relativePath = `/uploads/${req.file.filename}`;
      receiptImage = {
        url: relativePath,
        publicId: req.file.filename
      };
    }

    const transaction = new Transaction({
      user: req.user._id,
      type,
      amount: Number(amount),
      category,
      description,
      date: date || Date.now(),
      receiptImage
    });

    await transaction.save();
    res.status(201).json(transaction);
  } catch (err) {
    // Delete uploaded file if transaction creation fails
    if (req.file) {
      await deleteFile(req.file.path);
    }
    res.status(500).json({ message: 'Server Error' });
  }
});

// Update transaction
router.put('/:id', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json(transaction);
  } catch (error) {
    console.error('Update Transaction Error:', error);
    res.status(400).json({ error: 'Error updating transaction' });
  }
});

// Delete transaction
router.delete('/:id', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findByIdAndDelete(req.params.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Delete Transaction Error:', error);
    res.status(400).json({ error: 'Error deleting transaction' });
  }
});

// Get dashboard statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Get all transactions for the current month
    const transactions = await Transaction.find({
      user: req.user._id,
      date: {
        $gte: firstDayOfMonth,
        $lte: lastDayOfMonth
      }
    }).sort({ date: -1 });

    // Calculate total balance
    const totalBalance = transactions.reduce((acc, curr) => {
      return curr.type === 'income' ? acc + curr.amount : acc - curr.amount;
    }, 0);

    // Get recent transactions
    const recentTransactions = await Transaction.find({ user: req.user._id })
      .sort({ date: -1 })
      .limit(5);

    // Calculate weekly comparison data
    const weeklyData = await getWeeklyComparison(req.user._id);

    // Calculate expenses breakdown
    const expensesBreakdown = await getExpensesBreakdown(req.user._id);

    // Get upcoming bills (expenses)
    const upcomingBills = await Transaction.find({
      user: req.user._id,
      type: 'expense',
      date: { $gte: today }
    })
      .sort({ date: 1 })
      .limit(3);

    // Mock goals data (you might want to create a separate Goals model)
    const goals = {
      monthlyTarget: 20000,
      currentProgress: 12500
    };

    res.json({
      userName: req.user.name,
      totalBalance,
      goals,
      upcomingBills: upcomingBills.map(bill => ({
        name: bill.description,
        category: bill.category,
        amount: bill.amount,
        dueDate: bill.date
      })),
      recentTransactions,
      weeklyComparison: weeklyData,
      expensesBreakdown
    });
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ message: 'Error getting dashboard statistics' });
  }
});

// Helper function to get weekly comparison data
async function getWeeklyComparison(userId) {
  const today = new Date();
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const transactions = await Transaction.find({
    user: userId,
    date: { $gte: lastWeek }
  });

  const weeklyData = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const dayTransactions = transactions.filter(t => 
      t.date.toDateString() === date.toDateString()
    );
    
    const dailyExpenseTotal = dayTransactions.reduce((acc, curr) => 
      curr.type === 'expense' ? acc + curr.amount : acc, 0
    );

    const dailyIncomeTotal = dayTransactions.reduce((acc, curr) => 
      curr.type === 'income' ? acc + curr.amount : acc, 0
    );

    weeklyData.unshift({
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      income: dailyIncomeTotal,
      expense: dailyExpenseTotal
    });
  }

  return weeklyData;
}

// Helper function to get expenses breakdown
async function getExpensesBreakdown(userId) {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

  // Get current month's expenses
  const currentMonthExpenses = await Transaction.find({
    user: userId,
    type: 'expense',
    date: {
      $gte: firstDayOfMonth,
      $lte: lastDayOfMonth
    }
  });

  // Get last month's expenses
  const lastMonthExpenses = await Transaction.find({
    user: userId,
    type: 'expense',
    date: {
      $gte: firstDayOfLastMonth,
      $lte: lastDayOfLastMonth
    }
  });

  // Group expenses by category
  const currentMonthByCategory = groupExpensesByCategory(currentMonthExpenses);
  const lastMonthByCategory = groupExpensesByCategory(lastMonthExpenses);

  // Calculate trends and format data
  return Object.entries(currentMonthByCategory).map(([category, amount]) => {
    const lastMonthAmount = lastMonthByCategory[category] || 0;
    const trend = lastMonthAmount === 0 ? 100 :
      ((amount - lastMonthAmount) / lastMonthAmount) * 100;

    return {
      name: category,
      amount,
      trend: Math.round(trend)
    };
  });
}

function groupExpensesByCategory(transactions) {
  return transactions.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
    return acc;
  }, {});
}

// Get transaction statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id });
    
    const stats = {
      totalIncome: 0,
      totalExpenses: 0,
      balance: 0,
      categoryTotals: {},
      recentTransactions: []
    };

    transactions.forEach(transaction => {
      if (transaction.type === 'income') {
        stats.totalIncome += transaction.amount;
      } else {
        stats.totalExpenses += transaction.amount;
      }

      // Track category totals
      if (!stats.categoryTotals[transaction.category]) {
        stats.categoryTotals[transaction.category] = 0;
      }
      stats.categoryTotals[transaction.category] += transaction.amount;
    });

    stats.balance = stats.totalIncome - stats.totalExpenses;

    // Get recent transactions
    stats.recentTransactions = await Transaction.find({ user: req.user._id })
      .sort({ date: -1 })
      .limit(5);

    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
