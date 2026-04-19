const router = require('express').Router();
const { getDepartmentScore } = require('../services/scoreService');
const Department = require('../models/Department');
const auth = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const departments = await Department.findAll({ order: [['name', 'ASC']] });
    res.json({ departments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/score', auth, async (req, res) => {
  try {
    const score = await getDepartmentScore(req.params.id);
    res.json(score);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
