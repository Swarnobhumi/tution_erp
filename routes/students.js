const express = require('express');
const router = express.Router();
const sequelize = require('../models/db');
const Student = require('../models/Student');
const Fee = require('../models/Fee');
const Attendance = require('../models/Attendance');

// Get all students
router.get('/', async (req, res) => {
  try {
    const students = await Student.findAll({
      order: [['name', 'ASC']]
    });
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a new student
router.post('/', async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ message: 'Student name is required' });
    }
    const newStudent = await Student.create({
      name,
      phone: req.body.phone,
      parent_phone: req.body.parent_phone,
      batch_time: req.body.batch_time,
      fee_type: req.body.fee_type,
      fee_amount: Number(req.body.fee_amount) || 0
    });
    res.status(201).json(newStudent);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update an existing student
router.put('/:id', async (req, res) => {
  try {
    const student = await Student.findByPk(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    const { name, phone, parent_phone, batch_time, fee_type, fee_amount } = req.body;
    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ message: 'Student name cannot be empty' });
    }
    await student.update({
      name: name !== undefined ? String(name).trim() : student.name,
      phone: phone !== undefined ? phone : student.phone,
      parent_phone: parent_phone !== undefined ? parent_phone : student.parent_phone,
      batch_time: batch_time !== undefined ? batch_time : student.batch_time,
      fee_type: fee_type !== undefined ? fee_type : student.fee_type,
      fee_amount: fee_amount !== undefined ? (Number(fee_amount) || 0) : student.fee_amount
    });
    res.json(student);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete a student and their dependent fee/attendance records (kept atomic so a partial
// failure never leaves rows pointing at a student that no longer exists).
router.delete('/:id', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const deletedCount = await Student.destroy({ where: { id: req.params.id }, transaction: t });
    if (deletedCount === 0) {
      await t.rollback();
      return res.status(404).json({ message: 'Student not found' });
    }
    await Fee.destroy({ where: { student_id: req.params.id }, transaction: t });
    await Attendance.destroy({ where: { student_id: req.params.id }, transaction: t });
    await t.commit();
    res.json({ message: 'Deleted Student' });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
