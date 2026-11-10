// Guessing is cut short: after ten wrong passwords for an account, the next tries are refused, the
// right password too, while other accounts are let in; after twenty wrong codes for a league's
// registration, the next codes are refused. A name or password that is not a string is refused.
const { test, expect } = require('./fixtures');
const ids = require('./ids');

test.use({ user: 'admin' });

test('an account is not guessed at more than ten times', async ({ page, playwright, baseURL }) => {
  const username = `guessed${Date.now()}`;
  expect((await page.request.post('/api/users', { data: { username, password: 'right1234' } })).ok()).toBeTruthy();
  const guesser = await playwright.request.newContext({ baseURL });
  const login = (password) => guesser.post('/api/auth/login', { data: { username, password } });
  for (let i = 0; i < 10; i++) expect((await login(`wrong${i}`)).status()).toBe(400);
  expect((await login('right1234')).status()).toBe(429);
  // Others are let in
  const other = await playwright.request.newContext({ baseURL });
  expect((await other.post('/api/auth/login', { data: { username: 'judge', password: 'judgepass' } })).ok()).toBeTruthy();
  // Not a query of the database
  expect((await other.post('/api/auth/login', { data: { username: { $ne: '' }, password: 'judgepass' } })).status()).toBe(400);
  await Promise.all([guesser.dispose(), other.dispose()]);
});

test('a league\'s registration code is not guessed at more than twenty times', async ({ playwright, baseURL }) => {
  const visitor = await playwright.request.newContext({ baseURL });
  const guess = (passCode) => visitor.post(`/api/registration/auth/${ids.competition}/LineNL/en`, { data: { passCode, mail: 'guess@example.com' } });
  for (let i = 0; i < 20; i++) expect((await guess(`CODE${i}`)).status()).toBe(403);
  expect((await guess('CODE20')).status()).toBe(429);
  await visitor.dispose();
});
