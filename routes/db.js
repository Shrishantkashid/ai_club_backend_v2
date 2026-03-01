// Shared in-memory database for demo purposes
// In production, use a real database like PostgreSQL or MongoDB

const users = new Map();
const attempts = new Map();

module.exports = {
  users,
  attempts
};