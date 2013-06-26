var url = require('url'),
path = require('path'),
sqlite = require('sqlite3');

module.exports = function createSQLitePool(dbpath, conns) {
    var parsed = url.parse(dbpath);
    if (parsed.path)
        var dbfile = path.join(parsed.hostname, parsed.path);
    else
        var dbfile = ':memory:';

    var db = new sqlite.Database(dbfile);
    db.serialize();
    var self = {};

    self.query = function query(q, args, cb) {
        if (!cb && typeof(args) == 'function') {
            cb = args;
            args = [];
        }
        db.all(q, args, function (err, res) {
            cb && cb(err, {rows: res});
        });
    };
    self.begin = function (cb) {
        self.query('BEGIN;', function(err){
            if (err) return cb && cb(err);
            if (cb) return cb(null, self);
        })
        return self;
    };
    self.commit = function (cb) {
        self.query('COMMIT;', cb)
    };
    self.close = db.close.bind(db);
    return self;
};


