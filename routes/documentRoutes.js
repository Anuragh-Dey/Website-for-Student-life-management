const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');

// Add a new document/video link
router.post('/', documentController.addDocument);

// Get all documents for a course
router.get('/:course', documentController.getDocuments);

// Get all documents for a course and category
router.get('/:course/:category', documentController.getDocuments);

// Delete a document
router.delete('/:id', documentController.deleteDocument);

module.exports = router;
