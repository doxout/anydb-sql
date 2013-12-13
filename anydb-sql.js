var anyDB = require('any-db');


var sql = require('sql');
var url = require('url');
var _   = require('lodash');

var grouper = require('./lib/grouper');

var EventEmitter = require('events').EventEmitter;

var queryMethods = ['select', 'from', 'insert', 'update',
    'delete', 'create', 'drop', 'alter', 'where',
    'indexes'];


var crypto = require('crypto');

var P = require('bluebird');

var util = require('util');

function extractDialect(adr) {
    var dialect = url.parse(adr).protocol;
    dialect = dialect.substr(0, dialect.length - 1);
    if (dialect == 'sqlite3') 
        dialect = 'sqlite';
    return dialect;
}

function wrapQuery(ctx) {
    if (ctx._wrapquery) return ctx;
    var res = Object.create(ctx);
    res._wrapquery = true;

    res.query = function(q, args, cb) {
        if (typeof(args) === 'function') { 
            cb = args; 
            args = undefined; 
        }
        var r = P.pending();
        ctx.query(q, args, function(err, res) {
            if (err) r.reject(err);
            else r.fulfill(res);
        })
        return r.promise.nodeify(cb);
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
                var sqlitepool = require('./lib/sqlite-pool');
                pool = sqlitepool(opt.url, opt.connections);
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

        if (opt.has) defineRelations(extTable, opt.has);
        return extTable;
    }


    function tableName(t) { return t.alias || t._name; }
    function defineRelations(owner, has) {
        Object.keys(has).forEach(function(name) {
            var what = has[name],
                table = what.from,
                many = what.many ? '[]' : '',
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
            if (!where || !where.query) 
                throw new Error("query: Cannot execWithin " + where);
            var query = self.toQuery(); // {text, params}

            var resPromise = where.query(query.text, query.values);
            return resPromise.then(function (res) {
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
    db.query = function() { 
        return pool.query.apply(pool, arguments);
    }


    function columnName(c) {
        var name = c.alias || c.name;
        if (c.primaryKey) 
            name = name + '##';
        return name;
    }


    function tableTypes(tables) {
        return {
            sub:tables.filter(function(t) { return t.__isSubtable; })
                .map(tableName),
            normal:tables.filter(function(t) { return !t.__isSubtable; })
                .map(tableName)
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


    return db;

};

