require('dotenv').config();
const { sequelize, connectDB } = require('../config/db');
const { User, Grievance, FieldEvidence, VerificationLog, DepartmentScore, Department } = require('../models');
const { GRIEVANCE_STATUS } = require('../utils/constants');

const departments = [
  { name: 'Roads and Buildings Department', code: 'RBD', contactEmail: 'rbd@gujarat.gov.in', contactPhone: '+919876543001', district: 'Ahmedabad' },
  { name: 'Water Supply and Sewerage Board', code: 'WSSB', contactEmail: 'wssb@gujarat.gov.in', contactPhone: '+919876543002', district: 'Ahmedabad' },
  { name: 'Gujarat Electricity Board', code: 'GEB', contactEmail: 'geb@gujarat.gov.in', contactPhone: '+919876543003', district: 'Gandhinagar' },
  { name: 'Municipal Corporation - Sanitation', code: 'MCS', contactEmail: 'mcs@gujarat.gov.in', contactPhone: '+919876543004', district: 'Surat' },
];

async function seed() {
  try {
    await connectDB();
    console.log('Connected to PostgreSQL');

    await sequelize.query(`
      TRUNCATE TABLE verification_logs, field_evidence, grievances, department_scores, departments, users
      RESTART IDENTITY CASCADE
    `);
    console.log('Cleared existing data');

    const createdDepartments = await Department.bulkCreate(departments, { returning: true });
    await DepartmentScore.bulkCreate(
      createdDepartments.map((department) => ({ departmentName: department.name })),
      { returning: true }
    );
    console.log(`Created ${createdDepartments.length} departments`);

    const users = await User.bulkCreate([
      {
        email: 'collector@example.com',
        password: 'collector123',
        role: 'collector',
        name: 'Collector Control Room',
        phone: '+919876500001',
      },
      {
        email: 'dept_rbd@example.com',
        password: 'dept123',
        role: 'department_officer',
        name: 'RBD Officer',
        phone: '+919876500010',
        department: 'Roads and Buildings Department',
      },
      {
        email: 'officer1@example.com',
        password: 'officer123',
        role: 'field_officer',
        name: 'Field Officer One',
        phone: '+919876500020',
        department: 'Roads and Buildings Department',
      },
      {
        email: 'citizen1@example.com',
        password: 'citizen123',
        role: 'citizen',
        name: 'citizen1',
        phone: '+919876500030',
      },
    ], { individualHooks: true, returning: true });
    console.log(`Created ${users.length} users`);

    const citizen = users.find((user) => user.role === 'citizen');
    const grievances = await Grievance.bulkCreate([
      {
        citizenId: citizen.id,
        title: 'Large pothole near SG Highway',
        description: 'The road surface has broken badly and vehicles are swerving to avoid it.',
        category: 'road',
        status: GRIEVANCE_STATUS.OPEN,
        priority: 'high',
        locationLat: 23.0225,
        locationLng: 72.5714,
        address: 'SG Highway, Ahmedabad',
        department: 'Roads and Buildings Department',
      },
      {
        citizenId: citizen.id,
        title: 'Street lights not working',
        description: 'The full lane stays dark after sunset and residents feel unsafe.',
        category: 'electricity',
        status: GRIEVANCE_STATUS.PENDING_VERIFICATION,
        priority: 'medium',
        locationLat: 23.03,
        locationLng: 72.529,
        address: 'Vastrapur, Ahmedabad',
        department: 'Gujarat Electricity Board',
      },
    ], { returning: true });
    console.log(`Created ${grievances.length} grievances`);

    await VerificationLog.create({
      grievanceId: grievances[1].id,
      status: 'pending',
    });

    console.log('\nSeed complete. Demo logins:');
    console.log('collector / collector123');
    console.log('dept_rbd / dept123');
    console.log('officer1 / officer123');
    console.log('citizen1 / citizen123');

    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
