const router = require('express').Router();
const ctrl = require('../controllers/splitController');

// groups
router.post('/groups', ctrl.createGroup);
router.get('/groups', ctrl.listMyGroups);
router.post('/groups/:groupId/members', ctrl.addMembers);
router.delete('/groups/:groupId', ctrl.deleteGroup);

// expenses
router.post('/groups/:groupId/expenses', ctrl.addExpense);
router.get('/groups/:groupId/expenses', ctrl.listExpenses);
router.delete('/groups/:groupId/expenses/:expenseId', ctrl.deleteExpense);

// settlements
router.post('/groups/:groupId/settlements', ctrl.recordSettlement);
router.get('/groups/:groupId/settlements', ctrl.listSettlements);

// summary (balances + suggested transfers)
router.get('/groups/:groupId/summary', ctrl.groupSummary);

module.exports = router;
