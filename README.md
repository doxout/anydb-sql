# anydb-sql

anydb-sql combines [node-anydb](https://github.com/grncdr/node-any-db)
and [node-sql](https://github.com/brianc/node-sql) into a single package.

# examples and usage:

Initializing an instance also creates a connection pool. The url argument 
is the same as in node-anydb

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

Queries have the addtional methods:
* exec(function(err, rows)) - executes the query and calls the callback 
  with an array of rows
* get(function(err, row)) - executes the query and returns the first result
* all - same as exec
* execWithin(transaction, function(err, rows)) - execute within a transaction


Use regular node-sql queries then chain one of the additional
methods at the end:

```js
user.where({email: user.email}).get(function(err, users) {
  // users[0].name, 
});
```

Join queries have somewhat different results at the moment.
The format of the result is the same as with anydb

```js
user.select(user.name, post.content)
  .from(user.join(post).on(user.id.equals(post.userId)))
  .where(post.date.gt(yesterday))
  .where(user.id.equals(id))
  .get(function(err, res) {
    // res['name'] and res['content']
  });
```

Create a transactions and execute queries within it

```js
var tx = db.begin()
user.insert({name: 'blah'}).returning(user.id).execWithin(tx);
user.insert({name: 'bleh'}).returning(user.id).execWithin(tx);
tx.commit();
```

Transactions have the same API as anydb tranactions

In join queries you can create sub-objects in the result by specifying aliases
that contain dots in the name:

```js
user.select(user.name.as('user.name'), post.content.as('post.content'))
  .from(user.join(post).on(user.id.equals(post.userId)))
  .where(post.date.gt(yesterday))
  .where(user.id.equals(id))
  .get(function(err, res) {
    // res.user.name and res.post.content
  });
```


Or you can use db.allOf to select all columns and get them in sub-objects:

```js
user.select(db.allOf(user, post))
  .from(user.join(post).on(user.id.equals(post.userId)))
  .where(post.date.gt(yesterday))
  .where(user.id.equals(id))
  .get(function(err, res) {
    // contains res.user.name, res.post.content and all
    // other columns from both tables in two subobjects
    // per row.
  });
```




Finally you can close the connection pool

```js
db.close();
```

Or execute custom queries

```js
db.query(...anydb arguments...)
```

# licence

MIT



