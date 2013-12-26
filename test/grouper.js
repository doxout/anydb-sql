var util = require('util');
var grouper = require('../lib/grouper');
var t = require('tap');


t.test('normalizer', function(t) {
    var n = grouper.normalize;
    t.test('normalizes well', function(t) {
        var normalized = n({'a.b':1, 'a.c': 2, b: 3, 'c.a': 1, 'c.b': 2});
        t.deepEquals(normalized, {
            a: {b: 1, c: 2},
            b: 3,
            c: {a: 1, b: 2}
        });
        t.end();
    });
});

var grouperData = require('./lib/grouper-data'); 


function groupTest(val, key) {
    //return (/\[\]$/).test(key);
    return grouper.isObject(val);
}

function eqTest(val, key) {
    return (/##$/).test(key);
}

t.test('grouper', function(t) {
    var group = grouper.group,
        clean = grouper.clean;

    t.test('minimal but nested in nongroups', function(t) {
        var grouped = group(grouperData.mininput, groupTest, eqTest);
        var ungrouped = clean(grouped, /(\[\]|##)$/);
        //console.log(util.inspect(ungrouped, false, 5));
        t.deepEquals(ungrouped, grouperData.minoutput);
        t.end();
    });
    t.test('deep but no nesting of non-groups', function(t) {
        var grouped = group(grouperData.input, groupTest, eqTest);
        var ungrouped = clean(grouped, /(\[\]|##)$/);
        //console.log(util.inspect(ungrouped, false, 5));
        t.deepEquals(ungrouped, grouperData.output);
        t.end();
    });
}); 


