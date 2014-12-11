var Promise = require('bluebird');
var assert = require('assert');

function TxMonad(query, params) {
    this.tx = Promise.defer();
    this.query = query;
    this.params = params;
    this.result = Promise.defer();
    this.parent = null;
    this.hasQuery = true;
    var self = this;
    this.tx.promise.done(function(tx) {
        if (self.query != null) {
            var result = tx.query(self.query, self.params);
            self.result.resolve(result);
        }
    });
}

function isTxMonad(m) {
    return m != null &&
        typeof(m.propagateToRoot) === 'function' &&
        typeof(m.hasQuery)  === 'boolean';
}

TxMonad.resolve = TxMonad.unit = function(val) {
    if (isTxMonad(val)) return val;
    else {
        var tm = new TxMonad();
        tm.hasQuery = false;
        tm.follow(val);
        return tm;
    }
}

function fromParent(parent) {
    var txm = new TxMonad();
    txm.parent = parent;
    txm.hasQuery = false;
    txm.tx.resolve(parent.tx.promise);
    return txm;
}

var currentError;
function tryExec(f, arg) {
    try {
        return f(arg);
    } catch(e) {
        return (currentError = e);
    }
}

TxMonad.prototype.follow = function(other) {
    if (isTxMonad(other)) {
        other.propagateToRoot(this.tx.promise);
        this.result.resolve(other.result.promise);
    }
    else
        this.result.resolve(other);
}

TxMonad.prototype.chain = function(f) {
    var newTxm = fromParent(this);
    this.result.promise.done(function(val) {
        var res = tryExec(f, val);
        if (res === currentError)
            newTxm.result.reject(currentError);
        else
            newTxm.follow(res);
    }, function(e) {
        newTxm.result.reject(e);
    });
    return newTxm;
}

TxMonad.prototype.catch = function(f) {
    var newTxm = fromParent(this);
    this.result.promise.done(function(val) {
        newTxm.result.resolve(val);
    }, function(err) {
        var res = tryExec(f, err);
        if (res === currentError)
            newTxm.result.reject(currentError);
        else
            newTxm.follow(res);
    });
    return newTxm;
}

TxMonad.prototype.propagateToRoot = function(tx) {
    if (this.parent)
        this.parent.propagateToRoot(tx);
    else
        this.tx.resolve(tx);
}

TxMonad.prototype.runWithin = function(tx) {
    this.propagateToRoot(tx);
    return this.result.promise;
}

TxMonad.prototype.spread = function(f) {
    return this.chain(function(params) {
        return f.apply(this, params);
    });
}

TxMonad.join = function(t1, t2, f) {
    return t1.chain(function(res1) {
        return t2.chain(function(res2) {
            return f(res1, res2);
        });
    });
};


module.exports = TxMonad;
