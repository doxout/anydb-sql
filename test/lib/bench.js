var data = require('./grouper-data'),
    g = require('../../lib/grouper');


function test(which) {
    g.process(which);
}


var cleanData = [];

var depthData = [];

var dirtyData = [];

var NUM = 100;

for (var k = 0; k < NUM; ++k) {
    cleanData.push({id: k, name: 'name'+k, age: k*2, content: 'abc'});

    depthData.push({'data.id': k, 
                     'data.name': 'name'+k, 
                     'data.age': k*2, 
                     'data.content': 'abc'});
    dirtyData.push({'data.id##': k, 
                     'data.name': 'name'+k, 
                     'data.age': k*2, 
                     'data.content': 'abc'});

}

function testWith(tag, data, dur) {
    var t = Date.now(), n = 0, k = 0;

    // Default rows = 10
    var nnum = tag == 'full' ? 10 : NUM;

    for (;;) {
        if (++k*NUM > 500) { 
            k = 1; 
            if (Date.now() - t > dur) break;
        }
        test(data);
        ++n;
    }
    console.log(tag, (nnum * n / (Date.now() - t)).toFixed(0), 'rows/ms');
    console.log(tag, (1000 * n / (Date.now() - t)).toFixed(0), 'q/s');
}



testWith('full', data.raw, 3000);
testWith('clean', cleanData, 3000);
testWith('depth', depthData, 3000);
testWith('dirty', dirtyData, 3000);
