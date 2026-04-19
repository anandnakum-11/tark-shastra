const { Op } = require('sequelize');
const DepartmentScore = require('../models/DepartmentScore');
const Department = require('../models/Department');
const Grievance = require('../models/Grievance');
const { GRIEVANCE_STATUS } = require('../utils/constants');

async function getDepartmentScore(departmentId) {
  const department = await Department.findByPk(departmentId);
  if (!department) {
    throw new Error('Department not found');
  }

  let score = await DepartmentScore.findOne({ where: { departmentName: department.name } });
  if (!score) {
    score = await DepartmentScore.create({ departmentName: department.name });
  }

  return { department, score };
}

async function getCollectorDashboard() {
  const departments = await Department.findAll({ order: [['name', 'ASC']] });
  const scoreRows = await DepartmentScore.findAll();
  const scoreMap = new Map(scoreRows.map((row) => [row.departmentName, row]));
  const results = [];

  for (const dept of departments) {
    const score = scoreMap.get(dept.name);

    const [pendingCount, reopenedCount, openCount, closedCount] = await Promise.all([
      Grievance.count({ where: { department: dept.name, status: GRIEVANCE_STATUS.PENDING_VERIFICATION } }),
      Grievance.count({ where: { department: dept.name, status: GRIEVANCE_STATUS.REOPENED } }),
      Grievance.count({ where: { department: dept.name, status: { [Op.in]: [GRIEVANCE_STATUS.OPEN, GRIEVANCE_STATUS.IN_PROGRESS, GRIEVANCE_STATUS.RESOLVED] } } }),
      Grievance.count({ where: { department: dept.name, status: GRIEVANCE_STATUS.CLOSED } }),
    ]);

    results.push({
      department: {
        id: dept.id,
        name: dept.name,
        code: dept.code,
        district: dept.district,
      },
      score: Number(score?.score || 0),
      totalGrievances: score?.totalGrievances || 0,
      resolvedCount: score?.resolvedCount || 0,
      successfulVerifications: score?.verifiedCount || 0,
      failedVerifications: score?.reopenedCount || 0,
      pendingVerification: pendingCount,
      reopened: reopenedCount,
      open: openCount,
      closed: closedCount,
    });
  }

  results.sort((a, b) => a.score - b.score);
  return results;
}

async function getFailedVerifications(departmentId, page = 1, limit = 20) {
  const department = await Department.findByPk(departmentId);
  if (!department) {
    throw new Error('Department not found');
  }

  const offset = (page - 1) * limit;
  const where = {
    department: department.name,
    status: GRIEVANCE_STATUS.REOPENED,
  };

  const { rows, count } = await Grievance.findAndCountAll({
    where,
    order: [['updated_at', 'DESC']],
    offset,
    limit,
  });

  return {
    grievances: rows,
    total: count,
    page,
    pages: Math.ceil(count / limit) || 1,
  };
}

module.exports = { getDepartmentScore, getCollectorDashboard, getFailedVerifications };
