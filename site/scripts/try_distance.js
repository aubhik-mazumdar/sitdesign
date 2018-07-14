const PythonShell = require('python-shell');

let options = {
    mode: 'text',
    pythonPath: '/usr/bin/python2',
    pythonOptions: ['-u'],
    scriptPath: '/home/rmn/sit/sitdesign/site/scripts/',
    args: ['/home/rmn/sit/res/parts/test2/run/C28.step']
};

let dp = {
    volume: undefined,
    avg_face_area: undefined,
    nfaces: undefined
};

PythonShell.run('distance.py', options, function (err, results) {
    if (err) throw err;
    console.log("results: %j", results);
    l = results.length;
    dp.volume = Number(results[l-3]);
    dp.avg_face_area = Number(results[l-2]);
    dp.nfaces = Number(results[l-1]);
});

console.log(dp);
