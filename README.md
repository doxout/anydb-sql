# anydb-sql

anydb-sql combines [node-anydb](https://github.com/grncdr/node-any-db)
and [node-sql](https://github.com/brianc/node-sql) into a single package full 
of awesomeness.

# examples and usage:

Initializing an instance also creates a connection pool. The url argument is 
the same as in node-anydb

```js
var anydbsql = require('anydb-sql');

var db = anydbsql({
    url: 'postgres://user:pass@host:port/database',
    connections: { min: 2, max: 20 }
});
```

Defining a table for that database is the same as in node-sql:

```js
var user = db.define({
    name: 'Users',
    columns: ['id', 'email', 'password']
});
```

## extra methods

Queries have all the methods as in node-sql, plus the additional methods:

* exec(function(err, rows)) - executes the query and calls the callback 
  with an array of rows
* all - same as exec
* get(function(err, row)) - executes the query and returns the first result
* allObject(keyColumn, function(err, map), [mapper, filter]) - executes the query and maps the result to an object
* execWithin(transaction, function(err, rows)) - execute within a transaction

If you omit the callback from the additional methods, an eventemitter will be 
returned instead (like in anydb).

Use regular node-sql queries then chain one of the additional methods at the 
end:

```js
user.where({email: user.email}).get(function(err, user) {
  // user.name, 
});
```

## joins and subobjects

Join queries can be constructed using node-sql. The format of the results is 
the same as with anydb

```js
user.select(user.name, post.content)
  .from(user.join(post).on(user.id.equals(post.userId)))
  .where(post.date.gt(yesterday))
  .all(function(err, userposts) {
    // res[0].name and res[0].content
  });
```

When creating join queries, you can generate sub-objects in the result by 
specifying aliases that contain dots in the name:

```js
user.select(user.name.as('user.name'), post.content.as('post.content'))
  .from(user.join(post).on(user.id.equals(post.userId)))
  .where(post.date.gt(yesterday))
  .all(function(err, res) {
    // res[0].user.name and res[0].post.content
  });
```


or you can use db.allOf to do the above for all the table's columns :

```js
user.select(db.allOf(user, post))
  .from(user.join(post).on(user.id.equals(post.userId)))
  .where(post.date.gt(yesterday))
  .all(function(err, res) {
    // contains res[0].user.name, res[0].post.content and all
    // other columns from both tables in two subobjects per row.
  });
```

## transactions

Create a transactions and execute queries within it

```js
var tx = db.begin()
user.insert({name: 'blah'}).returning(user.id).execWithin(tx);
user.insert({name: 'bleh'}).returning(user.id).execWithin(tx);
tx.commit();
```

Transactions have the same API as anydb tranactions

# db.close and custom queries

You can close the connection pool

```js
db.close();
```

Or execute custom queries

```js
db.query(...anydb arguments...)
```

# licence

MIT

