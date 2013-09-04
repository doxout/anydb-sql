var data = require('./grouper-data'),
    g = require('../../grouper');


function test() {
    g.process(data.raw);
}

var n = 30000, t = Date.now();
for (var k = 0; k < n; ++k) test();
console.log(1000*n / (Date.now() - t), 'q/s');
