const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  course: { type: String, required: true },         // course name
  category: {                                       // category within course
    type: String,
    enum: ['Lecture', 'Assignment', 'Quiz', 'Notes'],
    required: true
  },
  type: {                                           // file type
    type: String,
    enum: ['video', 'pdf', 'document'],
    required: true
  },
  link: { type: String, required: true },          // Drive, YouTube, etc.
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Document', documentSchema);
