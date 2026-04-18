/**
 * FieldEvidence Model — Database queries for the field_evidence table
 */

const { query } = require('../config/db');

const FieldEvidenceModel = {
  /**
   * Store a new field evidence record
   */
  create: async ({ grievance_id, officer_id, image_url, lat, lng, gps_match, gps_distance_m }) => {
    const result = await query(
      `INSERT INTO field_evidence
        (grievance_id, officer_id, image_url, lat, lng, gps_match, gps_distance_m)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [grievance_id, officer_id || null, image_url, lat, lng, gps_match || null, gps_distance_m || null]
    );
    return result.rows[0];
  },

  /**
   * Find evidence by grievance ID
   */
  findByGrievanceId: async (grievance_id) => {
    const result = await query(
      `SELECT fe.*, u.name AS officer_name
       FROM field_evidence fe
       LEFT JOIN users u ON fe.officer_id = u.id
       WHERE fe.grievance_id = $1
       ORDER BY fe.timestamp DESC`,
      [grievance_id]
    );
    return result.rows;
  },

  /**
   * Find evidence by ID
   */
  findById: async (id) => {
    const result = await query('SELECT * FROM field_evidence WHERE id = $1', [id]);
    return result.rows[0] || null;
  },
};

module.exports = FieldEvidenceModel;
