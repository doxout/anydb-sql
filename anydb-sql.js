var anyDB = require('any-db');


var sql = require('sql');
var url = require('url');

var EventEmitter = require('events').EventEmitter;

var queryMethods = ['select', 'from', 'insert', 'update',
    'delete', 'create', 'drop', 'alter', 'where',
    'indexes'];


module.exports = function (opt) {


    var dialect = url.parse(opt.url).protocol;
    dialect = dialect.substr(0, dialect.length - 1);
    if (dialect == 'sqlite3') 
        dialect = 'sqlite';
    sql.setDialect(dialect);

    var pool;

    var self = {};

    self.open = function() {
        if (pool) 
            return; // already open
        if (dialect == 'sqlite') {
            try {
                var sqlitepool = require('./sqlite-pool');
                pool = sqlitepool(opt.url, opt.connections);
            } catch (e) {
                throw new Error("Unable to load sqlite pool: " + e.message);
            }
        }
        else {
            pool = anyDB.createPool(opt.url, opt.connections);
        }
    }

    self.open();

    self.models = {};

    function extendedTable(table) {
        // inherit everything from a regular table.
        var extTable = Object.create(table); 

        // make query methods return extended queries.
        queryMethods.forEach(function (key) {
            extTable[key] = function () {
                return extendedQuery(table[key].apply(table, arguments));
            }
        });


        // make as return extended tables.
        extTable.as = function () {
            return extendedTable(table.as.apply(table, arguments));
        };
        extTable.eventEmitter = new EventEmitter();
        return extTable;
    }




    function extendedQuery(query) {
        var extQuery = Object.create(query);
        var self = extQuery;

        self.__extQuery = true;

        extQuery.execWithin = function (where, fn) {
            var query = self.toQuery(); // {text, params}
            if (!fn)
                return where.query(query.text, query.values);
            else
                return where.query(query.text, query.values, function (err, res) {
                    if (err) {
                        err = new Error(err);
                        err.message = 'SQL' + err.message + '\n' + query.text 
                        + '\n' + query.values;
                    }
                    fn(err, res && res.rows ? res.rows.map(normalizer) : null);
                });
        };

        extQuery.exec = extQuery.execWithin.bind(extQuery, pool);

        extQuery.all = extQuery.exec;

        extQuery.get = function (fn) {
            return this.exec(function (err, rows) {
                return fn(err, rows && rows.length ? rows[0] : null);
            })
        };

        queryMethods.forEach(function (key) {
            extQuery[key] = function () {
                var q = query[key].apply(query, arguments);
                if (q.__extQuery) return q;
                return extendedQuery(q);
            }
        });

        return extQuery;
    }


    self.define = function (opt) {
        var t = extendedTable(sql.define.apply(sql, arguments));
        self.models[opt.name] = t;
        return t;
    };


    self.close = function() {
        if (pool) 
            pool.close.apply(pool, arguments);
        pool = null;
    };

    self.begin = pool.begin.bind(pool);
    self.query = pool.query.bind(pool);


    self.allOf = function() {
        var tables = [].slice.call(arguments);
        return tables.reduce(function (all, table) {
            var tableName = table.alias || table._name;
            return all.concat(table.columns.map(function(c) {
                return c.as(tableName + '.' + c.name);
            }));
        }, []);
    };


    return self;

};

var normalizer = module.exports.normalizer = function normalizer(row) {
    var res = {};
    for (var key in row) {
        var path = key.split('.'), plen = path.length;
        for (var k = 0, obj = res; k < plen - 1; ++k) {
            var item = path[k];
            if (!obj[item]) obj[item] = {};
            obj = obj[item];
        }
        var item = path[plen - 1];
        obj[item] = row[key];
    }
    return res;
}


