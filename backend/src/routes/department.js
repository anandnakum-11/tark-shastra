const router = require('express').Router();
const auth = require('../middleware/auth');
const { getDepartmentScore } = require('../services/scoreService');
const Department = require('../models/Department');

// ── GET /api/departments — List all departments ──
router.get('/', auth, async (req, res) => {
  try {
    const departments = await Department.find();
    res.json({ departments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/departments/:id/score — Get department quality score ──
router.get('/:id/score', auth, async (req, res) => {
  try {
    const score = await getDepartmentScore(req.params.id);
    res.json({ score });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
