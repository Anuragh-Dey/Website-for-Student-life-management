const router = require('express').Router();
const ctrl = require('../controllers/emergencyController');


router.post('/setup', ctrl.setup);              
router.get('/summary', ctrl.getSummary);
router.post('/contributions', ctrl.addContribution);
router.post('/withdraw', ctrl.withdraw);
router.get('/transactions', ctrl.listTransactions);
router.patch('/goal', ctrl.updateGoal);

module.exports = router;
