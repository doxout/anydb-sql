var url = require('url');
var path = require('path');
var sqlite = require('sqlite3');



function SQLitePool(dbpath, conns) {
    if (!this instanceof SQLitePool)
        return new SQLitePool(dbpath, conns);
    var parsed = url.parse(dbpath), dbfile;
    if (parsed.path)
        dbfile = path.join(parsed.hostname, parsed.path);
    else
        dbfile = ':memory:';
    this.db = new sqlite.Database(dbfile);
    this.db.serialize();
}

var self = SQLitePool.prototype;

self.query = function query(q, args, cb) {
    if (!cb && typeof(args) == 'function') {
        cb = args;
        args = [];
    }
    this.db.all(q, args, function (err, res) {
        if (cb) cb(err, {rows: res});
    });
};

self.begin = function (cb) {
    this.query('BEGIN;', function(err){
        if (err) return cb && cb(err);
        if (cb) return cb(null, this);
    });
    return new SQLiteTransaction(this);
};

self.commit = function (cb) {
    this.query('COMMIT;', cb)
};

self.rollback = function(cb) {
    this.query('ROLLBACK;', cb);
};

self.close = function(cb) {
    return this.db.close(cb);
}



function SQLiteTransaction(p) {
    this.db = p;
}

SQLiteTransaction.prototype.query = function(q, p, cb) {
    return this.db.query(q, p, cb);
};

SQLiteTransaction.prototype.commit = function(cb) {
    return this.query('COMMIT;', cb);
};

SQLiteTransaction.prototype.rollback = function(cb) {
    return this.query('ROLLBACK;', cb);
}



module.exports = SQLitePool;
