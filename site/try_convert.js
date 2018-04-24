var PythonShell = require('python-shell');

var options = {
	mode: 'text',
	pythonOptions: ['-u'],
	scriptPath: 'C:/Users/Aubhik/Desktop/JN/design-contest-research/programs/autofea-v0.5',
	args: ['C:/Users/Aubhik/Desktop/JN/design-contest-research/site/files/aubhik/R12.step', 'C:/Users/Aubhik/Desktop/JN/design-contest-research/site/files/aubhik/']
};

PythonShell.run('convert_to_stl.py',options, function (err,results) {
  if (err) throw err;
  console.log('results: %j',results);
});

