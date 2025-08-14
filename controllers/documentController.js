const Document = require('../models/documentModel');

// Add a document or video link
exports.addDocument = async (req, res) => {
  try {
    const { title, course, category, type, link } = req.body;

    const doc = new Document({
      title,
      course,
      category,
      type,
      link
    });

    await doc.save();
    res.status(201).json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get documents for a specific course and optional category
exports.getDocuments = async (req, res) => {
  try {
    const { course, category } = req.params;
    let query = { course };
    if (category) query.category = category;

    const docs = await Document.find(query);
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete a document by ID
exports.deleteDocument = async (req, res) => {
  try {
    const doc = await Document.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    res.json({ message: 'Deleted successfully', doc });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
