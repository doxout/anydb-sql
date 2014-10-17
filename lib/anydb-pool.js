
var anyDB = require('any-db');
var begin = require('any-db-transaction');
var Promise = require('bluebird');

Promise.promisifyAll(begin.Transaction.prototype);

function AnyDBPool(url, connections) {
    this.pool = anyDB.createPool(url, connections);
}

AnyDBPool.prototype.query = function(sql, args, callback) {
    this.pool.query(sql, args, callback);
}

AnyDBPool.prototype.begin = function() {
    return begin(this.pool);
}

AnyDBPool.prototype.close = function(cb) {
    return this.pool.close(cb);
}

Promise.promisifyAll(AnyDBPool.prototype);

module.exports = AnyDBPool;
