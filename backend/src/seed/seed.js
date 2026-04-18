require('dotenv').config();
const mongoose = require('mongoose');
const Department = require('../models/Department');
const User = require('../models/User');
const Grievance = require('../models/Grievance');
const DepartmentScore = require('../models/DepartmentScore');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sakshyaai';

// ── Gujarat Government Departments (Swagat portal aligned) ──
const departments = [
  { name: 'Roads and Buildings Department', code: 'RBD', contactEmail: 'rbd@gujarat.gov.in', contactPhone: '+919876543001', district: 'Ahmedabad' },
  { name: 'Water Supply and Sewerage Board', code: 'WSSB', contactEmail: 'wssb@gujarat.gov.in', contactPhone: '+919876543002', district: 'Ahmedabad' },
  { name: 'Gujarat Electricity Board', code: 'GEB', contactEmail: 'geb@gujarat.gov.in', contactPhone: '+919876543003', district: 'Gandhinagar' },
  { name: 'Municipal Corporation - Sanitation', code: 'MCS', contactEmail: 'mcs@gujarat.gov.in', contactPhone: '+919876543004', district: 'Surat' },
  { name: 'Public Health Department', code: 'PHD', contactEmail: 'phd@gujarat.gov.in', contactPhone: '+919876543005', district: 'Ahmedabad' },
  { name: 'Education Department', code: 'EDU', contactEmail: 'edu@gujarat.gov.in', contactPhone: '+919876543006', district: 'Vadodara' },
  { name: 'Revenue Department', code: 'REV', contactEmail: 'rev@gujarat.gov.in', contactPhone: '+919876543007', district: 'Rajkot' },
  { name: 'Urban Development Department', code: 'UDD', contactEmail: 'udd@gujarat.gov.in', contactPhone: '+919876543008', district: 'Ahmedabad' },
];

// ── Gujarat Locations (realistic coordinates) ──
const gujaratLocations = [
  { address: 'SG Highway, Ahmedabad', lat: 23.0225, lon: 72.5714 },
  { address: 'Gandhinagar Sector 21', lat: 23.2156, lon: 72.6369 },
  { address: 'Surat Ring Road, Surat', lat: 21.1702, lon: 72.8311 },
  { address: 'Alkapuri, Vadodara', lat: 22.3072, lon: 73.1812 },
  { address: 'Race Course Road, Rajkot', lat: 22.3039, lon: 70.8022 },
  { address: 'Maninagar, Ahmedabad', lat: 22.9909, lon: 72.6065 },
  { address: 'Vastrapur, Ahmedabad', lat: 23.0300, lon: 72.5290 },
  { address: 'Paldi, Ahmedabad', lat: 23.0137, lon: 72.5597 },
  { address: 'Satellite, Ahmedabad', lat: 23.0175, lon: 72.5234 },
  { address: 'Bodakdev, Ahmedabad', lat: 23.0395, lon: 72.5001 },
];

// ── Grievance Templates (realistic Swagat-portal complaints) ──
const grievanceTemplates = [
  { title: 'મુખ્ય રસ્તા પર ખાડો', description: 'SG Highway પર મોટો ખાડો બન્યો છે. વાહનો માટે ખતરનાક છે. એક મહિનાથી ફરિયાદ કરી છે પણ કોઈ કાર્યવાહી થઈ નથી.', category: 'ROAD' },
  { title: 'પાણી પુરવઠો બંધ', description: 'છેલ્લા 3 દિવસથી પાણી આવતું નથી. ટેન્કર પણ નથી આવ્યું. પીવાના પાણીની ગંભીર સમસ્યા છે.', category: 'WATER' },
  { title: 'સ્ટ્રીટ લાઈટ બંધ', description: 'અમારા વિસ્તારમાં 2 અઠવાડિયાથી સ્ટ્રીટ લાઈટ બંધ છે. રાત્રે અંધારામાં ચાલવું મુશ્કેલ છે.', category: 'ELECTRICITY' },
  { title: 'ગટર ભરાઈ ગઈ છે', description: 'ગટરનું પાણી રસ્તા પર આવે છે. ખૂબ દુર્ગંધ આવે છે. આરોગ્ય માટે હાનિકારક છે.', category: 'SANITATION' },
  { title: 'PHC માં દવાની અછત', description: 'પ્રાથમિક આરોગ્ય કેન્દ્રમાં મૂળભૂત દવાઓ ઉપલબ્ધ નથી. દર્દીઓને ખાનગી ફાર્મસીમાં જવું પડે છે.', category: 'HEALTH' },
  { title: 'શાળામાં શિક્ષકની ભરતી', description: 'સરકારી શાળામાં 3 શિક્ષકોની જગ્યા ખાલી છે. બાળકોના શિક્ષણ પર ગંભીર અસર થઈ રહી છે.', category: 'EDUCATION' },
  { title: 'રસ્તાનું ડામરીકરણ', description: 'છેલ્લા વરસાદ પછી રસ્તો સંપૂર્ણ તૂટી ગયો છે. તાત્કાલીક ડામરીકરણની જરૂર છે.', category: 'ROAD' },
  { title: 'વરસાદી પાણીનો ભરાવો', description: 'દર વરસાદે અમારી સોસાયટીમાં પાણી ભરાય છે. ડ્રેનેજ સિસ્ટમ કામ કરતી નથી.', category: 'WATER' },
  { title: 'ટ્રાન્સફોર્મર ફોલ્ટ', description: 'વિસ્તારનો ટ્રાન્સફોર્મર ખરાબ થયો છે. છેલ્લા 2 દિવસથી વીજળી પુરવઠો ખોરવાયો છે.', category: 'ELECTRICITY' },
  { title: 'કચરો ઉઠાવવામાં વિલંબ', description: 'અઠવાડિયાથી કચરો ઉઠાવવામાં આવ્યો નથી. કચરાના ઢગલા થઈ ગયા છે. મચ્છરોનો ઉપદ્રવ વધ્યો છે.', category: 'SANITATION' },
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('🔗 Connected to MongoDB');

    // Clear existing data
    await Department.deleteMany({});
    await User.deleteMany({});
    await Grievance.deleteMany({});
    await DepartmentScore.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Create departments
    const createdDepts = await Department.insertMany(departments);
    console.log(`✅ Created ${createdDepts.length} departments`);

    // Create users
    const users = [
      // Collector
      { username: 'collector', hashedPassword: 'collector123', role: 'COLLECTOR', name: 'District Collector Ahmedabad', phone: '+919876500001' },
      // Department officers
      { username: 'dept_rbd', hashedPassword: 'dept123', role: 'DEPARTMENT', name: 'RBD Officer', phone: '+919876500010', department: createdDepts[0]._id },
      { username: 'dept_wssb', hashedPassword: 'dept123', role: 'DEPARTMENT', name: 'WSSB Officer', phone: '+919876500011', department: createdDepts[1]._id },
      { username: 'dept_geb', hashedPassword: 'dept123', role: 'DEPARTMENT', name: 'GEB Officer', phone: '+919876500012', department: createdDepts[2]._id },
      { username: 'dept_mcs', hashedPassword: 'dept123', role: 'DEPARTMENT', name: 'MCS Officer', phone: '+919876500013', department: createdDepts[3]._id },
      // Field officers
      { username: 'officer1', hashedPassword: 'officer123', role: 'OFFICER', name: 'Rajesh Patel (Field)', phone: '+919876500020', department: createdDepts[0]._id },
      { username: 'officer2', hashedPassword: 'officer123', role: 'OFFICER', name: 'Suresh Shah (Field)', phone: '+919876500021', department: createdDepts[1]._id },
      { username: 'officer3', hashedPassword: 'officer123', role: 'OFFICER', name: 'Mahesh Joshi (Field)', phone: '+919876500022', department: createdDepts[2]._id },
      // Citizens
      { username: 'citizen1', hashedPassword: 'citizen123', role: 'CITIZEN', name: 'Amit Desai', phone: '+919876500030' },
      { username: 'citizen2', hashedPassword: 'citizen123', role: 'CITIZEN', name: 'Priya Sharma', phone: '+919876500031' },
      { username: 'citizen3', hashedPassword: 'citizen123', role: 'CITIZEN', name: 'Vikas Mehta', phone: '+919876500032' },
    ];

    // Save users one by one so the pre-save hook hashes passwords
    const createdUsers = [];
    for (const u of users) {
      const user = new User(u);
      await user.save();
      createdUsers.push(user);
    }
    console.log(`✅ Created ${createdUsers.length} users`);

    // Create grievances
    const citizens = createdUsers.filter(u => u.role === 'CITIZEN');
    const officers = createdUsers.filter(u => u.role === 'OFFICER');

    const grievances = [];
    for (let i = 0; i < grievanceTemplates.length; i++) {
      const template = grievanceTemplates[i];
      const loc = gujaratLocations[i % gujaratLocations.length];
      const citizen = citizens[i % citizens.length];

      // Assign to relevant department
      let deptIndex;
      switch (template.category) {
        case 'ROAD': deptIndex = 0; break;
        case 'WATER': deptIndex = 1; break;
        case 'ELECTRICITY': deptIndex = 2; break;
        case 'SANITATION': deptIndex = 3; break;
        case 'HEALTH': deptIndex = 4; break;
        case 'EDUCATION': deptIndex = 5; break;
        default: deptIndex = 0;
      }

      const statuses = ['OPEN', 'OPEN', 'OPEN', 'RESOLVED', 'PENDING_VERIFICATION', 'REOPENED', 'OPEN', 'OPEN', 'OPEN', 'OPEN'];

      grievances.push({
        swagatId: `SWAGAT-2026-${String(1000 + i).padStart(6, '0')}`,
        title: template.title,
        description: template.description,
        category: template.category,
        address: loc.address,
        location: {
          type: 'Point',
          coordinates: [loc.lon, loc.lat],
        },
        status: statuses[i % statuses.length],
        department: createdDepts[deptIndex]._id,
        complainant: citizen._id,
        complainantPhone: citizen.phone,
        complainantName: citizen.name,
        assignedOfficer: officers[i % officers.length]._id,
      });
    }

    const createdGrievances = await Grievance.insertMany(grievances);
    console.log(`✅ Created ${createdGrievances.length} grievances`);

    // Create department scores
    for (const dept of createdDepts) {
      const total = createdGrievances.filter(g => g.department.toString() === dept._id.toString()).length;
      const closed = createdGrievances.filter(g => g.department.toString() === dept._id.toString() && g.status === 'CLOSED').length;
      const reopened = createdGrievances.filter(g => g.department.toString() === dept._id.toString() && g.status === 'REOPENED').length;

      await DepartmentScore.create({
        department: dept._id,
        totalGrievances: total,
        successfulVerifications: closed,
        failedVerifications: reopened,
        score: total > 0 ? Math.round((closed / Math.max(closed + reopened, 1)) * 100) : 100,
      });
    }
    console.log('✅ Created department scores');

    console.log('\n────────────────────────────────────────────');
    console.log('🎉 Seed complete! Login credentials:');
    console.log('────────────────────────────────────────────');
    console.log('Collector:    collector / collector123');
    console.log('Dept (RBD):   dept_rbd / dept123');
    console.log('Dept (WSSB):  dept_wssb / dept123');
    console.log('Dept (GEB):   dept_geb / dept123');
    console.log('Officer:      officer1 / officer123');
    console.log('Citizen:      citizen1 / citizen123');
    console.log('────────────────────────────────────────────\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

seed();
