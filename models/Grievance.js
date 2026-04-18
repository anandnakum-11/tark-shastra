/**
 * Grievance Model — Database queries for the grievances table
 */

const { query } = require('../config/db');

const GrievanceModel = {
  /**
   * Create a new grievance
   */
  create: async ({ citizen_id, title, description, category, priority, location_lat, location_lng, address, department }) => {
    const result = await query(
      `INSERT INTO grievances
        (citizen_id, title, description, category, priority, location_lat, location_lng, address, department)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [citizen_id, title, description, category, priority || 'medium', location_lat, location_lng, address, department || null]
    );
    return result.rows[0];
  },

  /**
   * Get all grievances with optional filters
   */
  findAll: async (filters = {}) => {
    let sql = `
      SELECT g.*, u.name AS citizen_name, u.phone AS citizen_phone,
             o.name AS officer_name
      FROM grievances g
      JOIN users u ON g.citizen_id = u.id
      LEFT JOIN users o ON g.assigned_officer_id = o.id
    `;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (filters.status) {
      conditions.push(`g.status = $${idx++}`);
      params.push(filters.status);
    }
    if (filters.category) {
      conditions.push(`g.category = $${idx++}`);
      params.push(filters.category);
    }
    if (filters.department) {
      conditions.push(`g.department = $${idx++}`);
      params.push(filters.department);
    }
    if (filters.citizen_id) {
      conditions.push(`g.citizen_id = $${idx++}`);
      params.push(filters.citizen_id);
    }
    if (filters.assigned_officer_id) {
      conditions.push(`g.assigned_officer_id = $${idx++}`);
      params.push(filters.assigned_officer_id);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY g.created_at DESC';

    if (filters.limit) {
      sql += ` LIMIT $${idx++}`;
      params.push(filters.limit);
    }
    if (filters.offset) {
      sql += ` OFFSET $${idx++}`;
      params.push(filters.offset);
    }

    const result = await query(sql, params);
    return result.rows;
  },

  /**
   * Find a single grievance by ID
   */
  findById: async (id) => {
    const result = await query(
      `SELECT g.*, u.name AS citizen_name, u.phone AS citizen_phone, u.email AS citizen_email,
              o.name AS officer_name
       FROM grievances g
       JOIN users u ON g.citizen_id = u.id
       LEFT JOIN users o ON g.assigned_officer_id = o.id
       WHERE g.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Update grievance status
   */
  updateStatus: async (id, status, extras = {}) => {
    const protectedVerificationStatuses = new Set(['resolved', 'reopened']);
    if (protectedVerificationStatuses.has(status) && extras.systemManaged !== true) {
      throw new Error(`Manual override not allowed for status \"${status}\".`);
    }

    const sets = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
    const params = [id, status];
    let idx = 3;

    if (extras.resolution_notes) {
      sets.push(`resolution_notes = $${idx++}`);
      params.push(extras.resolution_notes);
    }
    if (status === 'resolved') {
      sets.push(`resolved_at = CURRENT_TIMESTAMP`);
    }
    if (status === 'reopened') {
      sets.push(`reopened_count = reopened_count + 1`);
    }
    if (extras.assigned_officer_id) {
      sets.push(`assigned_officer_id = $${idx++}`);
      params.push(extras.assigned_officer_id);
    }

    const result = await query(
      `UPDATE grievances SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return result.rows[0] || null;
  },

  /**
   * Get grievance counts grouped by status
   */
  getStats: async (department = null) => {
    let sql = `SELECT status, COUNT(*)::int AS count FROM grievances`;
    const params = [];

    if (department) {
      sql += ' WHERE department = $1';
      params.push(department);
    }

    sql += ' GROUP BY status';
    const result = await query(sql, params);
    return result.rows;
  },
};

module.exports = GrievanceModel;
