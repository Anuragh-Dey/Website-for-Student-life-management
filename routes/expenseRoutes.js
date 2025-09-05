const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');

// Get all expenses
router.get('/', expenseController.getExpenses);

// Get one expense by ID
router.get('/:id', expenseController.getExpenseById);

// Add new expense
router.post('/', expenseController.addExpense);

// Update expense by ID
router.put('/:id', expenseController.updateExpense);

// Delete expense by ID
router.delete('/:id', expenseController.deleteExpense);

module.exports = router;
