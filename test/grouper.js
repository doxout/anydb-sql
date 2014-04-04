var util = require('util');
var grouper = require('../lib/grouper');
var t = require('tape');


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
    return grouper.isObject(val);
    //return grouper.isObject(val) && !/\!\!$/.test(key);
}

function eqTest(val, key) {
    return (/##$/).test(key);
}


var group = grouper.group, clean = grouper.clean;

function grouperTest(desc, inData, outData) {
    t.test(desc, function(t) {
        var grouped = group(inData, groupTest, eqTest);
        var ungrouped = clean(grouped, /(\[\]|##|\{\})$/);
        //console.log(util.inspect(ungrouped, false, 5));
        t.deepEquals(ungrouped, outData);
        t.end();
    });
}

grouperTest("minimal, nested in nongroups",
            grouperData.mininput, grouperData.minoutput);

grouperTest("deep but no nesting of non-groups",
            grouperData.mininput, grouperData.minoutput);


var nested = [
    {'id##': 1, metadata: [{a: 1}, {a: 2}]},
    {'id##': 2, metadata: [{b: 5}, {b: 8}]},
    {'id##': 3, metadata: [{b: 8}, {b: 7,c:[1,2,3]}]},
];
var nestedOut = [
    {'id': 1, metadata: [{a: 1}, {a: 2}]},
    {'id': 2, metadata: [{b: 5}, {b: 8}]},
    {'id': 3, metadata: [{b: 8}, {b: 7,c:[1,2,3]}]},
];


grouperTest("dont group nested data", nested, nestedOut);

