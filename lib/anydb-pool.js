var anyDB = require('any-db');
var begin = require('any-db-transaction');
var Promise = require('bluebird');

var autowrapQuery = require('./autowrap-query');

autowrapQuery(begin.Transaction.prototype);
Promise.promisifyAll(begin.Transaction.prototype);


function AnyDBPool(url, connections) {
    this.pool = anyDB.createPool(url, connections);
}

AnyDBPool.prototype.query = function(query, callback) {
    this.pool.query(query.text, query.values, callback);
}

AnyDBPool.prototype.begin = function() {
    return begin(this.pool);
}

AnyDBPool.prototype.close = function(cb) {
    return this.pool.close(cb);
}

autowrapQuery(AnyDBPool.prototype);

Promise.promisifyAll(AnyDBPool.prototype);

module.exports = AnyDBPool;
