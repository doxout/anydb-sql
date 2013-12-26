
function isObject(o) { 
    return (o instanceof Object
            && !(o instanceof Array)
            && typeof(o) !== 'function'
            && Object.keys(o).length > 0)
}


function normalize(row) {
    var res = {}, item;
    var keys = Object.keys(row);
    for (var kk = 0; kk < keys.length; ++kk) {
        var key = keys[kk];
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

function stringKey(object, keys, include) {
    var str = '', altstr = '', found = false;
    for (var k = 0; k < keys.length; ++k) {
        var key = keys[k];
        var item = object[key]

        if (include && include(item, key)) {
            if (typeof(item) === 'string')
                str += '"';
            str += item + '~#~'
            found = true;
        }
        else if (!found || !include) {
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
        var keys = Object.keys(obj);
        for (var k = 0; k < keys.length; ++k)
            if (!isDeepNull(obj[keys[k]])) 
                return false;
        return true;
    }
    return false;
}

function splitOffKeys(row, groupTest) {
    var keys = Object.keys(row), 
        groupKeys = [],
        otherKeys = [];
    for (var k = 0; k < keys.length; ++k) {
        var key = keys[k];
        if (groupTest(row[key], key))
            groupKeys.push(key);
        else
            otherKeys.push(key);
    }
    return {group: groupKeys, other: otherKeys};

}
function group(rows, groupTest, eqTest) {
    var groups = {}, keys, omitter;
    for (var i = 0, il = rows.length; i < il; ++i) {
        var row = rows[i];
        if (!keys) {
            keys = splitOffKeys(row, groupTest);
            omitter = createOmitter(keys.other);
        }

        var withoutGroups = omitter(row, groupTest);
        var itemKey = stringKey(row, keys.other, eqTest);
        var thisGroup = groups[itemKey]; 

        if (!thisGroup) {
            thisGroup = groups[itemKey] = withoutGroups;
            for (var k = 0, l = keys.group.length; k < l; ++k) {
                thisGroup[keys.group[k]] = [];
            }
        }

        for (var k = 0; k < keys.group.length; ++k) {
            var gk = keys.group[k];
            thisGroup[gk].push(row[gk]);
        }
    }
    var results = [], grnames = Object.keys(groups);
    for (var g = 0; g < grnames.length; ++g) {
        var item = groups[grnames[g]];
        for (var k = 0, l = keys.group.length; k < l; ++k) {
            var gk = keys.group[k];
            var itemGroup = item[gk];

            if (isDeepNull(itemGroup))
                item[gk] = [];
            else
                item[gk] = group(itemGroup, groupTest, eqTest);
        }
        results.push(item);
    }
    return results;
}

function clean(val, cleaner) {
    if (val instanceof Array) {
        for (var k = 0, l = val.length; k < l; ++k) 
            val[k] = clean(val[k], cleaner);
        return val;
    }
    var cleaned = {};
    var keys = Object.keys(val);
    for (var k = 0; k < keys.length; ++k) {
        var key = keys[k];
        var newkey = key.replace(cleaner, '');
        var item = val[key];
        if (key == newkey && item instanceof Array)
            item = clean(item[0], cleaner);
        else if (item instanceof Array || isObject(item))
            item = clean(item, cleaner);
        cleaned[newkey] = item;
    }
    return cleaned;
}


function firstProperty(obj) {
    for (var key in obj) 
        if (obj.hasOwnProperty(key)) 
            return obj[key];
}

function firstKey(obj) {
    for (var key in obj) 
        if (obj.hasOwnProperty(key)) 
            return key;
}


function hasNumberOfProperties(o, n) { 
    var k = 0;
    for (var key in o) if (o.hasOwnProperty(key))
        if (++k > n) return false;
    return k == n; 
}


function depthRemovable(rows) {
    return rows.length > 0 
           && hasNumberOfProperties(rows[0], 1)
           && isObject(firstProperty(rows[0]))
           && firstKey(rows[0]);
}

function removeDepth(rows) {
    var key;
    while ((key = depthRemovable(rows)))
        for (var k = 0; k < rows.length; ++k)
            rows[k] = rows[k][key];
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
    var keys = Object.keys(row);
    for (var k = 0; k < keys.length; ++k)
        if (reg.test(keys[k]))
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
// object cleaner, normalizer and group omitter


function createOmitterItem(key) {
    return "'"+key+"':row['"+key+"']";
}
function createOmitter(otherKeys) {
    var fbody = "return {"
        + otherKeys.map(createOmitterItem).join(",") 
    + '}';
    return new Function("row", fbody);
}



function normalizerSegment(obj, base) {
    var arr = [];
    var keys = Object.keys(obj);
    for (var k = 0; k < keys.length; ++k) {
        var key = keys[k];
        var item = obj[key];
        var accessor = base ? base + '.' + key : key;
        if (!isObject(item)) {
            arr.push('"' + key + '": row["' + accessor + '"]');
        } else {
            arr.push('"' + key + '":' + normalizerSegment(item, accessor));
        }
    }
    return '{' + arr.join(',') + '}';
}


function makeNormalizer(skeleton) {
    var obj = normalize(skeleton);
    var code = 'return ' + normalizerSegment(obj, '') + ';';
    return new Function('row', code);
}

function cleanFast(rows, regex) {
    var cleaner = makeCleaner(rows[0], cleanRegex);
    return rows.map(cleaner);
}

function cleanerSegment(obj, prefix) {
    var arr = [];
    for (var key in obj) if (obj.hasOwnProperty(key)) {
        var item = obj[key];
        var newkey = key.replace(cleanRegex, '');
        var accessor = newkey != key ? prefix + '["' + key + '"]'
                                     : prefix + '.' + key;

        if (!isObject(item)) {
            arr.push(newkey + ':' + accessor)
        } else {
            arr.push(newkey + ':' + cleanerSegment(item, accessor));
        }
    }
    return '{' + arr.join(',') + '}';
}

function makeCleaner(skeleton, cleanRegex) {
    var code = 'return ' + cleanerSegment(skeleton, 'row') + ';';
    return new Function('row',code); 
}



