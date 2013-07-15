var test = require('tap').test;

var anydbsql = require('../anydb-sql');

var path = require('path');


var db = anydbsql({
  url: 'sqlite3://', 
  connections: 1
});

var user = db.define({
  name: 'users',
  columns: ['id', 'name']
});


test('anydb-sql', function(t) {

  db.query('create table users (id integer primary key, name text);', function(err) {
    t.notOk(err, 'creating table failed: ' + err);

    t.test('insert exec', function(t) {
      user.insert({id: 1, name: 'test'}).exec(function(err, res) {
        t.notOk(err, 'user inserted without errors: ' + err);
        t.end();
      });
    });

    t.test('where get', function(t) {
      user.where({id: 1}).get(function(err, user) {
        t.deepEquals(user, {id: 1, name: 'test'})
        t.end();
      });
    });

    t.test('insert transaction', function(t) {
      db.begin(function(err, tx){
        user.insert({id: 2, name: 'test2'}).execWithin(tx);
        user.insert({id: 3, name: 'test3'}).execWithin(tx);
        tx.commit(function(err) {
          t.notOk(err, 'two inserts within transaction');
          t.end();
        });
      });
    });

    t.test('incorrect query', function(t) {
      user.insert({id: 4, name: 'lol'}).returning(user.id).exec(function(err, results) {
        t.ok(err, 'incorrect query');
        t.notOk(results, 'should return null results: ' + results)
        t.end();
      });
    });

    t.test('resultless get', function(t) {
      user.where({id: 40}).get(function(err, usr) {
        t.notOk(err, 'has no error');
        t.notOk(usr, 'should return null results:' + usr);
        t.end();
      });
    });


    t.test('table.as and join', function(t) {
      var userx = user.as('userx');
      var query = user.from(user.join(userx).on(user.id.equals(userx.id)))
        .where(userx.id.equals(1))
        .select(userx.id);
      console.log(query.toQuery())

      query.get(function(err, res) {
        console.log(err, res);
        t.equals(res.id,  1, 'user.id is 1');    
        t.end();
      });
    });

    t.test('allof', function(t) {
        var q = user.select(db.allOf(user, user));
        var text = 'SELECT "users"."id" AS "users.id",'
            + ' "users"."name" AS "users.name", "users"."id" AS "users.id",'
            +' "users"."name" AS "users.name" FROM "users"';
        t.equals(q.toQuery().text, text);
        t.end();
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
