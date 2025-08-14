const Academic = require('../models/academicModel');

// Get all courses
exports.getAllAcademics = async (req, res) => {
  try {
    const academics = await Academic.find();
    res.json(academics);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Add new course
exports.createAcademic = async (req, res) => {
  const academic = new Academic(req.body);
  try {
    const newAcademic = await academic.save();
    res.status(201).json(newAcademic);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Update syllabus completion
exports.updateSyllabus = async (req, res) => {
  try {
    const academic = await Academic.findById(req.params.id);
    if (!academic) return res.status(404).json({ message: 'Course not found' });

    academic.syllabusTopics = req.body.syllabusTopics; // expects full array with updated completed status
    await academic.save();
    res.json(academic);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Update marks (quizzes, assignments, midterms, final)
exports.updateMarks = async (req, res) => {
  try {
    const academic = await Academic.findById(req.params.id);
    if (!academic) return res.status(404).json({ message: 'Course not found' });

    const { quizzes, assignments, midterms, finalExam } = req.body;
    if (quizzes) academic.quizzes = quizzes;
    if (assignments) academic.assignments = assignments;
    if (midterms) academic.midterms = midterms;
    if (finalExam) academic.finalExam = finalExam;

    await academic.save();
    res.json(academic);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Delete a course
exports.deleteAcademic = async (req, res) => {
  try {
    const academic = await Academic.findByIdAndDelete(req.params.id);
    if (!academic) return res.status(404).json({ message: 'Course not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
