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

        if (dialect == 'sqlite') {
            try {
                var sqlitepool = require('./sqlite-pool');
                var pool = sqlitepool(opt.url, opt.connections);
            } catch (e) {
                throw new Error("Unable to load sqlite pool: " + e.message);
            }
        }
        else {
            var pool = anyDB.createPool(opt.url, opt.connections);
        }

        var self = {};


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
                        fn(err, res ? res.rows : null);
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


        self.define = function () {
            return extendedTable(sql.define.apply(sql, arguments));
        };


        self.close = pool.close.bind(pool);
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
