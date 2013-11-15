var _ = require('lodash');

function isObject(o) { 
    if (typeof(o) == 'string')
        return false;
    for (var key in o) if (o.hasOwnProperty(key)) {
        return true; 
    }
    return false; 
}

function hasNumberOfProperties(o, n) { 
    var k = 0;
    for (var key in o) if (o.hasOwnProperty(key))
        if (++k > n) return false;
    return k == n; 
}

function normalize(row) {
    var res = {}, item;
    for (var key in row) if (row.hasOwnProperty(key)) {
        var path = key.split('.'), plen = path.length;
        for (var k = 0, obj = res; k < plen - 1; ++k) {
            item = path[k];
            if (!obj[item]) obj[item] = {};
            obj = obj[item];
        }
        item = path[plen - 1];
        obj[item] = row[key];
    }
    return res;
}

function stringKey(object, exclude, include) {
    var str = '', altstr = '', found = false;
    for (var key in object) if (object.hasOwnProperty(key)) {
        var item = object[key]

        if (include && include(item, key)) {
            if (typeof(item) === 'string')
                str += '"';
            str += item + '~#~'
            found = true;
        }
        else if (!found && !exclude(item, key)) {
            altstr += item + '~#~';
        }
    }
    if (found) return str;
    return altstr; 
}

function isDeepNull(obj) {
    if (obj == null) 
        return true;
    else if (obj instanceof Array) {
        for (var k = 0, l = obj.length; k < l; ++k)
            if (!isDeepNull(obj[k]))
                return false;
        return true;
    } else if (isObject(obj)) {
        for (var key in obj) if (obj.hasOwnProperty(key)) 
            if (!isDeepNull(obj[key])) 
                return false;
        return true;
    }
    return false;
}

function group(rows, groupTest, eqTest) {
    var groups = {}, groupKeys, otherKeys;
    for (var i = 0, il = rows.length; i < il; ++i) {
        var row = rows[i];
        if (!groupKeys)
            groupKeys = Object.keys(_.pick(row, groupTest));

        var withoutGroups = _.omit(row, groupTest);
        if (!otherKeys)
            otherKeys = Object.keys(withoutGroups);

        var itemKey = stringKey(row, groupTest, eqTest);

        var thisGroup = groups[itemKey]; 

        if (!thisGroup) {
            thisGroup = groups[itemKey] = withoutGroups;
            for (var k = 0, l = groupKeys.length; k < l; ++k) {
                thisGroup[groupKeys[k]] = [];
            }
        }

        for (var k = 0, l = groupKeys.length; k < l; ++k) {
            var gk = groupKeys[k];
            thisGroup[gk].push(row[gk]);
        }
    }
    return _.map(groups, function(item) {
        for (var k = 0, l = groupKeys.length; k < l; ++k) {
            var gk = groupKeys[k];
            var itemGroup = item[gk];

            if (isDeepNull(itemGroup))
                item[gk] = [];
            else
                item[gk] = group(itemGroup, groupTest, eqTest);
        }
        return item;
    });
}

function clean(val, cleaner) {
    if (val instanceof Array) {
        for (var k = 0, l = val.length; k < l; ++k) 
            val[k] = clean(val[k], cleaner);
        return val;
    }
    var cleaned = {};
    for (var key in val) {
        var newkey = key.replace(cleaner, '');
        var item = val[key];
        if (key == newkey && item instanceof Array)
            item = clean(item[0], cleaner);
        else if (item instanceof Array || _.isPlainObject(item))
            item = clean(item, cleaner);
        cleaned[newkey] = item;
    }
    return cleaned;
}


function firstProperty(obj) {
    for (var key in obj) if (obj.hasOwnProperty(key)) 
        return obj[key];
}

function firstKey(obj) {
    for (var key in obj) if (obj.hasOwnProperty(key)) 
        return key;
}


function removeDepth(rows) {
    while (rows.length > 0 
           && hasNumberOfProperties(rows[0], 1)
           && isObject(firstProperty(rows[0]))) {
        var key = firstKey(rows[0]);
        for (var k = 0; k < rows.length; ++k)
            rows[k] = rows[k][key];
    }
    return rows;
}

function isGroup(val, key) {
    return isObject(val);
}

function isKey(val, key) {
    return (/##$/).test(key);
}



function isGroup(val, key) {
    return isObject(val);
}

function isKey(val, key) {
    return (/##$/).test(key);
}

var cleanRegex = /(\[\]|##)$/;


function checkKeys(row, reg) {
    for (var key in row) if (row.hasOwnProperty(key))
        if (reg.test(key))
            return true;
    return false;
}


function process(rows) {
    var rlen = rows.length, processed;
    if (rlen === 0) return rows;
    if (!checkKeys(rows[0], /\./)) return rows;

    // Above 4 rows it pays off to build new functions

    if (rlen > 4)         
        processed = removeDepth(rows.map(makeNormalizer(rows[0])));
    else 
        processed = removeDepth(rows.map(normalize));

    if (checkKeys(rows[0], /\[\]/)) {
        processed = group(processed, isGroup, isKey)
        processed = clean(processed, cleanRegex);
    }
    else {
        if (rlen > 4)
            processed = cleanFast(processed, cleanRegex);
        else
            processed = clean(processed, cleanRegex);
    }
    return processed;
}


exports.isObject = isObject;

exports.normalize = normalize;
exports.clean = clean;
exports.group = group;
exports.removeDepth = removeDepth;

exports.process = process;


// Experimental: optimize performance by pre-compiling the 
// object cleaner and normalizer

function makeNormalizer(skeleton) {
    var obj = normalize(skeleton);
    var code = 'return ' + segment(obj, '') + ';';

    function segment(obj, base) {
        var arr = [];
        for (var key in obj) if (obj.hasOwnProperty(key)) {
            var item = obj[key];
            var accessor = base ? base + '.' + key : key;
            if (!isObject(item)) {
                arr.push('"' + key + '": row["' + accessor + '"]');
            } else {
                arr.push('"' + key + '":' + segment(item, accessor));
            }
        }
        return '{' + arr.join(',') + '}';
    }
    return new Function('row', code);
}

function cleanFast(rows, regex) {
    var cleaner = makeCleaner(rows[0], cleanRegex);
    return rows.map(cleaner);
}

function makeCleaner(skeleton, cleanRegex) {

    return new Function(
        'row', 
        'return ' + segment(skeleton, 'row') + ';');

    function segment(obj, prefix) {
        var arr = [];
        for (var key in obj) if (obj.hasOwnProperty(key)) {
            var item = obj[key];
            var newkey = key.replace(cleanRegex, '');
            var accessor = newkey != key ? prefix + '["' + key + '"]'
                                         : prefix + '.' + key;

            if (!isObject(item)) {
                arr.push(newkey + ':' + accessor)
            } else {
                arr.push(newkey + ':' + segment(item, accessor));
            }
        }
        return '{' + arr.join(',') + '}';
    }
}



