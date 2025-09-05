const router = require('express').Router();
const ctrl = require('../controllers/mealController');

// groups
router.post('/groups', ctrl.createGroup);
router.get('/groups', ctrl.listMyGroups);
router.post('/groups/:groupId/members', ctrl.addMembers);

// grocery items
router.post('/groups/:groupId/items', ctrl.addItem);
router.get('/groups/:groupId/items', ctrl.listItems);
router.patch('/groups/:groupId/items/:itemId/purchase', ctrl.purchaseItem);

// shopping duty 
router.post('/groups/:groupId/duties', ctrl.assignDuties);
router.get('/groups/:groupId/duties', ctrl.listDuties);

// meals
router.post('/groups/:groupId/meals', ctrl.recordMeals);
router.get('/groups/:groupId/meals', ctrl.listMeals);

// summary
router.get('/groups/:groupId/summary', ctrl.summary);

module.exports = router;
