const Task = require('../models/taskModel');

exports.getAllTasks = async (req, res) => {
  try {
    const tasks = await Task.find().sort({ dueDate: 1 });
    res.status(200).json(tasks); 
  } catch (err) {
    console.error('Error fetching tasks:', err); 
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};

exports.addTask = async (req, res) => {
  try {
    const { title, description, dueDate } = req.body;
    const newTask = await Task.create({ title, description, dueDate });
    res.status(201).json(newTask);
  } catch (err) {
    console.error('Error creating task:', err);   
    res.status(400).json({ error: 'Failed to create task' });
  }
};

exports.markComplete = async (req, res) => {
  const { id } = req.params;
  try {
    const updatedTask = await Task.findByIdAndUpdate(id, { completed: true }, { new: true });
    if (!updatedTask) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(updatedTask);
  } catch (err) {
    console.error('Error marking task complete:', err);
    res.status(500).json({ error: 'Failed to mark task as complete' });
  }
};

exports.deleteTask = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedTask = await Task.findByIdAndDelete(id);
    if (!deletedTask) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
};



