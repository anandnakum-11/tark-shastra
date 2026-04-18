const DepartmentScore = require('../models/DepartmentScore');
const Department = require('../models/Department');
const Grievance = require('../models/Grievance');
const { GRIEVANCE_STATUS } = require('../utils/constants');

/**
 * Get score for a specific department.
 */
async function getDepartmentScore(departmentId) {
  let score = await DepartmentScore.findOne({ department: departmentId }).populate('department');
  if (!score) {
    const dept = await Department.findById(departmentId);
    if (!dept) throw new Error('Department not found');
    score = await DepartmentScore.create({ department: departmentId });
    score = await DepartmentScore.findById(score._id).populate('department');
  }
  return score;
}

/**
 * Get aggregated dashboard data for the District Collector.
 */
async function getCollectorDashboard() {
  const departments = await Department.find();
  const results = [];

  for (const dept of departments) {
    let score = await DepartmentScore.findOne({ department: dept._id });
    if (!score) {
      score = { totalGrievances: 0, successfulVerifications: 0, failedVerifications: 0, pendingVerifications: 0, score: 100 };
    }

    const pendingCount = await Grievance.countDocuments({
      department: dept._id,
      status: GRIEVANCE_STATUS.PENDING_VERIFICATION,
    });

    const reopenedCount = await Grievance.countDocuments({
      department: dept._id,
      status: GRIEVANCE_STATUS.REOPENED,
    });

    const totalOpen = await Grievance.countDocuments({
      department: dept._id,
      status: GRIEVANCE_STATUS.OPEN,
    });

    const totalClosed = await Grievance.countDocuments({
      department: dept._id,
      status: GRIEVANCE_STATUS.CLOSED,
    });

    results.push({
      department: {
        _id: dept._id,
        name: dept.name,
        code: dept.code,
        district: dept.district,
      },
      score: score.score || 100,
      totalGrievances: score.totalGrievances || 0,
      successfulVerifications: score.successfulVerifications || 0,
      failedVerifications: score.failedVerifications || 0,
      pendingVerification: pendingCount,
      reopened: reopenedCount,
      open: totalOpen,
      closed: totalClosed,
    });
  }

  // Sort by score ascending (worst first for attention)
  results.sort((a, b) => a.score - b.score);

  return results;
}

/**
 * Get failed verification details for drill-down.
 */
async function getFailedVerifications(departmentId, page = 1, limit = 20) {
  const query = {
    department: departmentId,
    status: GRIEVANCE_STATUS.REOPENED,
  };

  const total = await Grievance.countDocuments(query);
  const grievances = await Grievance.find(query)
    .populate('department')
    .sort({ reopenedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  return { grievances, total, page, pages: Math.ceil(total / limit) };
}

module.exports = { getDepartmentScore, getCollectorDashboard, getFailedVerifications };
