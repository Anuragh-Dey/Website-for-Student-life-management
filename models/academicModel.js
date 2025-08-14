const mongoose = require('mongoose');

const academicSchema = new mongoose.Schema({
  course: { type: String, required: true },
  semester: { type: Number, required: true },
  syllabusTopics: [
    {
      topic: { type: String, required: true },
      completed: { type: Boolean, default: false }
    }
  ],
  quizzes: [
    {
      name: String,
      marksObtained: { type: Number, min: 0 },
      maxMarks: { type: Number, min: 0 }
    }
  ],
  assignments: [
    {
      title: String,
      marksObtained: { type: Number, min: 0 },
      maxMarks: { type: Number, min: 0 }
    }
  ],
  midterms: [
    {
      title: String,
      marksObtained: { type: Number, min: 0 },
      maxMarks: { type: Number, min: 0 }
    }
  ],
  finalExam: {
    marksObtained: { type: Number, min: 0 },
    maxMarks: { type: Number, min: 0 }
  }
});

module.exports = mongoose.model('Academic', academicSchema);
