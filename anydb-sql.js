var anyDB = require('any-db');
var sql = require('sql');
var url = require('url');
var grouper = require('./lib/grouper');
var EventEmitter = require('events').EventEmitter;
var crypto = require('crypto');
var P = require('bluebird');
var util = require('util');

var queryMethods = [
    'select', 'from', 'insert', 'update',
    'delete', 'create', 'drop', 'alter', 'where',
    'indexes'
];


function extractDialect(adr) {
    var dialect = url.parse(adr).protocol;
    dialect = dialect.substr(0, dialect.length - 1);
    if (dialect == 'sqlite3')
        dialect = 'sqlite';
    return dialect;
}

function wrapQuery(ctx) {
    if (ctx._wrapquery) return ctx;
    var res = ctx;
    res._wrapquery = true;
    if (typeof(res.queryAsync) !== 'function') {
        if (!res.queryAsync)
            if (res._mainpool || res._transaction)
                P.promisifyAll(Object.getPrototypeOf(res));
            else
                P.promisifyAll(res);
    }
    return res;
}

module.exports = function (opt) {

    var pool,
        db = {},
        dialect = extractDialect(opt.url);

    sql.setDialect(dialect);

    db.open = function() {
        if (pool) return; // already open
        if (dialect == 'sqlite') {
            try {
                var SQLitePool = require('./lib/sqlite-pool');
                pool = new SQLitePool(opt.url, opt.connections);
            } catch (e) {
                throw new Error("Unable to load sqlite pool: " + e.message);
            }
        }
        else {
            pool = anyDB.createPool(opt.url, opt.connections);
        }
        pool._mainpool = true;
        pool = wrapQuery(pool);
    }

    db.open();
    db.models = {};

    function extendedTable(table, opt) {
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
            return extendedTable(table.as.apply(table, arguments), opt);
        };
        extTable.eventEmitter = new EventEmitter();
        extTable.__isTable = true;

        if (opt.has)
            defineRelations(extTable, opt.has);
        return extTable;
    }


    function tableName(t) { return t.alias || t._name; }
    function defineRelations(owner, has) {
        Object.keys(has).forEach(function(name) {
            var what = has[name],
                table = what.from,
                many = what.many ? '[]' : '{}',
                foreign;
            Object.defineProperty(owner, name, {
                get: function() {
                    if (!foreign)
                        if (typeof(table) == 'string')
                            foreign = db.models[table];
                        else
                            foreign = table;
                    var ownerName = tableName(owner);
                    var aliased = foreign.as(ownerName + '.' + name + many);
                    // Mark that this table is a subtable
                    aliased.__isSubtable = true;
                    return aliased;
                }
            });
        });
    }


    function extendedQuery(query) {
        var extQuery = Object.create(query);
        var self = extQuery;

        self.__extQuery = true;

        extQuery.execWithin = function (where, fn) {
            if (!where || !where.queryAsync) {
                console.error(where);
                throw new Error("query: Cannot execWithin " + where);
            }
            var query = self.toQuery(); // {text, params}

            var resPromise = where.queryAsync(query.text, query.values);
            return resPromise.then(function (res) {
                if (where._logQueries) {
                    console.log("anydb-sql query complete: `" + query.text
                                + "` with params", query.values);
                }
                return res && res.rows ? grouper.process(res.rows) : null;
            }, function(err) {
                err = new Error(err);
                err.message = err.message.substr('Error  '.length)
                    + ' in query `' + query.text
                    + '` with params ' + JSON.stringify(query.values);
                throw err;
            }).nodeify(fn);
        };
        extQuery.allWithin = extQuery.execWithin;
        extQuery.exec = extQuery.execWithin.bind(extQuery, pool);
        extQuery.all = extQuery.exec;

        extQuery.getWithin = function(where, fn) {
            var q = self.execWithin(where);
            return q.then(function(rows) {
               return rows && rows.length ? rows[0] : null;
            }).nodeify(fn);
        }

        extQuery.get = extQuery.getWithin.bind(extQuery, pool);

        queryMethods.forEach(function (key) {
            extQuery[key] = function extFn() {
                var q = query[key].apply(query, arguments);
                if (q.__extQuery) return q;
                return extendedQuery(q);
            }
        });

        extQuery.selectDeep = function() {
            return extQuery.select(db.allOf.apply(db, arguments));
        };


        return extQuery;
    }


    db.define = function (opt) {
        var t = extendedTable(sql.define.apply(sql, arguments), opt);
        db.models[opt.name] = t;
        return t;
    };

    db.functions = sql.functions;

    db.close = function() {
        if (pool)
            pool.close.apply(pool, arguments);
        pool = null;
    };

    db.begin = function() {
        var tx = pool.begin();
        return wrapTransaction(tx);
    }

    db.transaction = function(f) {
        return P.try(function() {
            return wrapTransaction(pool.begin());
        }).then(function(tx) {
            return P.try(f, tx).then(function(res) {
                return tx.commitAsync().thenReturn(res);
            }, function(err) {
                return tx.rollbackAsync().thenThrow(err);
            });
        });
    }

    db.query = function() {
        return pool.query.apply(pool, arguments);
    }


    function columnName(c) {
        var name = c.alias || c.name;
        if (c.primaryKey && !c.aggregator)
            name = name + '##';
        return name;
    }


    function tableTypes(tables) {
        var sub = {}, normal = {};
        tables.forEach(function(t) {
            if (!(t.__isTable || t.__isSubtable))
                t = t.table;
            if (t.__isSubtable)
                sub[tableName(t)] = true;
            else
                normal[tableName(t)] = true;
        });

        return {
            sub: Object.keys(sub),
            normal: Object.keys(normal)
        };
    }

    db.allOf = function() {
        var tables = [].slice.call(arguments);
        var ttypes = tableTypes(tables);
        if (ttypes.sub.length > 0 && ttypes.normal.length > 1)
            throw new RangeError(
                "Only one main table is allowed when selecting subtables, "
               + ttypes.normal.length + " found. " + ttypes.normal );

        return tables.reduce(function (all, table) {
            var tableName = table.alias || table._name;
            if (table.columns)
                return all.concat(table.columns.map(function(c) {
                    return c.as(tableName + '.' + columnName(c));
                }));
            else if (table.aggregate) {
                var column = table;
                tableName = column.table.alias || column.table._name;
                return all.concat([column.as(tableName + '.'
                                             + columnName(column))]);
            } else if (table.aggregator) {
                var column = table;
                tableName = column.table.alias || column.table._name;
                tableName = tableName.split('.').slice(0, -1).join('.');
                return all.concat([column.as(tableName + '.'
                                             + columnName(column))]);
            }
            else {
                return all;
            }
        }, []);
    };

    function wrapTransaction(tx) {
        tx.savepoint = function() {
            var spname = crypto.randomBytes(6).toString('base64');
            if (dialect == 'mysql')
                spname = '`' + spname + '`';
            else
                spname = '"' + spname + '"';
            tx.query('SAVEPOINT ' + spname);
            function restore(cb) {
                return tx.query('ROLLBACK TO SAVEPOINT ' + spname, cb);
            }
            function release(cb) {
                return tx.query('RELEASE SAVEPOINT ' + spname, cb);
            }
            return {
                __savepoint: true,
                rollback: restore,
                commit: release,
                restore: restore,
                release: release,
                query: function() {
                    return tx.query.apply(tx, arguments);
                }
            };
        };
        tx.__transaction = true;
        tx.logQueries = function(enabled) {
            tx._logQueries = enabled;
        }
        return wrapQuery(tx);
    }

    var oldpool;

    db.test = {
        end:  function() {
            if (pool.rollback) {
                pool.rollback();
                pool = oldpool;
            }
        }, begin: function() {
            if (!pool) db.open();
            if (!pool.rollback) {
                oldpool = pool;
                pool = db.begin();
                pool.begin = pool.savepoint
            }
        }
    };

    db.getPool = function() {
        return pool;
    };

    return db;

};

