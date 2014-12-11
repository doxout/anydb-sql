var TxMonad  = require('../lib/tx-monad');
var assert = require('assert');
var Promise = require('bluebird');
var t = require('blue-tape');

// Makes a mock transaction
function makeTx(tx) {
    return {
        query: function(query, params) {
            console.log("Executed within", tx, ":", query, ", params =", params);
            if (query === "error")
                return Promise.reject(new Error("Oops"));
            return Promise.resolve([query, params]);
        }
    };
}

function query(q, args) {
    return new TxMonad(q, args);
}

t.test('chain', function(t) {

    var chainOfQueries = query("Test 1", ["lol"]).chain(function(result) {
        assert.equal(result[0], "Test 1");
        return query("Test 2", ["lol"]);
    }).chain(function(result) {
        assert.equal(result[0], "Test 2");
        return query("Test 3", []).chain(function(result) {
            assert.equal(result[0], "Test 3");
            return query("Test 4", []);
        });
    }).chain(function(result) {
        assert.equal(result[0], "Test 4")
        return "Test 5"
    }).chain(function(result) {
        assert.equal(result, "Test 5", "should pass-through");
    });


    return chainOfQueries.runWithin(makeTx("LolTx"));
});

//----------------------------------------------------------------------

t.test('join', function(t) {
    var q1 = query("Hello");
    var q2 = query("World");

    return TxMonad.join(q1, q2, function(r1, r2) {
        return query(r1[0] + " " + r2[0]);
    }).chain(function(res) {
        return query("Test " + res[0])
    }).runWithin(makeTx("Tx2")).then(function(res) {
        assert.equal(res[0], "Test Hello World");
    });
});


t.test('catch', function(t) {
    return query("Hi").chain(function() {
        return query("error");
    }).chain(function(v) {
        t.notOk(true, "should not execute this");
    }).catch(function(e) {
        t.ok(e, "should catch error");
        return query("handle first error");
    }).chain(function() {
        throw new Error("Also handles thrown errors");
    }).catch(function(e) {
        t.ok(e, "should catch thrown error");
        return query("ok");
    }).runWithin(makeTx("Tx3")).then(function(res) {
        t.ok(res[0] === 'ok', "We are done");
    });
});


t.test('unit', function(t) {
    return TxMonad.unit(5).chain(function(val) {
        return query("testing the unit method", ['arg']);
    }).runWithin(makeTx("Tx4")).then(function(res) {
        t.ok(res[0] == "testing the unit method", "tx propagated");
    });
});
