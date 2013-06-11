var test = require('tap').test;

var anydbsql = require('../anydb-sql');

var path = require('path');

var dburl = path.join(__dirname, 'test.db');

var db = anydbsql({
  url: 'sqlite3://' + dburl,
  connections: 1
});

var user = db.define({
  name: 'users',
  columns: ['id', 'name']
});

test('anydb-sql', function(t) {

  db.query('delete from users;', function(err) {

    t.notOk(err, 'creating table failed: ' + err);

    t.test('insert exec', function(t) {
      t.plan(1);
      user.insert({id: 1, name: 'test'}).exec(function(err, res) {
        t.notOk(err, 'user inserted without errors' + err);
        t.end();
      });
    });

    t.test('where get', function(t) {
      t.plan(1);
      user.where({id: 1}).get(function(err, user) {
        t.deepEquals(user, {id: 1, name: 'test'})
        t.end();
      });
    });

    t.test('insert transaction', function(t) {
      console.log('insert transaction');
      db.begin(function(err, tx){
        console.log('begin transaction', tx);
        user.insert({id: 2, name: 'test2'}).execWithin(tx);
        user.insert({id: 3, name: 'test3'}).execWithin(tx);
        console.log('now commiting transaction');
        tx.commit(function(err) {
          console.log('commit complete');
          t.notOk(err, 'two inserts within transaction');
          t.end();
        });
      });
    });

    t.test('db.close', function(t) {
      t.plan(1);
      db.close(function(err) {
        t.notOk(err, 'db closed');
        t.end();
      });
    });

  });

});
