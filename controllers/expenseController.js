const Expense = require('../models/expenseModel');

// Get all expenses
exports.getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
};

// Get one expense
exports.getExpenseById = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
};

// Add new expense
exports.addExpense = async (req, res) => {
  const { category, amount, note } = req.body;
  try {
    const newExpense = await Expense.create({ category, amount, note });
    res.status(201).json(newExpense);
  } catch (err) {
    res.status(400).json({ error: 'Error adding expense: ' + err.message });
  }
};

// Update expense
exports.updateExpense = async (req, res) => {
  const { category, amount, note } = req.body;
  try {
    const updated = await Expense.findByIdAndUpdate(
      req.params.id,
      { category, amount, note },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Expense not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: 'Error updating expense: ' + err.message });
  }
};

// Delete expense
exports.deleteExpense = async (req, res) => {
  try {
    const deleted = await Expense.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Expense not found' });
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting expense: ' + err.message });
  }
};
