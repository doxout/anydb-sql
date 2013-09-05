var data = require('./grouper-data'),
    g = require('../../grouper');


function test(which) {
    g.process(which);
}


var cleanData = [];

var depthData = [];

var dirtyData = [];

for (var k = 0; k < 10; ++k) {
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
    for (;;) {
        if (++k > 100) { 
            k = 1; 
            if (Date.now() - t > dur) break;
        }
        test(data);
        ++n;
    }
    console.log(tag, (1000 * n / (Date.now() - t)).toFixed(0), 'q/s');
}



var n = 30000;
testWith('full', data.raw, 2000);
testWith('clean', cleanData, 2000);
testWith('depth', depthData, 2000);
testWith('dirty', dirtyData, 2000);
