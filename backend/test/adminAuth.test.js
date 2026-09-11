const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const adminAuth = require('../middleware/adminAuth');

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

test('accepts a valid admin token', () => {
  const req = { headers: { authorization: `Bearer ${jwt.sign({ role: 'admin' }, 'test-secret')}` } };
  const res = response();
  let called = false;
  adminAuth(req, res, () => { called = true; });
  assert.equal(called, true);
  assert.equal(req.admin.role, 'admin');
});