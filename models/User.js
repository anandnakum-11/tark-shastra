/**
 * User Model — Database queries for the users table
 */

const { query } = require('../config/db');

const UserModel = {
  /**
   * Find a user by email
   */
  findByEmail: async (email) => {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  },

  /**
   * Find a user by ID
   */
  findById: async (id) => {
    const result = await query(
      'SELECT id, name, email, phone, role, department, is_active, created_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Create a new user
   */
  create: async ({ name, email, phone, password, role, department }) => {
    const result = await query(
      `INSERT INTO users (name, email, phone, password, role, department)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, phone, role, department, created_at`,
      [name, email, phone, password, role, department || null]
    );
    return result.rows[0];
  },

  /**
   * Get all users (optionally filter by role)
   */
  findAll: async (role = null) => {
    let sql = 'SELECT id, name, email, phone, role, department, is_active, created_at FROM users';
    const params = [];

    if (role) {
      sql += ' WHERE role = $1';
      params.push(role);
    }

    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    return result.rows;
  },
};

module.exports = UserModel;
