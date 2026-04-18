/**
 * Seed Script
 * Inserts demo data for testing: users (one per role) + sample grievances + department scores.
 *
 * Usage: node migrations/seed.js
 *
 * Default password for all seed users: "password123"
 */

require('dotenv').config();

const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');

const SALT_ROUNDS = 10;

const seedUsers = [
  {
    name: 'Ramnik Citizen',
    email: 'citizen@demo.com',
    phone: '+911234567890',
    role: 'citizen',
    department: null,
  },
  {
    name: 'Ajay Field Officer',
    email: 'field@demo.com',
    phone: '+911234567891',
    role: 'field_officer',
    department: 'Public Works',
  },
  {
    name: 'Priya Dept Officer',
    email: 'dept@demo.com',
    phone: '+911234567892',
    role: 'department_officer',
    department: 'Public Works',
  },
  {
    name: 'Collector Admin',
    email: 'collector@demo.com',
    phone: '+911234567893',
    role: 'collector',
    department: null,
  },
];

const seedGrievances = [
  {
    title: 'Large pothole on MG Road',
    description: 'There is a dangerous pothole near the MG Road bus stop that has been causing accidents for the past two weeks.',
    category: 'road',
    status: 'open',
    priority: 'high',
    location_lat: 18.5204,
    location_lng: 73.8567,
    address: 'MG Road, Near Bus Stop, Pune 411001',
    department: 'Public Works',
  },
  {
    title: 'Broken water pipeline in Sector 5',
    description: 'Water pipeline burst since yesterday morning. Water is being wasted and the road is flooded.',
    category: 'water',
    status: 'in_progress',
    priority: 'critical',
    location_lat: 18.5314,
    location_lng: 73.8446,
    address: 'Sector 5, Aundh, Pune 411007',
    department: 'Water Supply',
  },
  {
    title: 'Garbage not collected for 5 days',
    description: 'The garbage collection truck has not visited our lane for the past 5 days. Garbage is overflowing from bins.',
    category: 'garbage',
    status: 'open',
    priority: 'medium',
    location_lat: 18.5074,
    location_lng: 73.8077,
    address: 'Lane 3, Kothrud, Pune 411038',
    department: 'Sanitation',
  },
  {
    title: 'Street light not working on Park Street',
    description: 'Three street lights on Park Street have been off for over a week. The area is very dark at night.',
    category: 'street_light',
    status: 'resolved',
    priority: 'medium',
    location_lat: 18.5362,
    location_lng: 73.8920,
    address: 'Park Street, Koregaon Park, Pune 411001',
    department: 'Electricity',
  },
];

const seedDepartments = [
  { department_name: 'Public Works',   total_grievances: 45, resolved_count: 30, verified_count: 25, reopened_count: 5, avg_resolution_hrs: 72.5,  score: 78.5 },
  { department_name: 'Water Supply',   total_grievances: 32, resolved_count: 28, verified_count: 22, reopened_count: 3, avg_resolution_hrs: 48.0,  score: 85.2 },
  { department_name: 'Sanitation',     total_grievances: 50, resolved_count: 35, verified_count: 28, reopened_count: 7, avg_resolution_hrs: 96.0,  score: 65.0 },
  { department_name: 'Electricity',    total_grievances: 20, resolved_count: 18, verified_count: 16, reopened_count: 2, avg_resolution_hrs: 24.0,  score: 90.0 },
];

const seed = async () => {
  console.log('🌱 Seeding database...\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── Seed Users ──────────────────────────────────────────
    const passwordHash = await bcrypt.hash('password123', SALT_ROUNDS);
    const userIds = {};

    for (const user of seedUsers) {
      const result = await client.query(
        `INSERT INTO users (name, email, phone, password, role, department)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, role`,
        [user.name, user.email, user.phone, passwordHash, user.role, user.department]
      );
      userIds[result.rows[0].role] = result.rows[0].id;
      console.log(`  ✅ User: ${user.email} (${user.role})`);
    }

    // ── Seed Grievances ─────────────────────────────────────
    for (const g of seedGrievances) {
      await client.query(
        `INSERT INTO grievances (
            citizen_id, title, description, category, status, priority,
            location_lat, location_lng, address, department
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          userIds['citizen'],
          g.title, g.description, g.category, g.status, g.priority,
          g.location_lat, g.location_lng, g.address, g.department,
        ]
      );
      console.log(`  ✅ Grievance: ${g.title}`);
    }

    // ── Seed Department Scores ──────────────────────────────
    for (const d of seedDepartments) {
      await client.query(
        `INSERT INTO department_scores (
            department_name, total_grievances, resolved_count, verified_count,
            reopened_count, avg_resolution_hrs, score
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (department_name) DO UPDATE SET score = EXCLUDED.score`,
        [
          d.department_name, d.total_grievances, d.resolved_count,
          d.verified_count, d.reopened_count, d.avg_resolution_hrs, d.score,
        ]
      );
      console.log(`  ✅ Department: ${d.department_name} (score: ${d.score})`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Seeding completed successfully!');
    console.log('\n📋 Demo Login Credentials (password: password123):');
    console.log('   Citizen:       citizen@demo.com');
    console.log('   Field Officer: field@demo.com');
    console.log('   Dept Officer:  dept@demo.com');
    console.log('   Collector:     collector@demo.com');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`\n❌ Seeding failed: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

seed();
