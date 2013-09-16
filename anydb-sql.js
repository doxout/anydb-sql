var anyDB = require('any-db');


var sql = require('sql');
var url = require('url');
var _   = require('lodash');

var grouper = require('./lib/grouper');

var EventEmitter = require('events').EventEmitter;

var queryMethods = ['select', 'from', 'insert', 'update',
    'delete', 'create', 'drop', 'alter', 'where',
    'indexes'];

function extractDialect(adr) {
    var dialect = url.parse(adr).protocol;
    dialect = dialect.substr(0, dialect.length - 1);
    if (dialect == 'sqlite3') 
        dialect = 'sqlite';
    return dialect;
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
                    var ownerName = owner.alias || owner._name;
                    return foreign.as(ownerName + '.' + name + many);

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
            if (!fn)
                return where.query(query.text, query.values);
            else
                return where.query(query.text, query.values, function (err, res) {
                    if (err) {
                        err = new Error(err);
                        err.message = err.message.substr('Error  '.length) 
                        + ' in query `' + query.text 
                        + '` with params ' + JSON.stringify(query.values);
                    }
                    fn(err, res && res.rows ? grouper.process(res.rows) : null);
                });
        };
        extQuery.allWithin = extQuery.execWithin;
        
        extQuery.exec = extQuery.execWithin.bind(extQuery, pool);
        extQuery.all = extQuery.exec;

        extQuery.getWithin = function(where, fn) {
            return self.execWithin(where, function getSingleResult(err, rows) {
                return fn(err, rows && rows.length ? rows[0] : null);
            });
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


    db.close = function() {
        if (pool) 
            pool.close.apply(pool, arguments);
        pool = null;
    };

    db.begin = pool.begin.bind(pool);
    db.query = pool.query.bind(pool);


    function columnName(c) {
        var name = c.alias || c.name;
        if (c.primaryKey) 
            name = name + '##';
        return name;
    }

    db.allOf = function() {
        var tables = [].slice.call(arguments);
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
                console.log(table);
                return all;
            }
        }, []);
    };

    return db;

};

