const express = require('express');
const router = express.Router();
const academicController = require('../controllers/academicController');

router.get('/', academicController.getAllAcademics);
router.post('/', academicController.createAcademic);
router.patch('/syllabus/:id', academicController.updateSyllabus);
router.patch('/marks/:id', academicController.updateMarks);
router.delete('/:id', academicController.deleteAcademic);

module.exports = router;
