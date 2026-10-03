const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const adminAuth = require('../middleware/adminAuth');
const AdminSettings = require('../models/AdminSettings');

process.env.JWT_SECRET = 'test-secret';

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

test('rejects requests without an admin token', () => {
  const res = response();
  adminAuth({ headers: {} }, res, () => assert.fail('next should not run'));
  assert.equal(res.statusCode, 401);
});

test('accepts a valid admin token', async () => {
  const req = { headers: { authorization: `Bearer ${jwt.sign({ role: 'admin' }, 'test-secret')}` } };
  const res = response();
  let called = false;
  const findOne = AdminSettings.findOne;
  AdminSettings.findOne = () => ({ select: () => ({ lean: async () => null }) });
  try {
    await adminAuth(req, res, () => { called = true; });
    assert.equal(called, true);
    assert.equal(req.admin.role, 'admin');
  } finally {
    AdminSettings.findOne = findOne;
  }
});

test('rejects a legacy token after the admin password changes', async () => {
  const req = { headers: { authorization: `Bearer ${jwt.sign({ role: 'admin' }, 'test-secret')}` } };
  const res = response();
  const findOne = AdminSettings.findOne;
  AdminSettings.findOne = () => ({ select: () => ({ lean: async () => ({ passwordVersion: 1 }) }) });
  try {
    await adminAuth(req, res, () => assert.fail('next should not run'));
    assert.equal(res.statusCode, 401);
    assert.match(res.body.message, /session expired/i);
  } finally {
    AdminSettings.findOne = findOne;
  }
});