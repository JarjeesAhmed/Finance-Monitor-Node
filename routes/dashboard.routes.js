const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const Goal = require('../models/Goal');
const Bill = require('../models/Bill');
const { startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays } = require('date-fns');

// Get dashboard statistics
router.get('/stats', auth, async (req, res) => {
  try {
    // Get total balance
    const transactions = await Transaction.find({ user: req.user.id });
    const totalBalance = transactions.reduce((acc, curr) => {
      return curr.type === 'income' ? acc + curr.amount : acc - curr.amount;
    }, 0);

    // Get weekly data
    const startWeek = startOfWeek(new Date());
    const endWeek = endOfWeek(new Date());
    const weeklyTransactions = await Transaction.find({
      user: req.user.id,
      date: { $gte: startWeek, $lte: endWeek }
    });

    const weeklyData = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(startWeek, i);
      const dayTransactions = weeklyTransactions.filter(t => 
        t.date.toDateString() === date.toDateString()
      );
      const incomeAmount = dayTransactions.reduce((acc, curr) => 
        curr.type === 'income' ? acc + curr.amount :acc
      , 0);

      const expenseAmount = dayTransactions.reduce((acc, curr) => 
        curr.type === 'expense' ? acc + curr.amount : acc
      , 0);
      return {
        name: date.toLocaleDateString('en-US', { weekday: 'short' }),
        income:incomeAmount,
        expense: expenseAmount
      };
    });

    // Get expenses breakdown
    const startMonth = startOfMonth(new Date());
    const endMonth = endOfMonth(new Date());
    const monthlyExpenses = await Transaction.find({
      user: req.user.id,
      type: 'expense',
      date: { $gte: startMonth, $lte: endMonth }
    });

    const expensesByCategory = monthlyExpenses.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {});

    const totalExpenses = Object.values(expensesByCategory).reduce((a, b) => a + b, 0);
    const expensesBreakdown = Object.entries(expensesByCategory).map(([name, value]) => ({
      name,
      value: Math.round((value / totalExpenses) * 100)
    }));

    // Get recent transactions
    const recentTransactions = await Transaction.find({ user: req.user.id })
      .sort({ date: -1 })
      .limit(5);

    // Get upcoming bills
    const upcomingBills = await Bill.find({
      user: req.user.id,
      dueDate: { $gte: new Date() },
      isPaid: false
    })
      .sort({ dueDate: 1 })
      .limit(5);

    // Get goals
    const goals = await Goal.find({ user: req.user.id, isCompleted: false })
      .sort({ targetDate: 1 });

    res.json({
      data: {
        totalBalance,
        weeklyData,
        expensesBreakdown,
        recentTransactions,
        upcomingBills,
        goals,
      },
      message: 'Dashboard statistics fetched successfully'
    });
  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({ error: 'Error fetching dashboard statistics' });
  }
});

// Mark bill as paid
router.patch('/bills/:id/pay', auth, async (req, res) => {
  try {
    const bill = await Bill.findOne({ _id: req.params.id, user: req.user.id });
    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    bill.isPaid = true;
    await bill.save();

    // If it's a recurring bill, create the next one
    if (bill.isRecurring) {
      const nextDueDate = new Date(bill.dueDate);
      switch (bill.frequency) {
        case 'weekly':
          nextDueDate.setDate(nextDueDate.getDate() + 7);
          break;
        case 'monthly':
          nextDueDate.setMonth(nextDueDate.getMonth() + 1);
          break;
        case 'yearly':
          nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
          break;
      }

      const newBill = new Bill({
        user: req.user.id,
        name: bill.name,
        amount: bill.amount,
        dueDate: nextDueDate,
        category: bill.category,
        isRecurring: true,
        frequency: bill.frequency,
        notificationEnabled: bill.notificationEnabled
      });
      await newBill.save();
    }

    // Create a transaction for the paid bill
    const transaction = new Transaction({
      user: req.user.id,
      type: 'expense',
      amount: bill.amount,
      category: bill.category,
      description: `Paid bill: ${bill.name}`,
      date: new Date()
    });
    await transaction.save();

    res.json({ message: 'Bill marked as paid successfully' });
  } catch (error) {
    console.error('Mark Bill as Paid Error:', error);
    res.status(500).json({ error: 'Error marking bill as paid' });
  }
});

// Update goal progress
router.patch('/goals/:id/progress', auth, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    const goal = await Goal.findOne({ _id: req.params.id, user: req.user.id });
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    goal.currentAmount += Number(amount);
    if (goal.currentAmount >= goal.targetAmount) {
      goal.isCompleted = true;
    }
    await goal.save();

    // Create a transaction for the goal contribution
    const transaction = new Transaction({
      user: req.user.id,
      type: 'expense',
      amount: Number(amount),
      category: goal.category,
      description: `Contribution to goal: ${goal.name}`,
      date: new Date()
    });
    await transaction.save();

    res.json({ message: 'Goal progress updated successfully' });
  } catch (error) {
    console.error('Update Goal Progress Error:', error);
    res.status(500).json({ error: 'Error updating goal progress' });
  }
});

module.exports = router;
