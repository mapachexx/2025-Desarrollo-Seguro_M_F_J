const bcrypt = require('bcrypt');

exports.seed = async function(knex) {
  const pass1 = await bcrypt.hash(process.env.SEED_PASS_1 || 'default123', 10);
  const pass2 = await bcrypt.hash(process.env.SEED_PASS_2 || 'default123', 10);

  const users = await knex('users').insert([
    { username: 'test', email: 'test@example.local', password: pass1, first_name: 'Test', last_name: 'User', activated: true },
    { username: 'prod', email: 'prod@example.local', password: pass2, first_name: 'Prod', last_name: 'User', activated: true }
  ]).returning('id');

  await knex('invoices').insert([
    { userId: users[0].id || users[0], amount: 100, dueDate: new Date('2025-01-01'), status: 'unpaid' },
    { userId: users[1].id || users[1], amount: 200, dueDate: new Date('2025-01-01'), status: 'paid' }
  ]);
};
