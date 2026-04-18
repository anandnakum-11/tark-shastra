/**
 * IVR Model — Database queries for the ivr_responses table
 */

const { query } = require('../config/db');

const IvrModel = {
  /**
   * Store an IVR response
   */
  create: async ({ grievance_id, citizen_phone, call_sid, response, call_status }) => {
    const result = await query(
      `INSERT INTO ivr_responses (grievance_id, citizen_phone, call_sid, response, call_status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [grievance_id, citizen_phone || '', call_sid || null, response, call_status || 'completed']
    );
    return result.rows[0];
  },

  /**
   * Find IVR responses by grievance ID
   */
  findByGrievanceId: async (grievance_id) => {
    const result = await query(
      `SELECT * FROM ivr_responses WHERE grievance_id = $1 ORDER BY timestamp DESC`,
      [grievance_id]
    );
    return result.rows;
  },
};

module.exports = IvrModel;
