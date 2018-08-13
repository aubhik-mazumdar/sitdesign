var net = require('net');
var express = require('express');
var router = express.Router();
var User = require('../models/user');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var fileUpload = require('express-fileupload');
var path = require('path');
var fs = require('fs');
var spawn = require("child_process").spawn;
var PythonShell = require('python-shell');
var nodemailer = require('nodemailer');
var config = require('./config');
// var distances = require('./distances');

router.use(fileUpload());

// let client = new net.Socket();
let PORT = 8080;
let HOST = '127.0.0.1';

/* global distance matrix */
var DISTANCE_MATRIX = new Object();

/* global list of all designs */
var DESIGNS = new Array();

/* global number of designs to recommend */
var N_RECOMMS = 3;

/* updateDistanceMatrix: To be run everytime a new design is uploaded
   relies on the global variable DESIGNS. Updates global variable
   DISTANCE_MATRIX */
function updateDistanceMatrix() {
    let parameters = ['volume', 'avg_face_area', 'nfaces']; /* Read from a config file later on */

    /* Iterate through the list of all DESIGNS */
    for (let i of DESIGNS) {
	let ip = stripPath(i.design.path);
	DISTANCE_MATRIX[ip] = {};
	for (let j of DESIGNS) {
	    let jp = stripPath(j.design.path);
	    if (ip == jp) /* Distance between same designs is 0 */
		continue;
	    let dist = calculateDistance(i.design, j.design);
	    DISTANCE_MATRIX[ip][jp] = dist;
	}
    }
    return;
}

/* startupCompute: Perform computations that are currently necessary
   at startup. This includes computing the distance matrix and updating
   the list of all designs.
   ! This is a temporary function and should be removed at a later stage */
function startupCompute() {
    User.find({}, (err, users) => {
	console.log(users);
	// DESIGNS = new Array();
	for (let user of users) {
	    console.log(user);
	    for (let design of user.files) {
		DESIGNS.push({'user': user.username, 'design': design});		
	    }
	}
	updateDistanceMatrix();
	console.log("DISTANCE MATRIX");
	console.log(DISTANCE_MATRIX);
        globalLog('STARTUP', 'computed distance matrix');
    });
}

// startupCompute(); /* !!!!!!!!!!!!!!!!!!! */

/* Returns L2 norm. Each design is represented by the tuple
   (log(volume), log(avg_face_area), nfaces) */
function calculateDistance(d1, d2) {
    let v = (d1.volume - d2.volume)**2;
    let f = (d1.nfaces - d2.nfaces)**2;
    let a = (d1.avg_face_area - d2.avg_face_area)**2;
    return Math.sqrt(v + f + a);
}

/* recommend :: UserInfo -> [Designs]
   relies on global variable DISTANCE_MATRIX and N_RECOMMS */
function recommend(user) {
    console.log("DISTANCE MATRIX:");
    console.log(DISTANCE_MATRIX);
    let n_submits = user.files.length;

    if (n_submits == 0) {
	console.log("RECOMMEDING");
	let r = DESIGNS.slice().sort(() => .5 - Math.random()).slice(0, N_RECOMMS);
	console.log(r);
	return r.map((e) => e.design.path);
    }
    
    let prev_submit = user.files[n_submits-1]; /* prev_submit :: Design */
    let prev = stripPath(prev_submit.path);

    console.log("RECOMMENDING FOR USER: " + user.username);
    console.log("PREVIOUS DESIGN: " + prev);
    console.log("DISTANCES :-");
    console.log(DISTANCE_MATRIX[prev]);

    let dists = DISTANCE_MATRIX[prev];
    /* Sort distances and use user.condition to return appropriate results */
    let tmp = new Array();
    for (let o in dists)
	tmp.push([o, dists[o]]);

    if (user.condition == 'nearest')
	tmp.sort((a,b) => a[1] - b[1]); /* sorts in ascending order */
    else
	tmp.sort((a,b) => b[1] - a[1]);

    let diffdsgn = (e) => user.files.map((d) => d.path).indexOf(e) == -1
    console.log("RECOMMENDATIONS: ");
    console.log(tmp.map((e) => e[0] + '.stl').filter(diffdsgn).slice(0, N_RECOMMS));
    return tmp.map((e) => e[0] + '.stl').filter(diffdsgn).slice(0, N_RECOMMS);
}

/* Might have to change this function based on path naming conventions
   As of now, we can expect this to remove '.stl' from a path */
function stripPath(p) {
    return p.substring(0, p.length-4);
}

/* Work with conditions
 * For now we place each user alternatively in two conditions -
 * 1) Nearest
 * 2) Farthest
 * Those in the Nearest condition get shown similar designs and 
 * those in the Farthest condition get shown dissimilar designs
 */
function* conditionGenerator(conditions) {
    let idx = 0;
    while (true) {
	yield conditions[idx];
	idx = (idx + 1) % conditions.length;
    }
}

let getCondition = conditionGenerator(['nearest', 'farthest']);


/** Logging **/
                                /* userLog: handle logging at the user level */
function userLog(action, info, name) {
        let timeStamp = getDate();
        // let name = user.username;
        console.log("action: ", action);
        console.log("info: ", info);
        console.log("name: ", name);
        let filePath = path.join(__dirname, '../files', name, 'activity.log'); 
        console.log("log filepath: ", filePath);
        let data = '\n' + timeStamp + ' : ' + action + ' - ' + info;
        fs.open(filePath, 'a', (err, fd) => {
                if (err) recordErr('LOG_ERROR ' + name, err);
                fs.appendFile(fd, data, (err) => {
                        if (err) recordErr('LOG_ERROR ' + name, err);
                        fs.close(fd, (err) => {
                                if (err) recordErr('LOG_ERROR ' + name, err);
                        });
                });
        });
        return;
}

                                /* recordErr: log error information to a errors.log file */
function recordErr(msg, err) {
        let timeStamp = getDate();
        let filePath = path.join(__dirname, 'errors.log');
        let data = msg + '\n\t' + err + '\n'
        fs.open(filePath, 'a', (err, fd) => {
                if (err) return;                        /* !!! */
                fs.appendFile(fd, data, (err) => {
                        if (err) return;                /* !!! */
                        fs.close(fd, (err) => {
                                if (err) return;        /* !!! */
                        });
                });
        });
        return;
}
                                /* globalLog: handle logging at the global level */
function globalLog(action, info) {
        let timeStamp = getDate();
        let filePath = path.join(__dirname, '../', 'global.log');
        let data = timeStamp + ' : ' + action + ' - ' + info + '\n';
        fs.open(filePath, 'a', (err, fd) => {
                if (err) recordErr('GLOBAL_LOG_ERROR ', err);
                fs.appendFile(fd, data, (err) => {
                        if (err) recordErr('GLOBAL_LOG_ERROR ', err);
                        fs.close(fd, (err) => {
                                if (err) recordErr('GLOBAL_LOG_ERROR ', err);
                        });
                });
        });
        return;
}

router.get('/upload', function (req, res) {
    res.render('upload');
});

router.get('/contact', function (req, res) {
    res.render('contact');
})

router.get('/register', function (req, res) {
    res.render('register');
});

router.get('/login', function (req, res) {
    res.render('login');
});

router.post('/register', function (req, res) {
    var name = req.body.name;
    var email = req.body.email;
    var username = req.body.username;
    var password = req.body.password;
    var password2 = req.body.password2;

    //VALIDATE
    req.checkBody('name', 'You have not entered a name').notEmpty();
    req.checkBody('email', 'Please enter an email address').notEmpty();
    req.checkBody('email', 'Please enter a valid email address').isEmail();
    req.checkBody('username', 'Please enter a username').notEmpty();
    req.checkBody('password', 'Please enter a password').notEmpty();
    req.checkBody('password2', 'Passwords do not match').equals(req.body.password);
    var errors = req.validationErrors();

    if (errors) {
	res.render('register', {
	    errors: errors
	});
    } else {
	var newUser = new User({
	    name: name,
	    email: email,
	    username: username,
	    password: password,
	    condition: getCondition.next().value
	});
	User.createUser(newUser, function (err, user) {
	    if (err) throw err;
	    console.log(user);
	    //C0 31/3/2018 @ 12:13:43
	    let datetime = getDate();
	    let data = 'C0 ' + datetime;
	    // let pth = path.join(__dirname, '../files', name, name + '_log.txt');
	    // let dir = path.join(__dirname, '../files', name);
	    let pth = path.join(__dirname, '..', 'files', username, name + '_log.txt');
	    let dir = path.join(__dirname, '..', 'files', username);
	    fs.mkdirSync(dir);
	    fs.writeFileSync(pth, data,
			     function (err) {
				 if (err) {
				     return console.log(err);
				 }
				 console.log("The log file was created!");
			     });
	});
	req.flash('success_msg', 'You are registered, please login');
	res.redirect('/users/login');
    }
});

function log(data, pathToFile) {
    fs.open(pathToFile, 'a', (err, fd) => {
	if (err) // throw err;
	    return;
	fs.appendFile(fd, data, 'utf8', (err) => {
	    fs.close(fd, (err) => {
		if (err) throw err;
	    });
	    if (err) throw err;
	});
    });
}

passport.use(new LocalStrategy(
    function (username, password, done) {
	User.getUserByUsername(username, function (err, user) {
	    if (err) throw err;
	    if (!user) {
		return done(null, false, {
		    message: 'Unknown User'
		});
	    }

	    User.comparePassword(password, user.password, function (err, isMatch) {
		if (err) throw err;
		if (isMatch) {
		    return done(null, user);
		} else {
		    return done(null, false, {
			message: 'Invalid password'
		    });
		}
	    });
	});
    }));

passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    User.getUserById(id, function (err, user) {
	done(err, user);
    });
});

/* TODO Rewrite Function */
router.post('/upload', function (req, res) {
    if (!req.files.sampleFile) {
	req.flash('error_msg', 'Please choose a file');
	res.redirect('/users/upload');
	throw "no files were uploaded";
	return;
    }
    // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
    let sampleFile = req.files.sampleFile;
    let xmas = sampleFile.name;
    let info = 'not analyzed yet';
    let t = req.body.text;
    let option = req.body.type;
    let urls = req.body.urls;
    let flag = 0;
    if (option == 'Remixed')
	urls = urls.split(';');
    // Use the mv() method to place the file somewhere on your server
    var dir = path.join('./files/', req.user.username); //files/aubhik/
    if (!fs.existsSync(dir)) {
	fs.mkdirSync(dir);
    }
    if (!sampleFile) {
	req.flash('error_msg', 'Please choose a file');
	res.redirect('/users/upload');
	throw "no files were uploaded";
    }

    sampleFile.mv(dir + '/' + req.files.sampleFile.name,
		  function (err) {
		      if (err)
			  throw err;
		      fs.writeFileSync(dir + '/' + req.files.sampleFile.name + '.txt', t,
				       function (err) {
					   if (err) {
					       return console.log(err);
					   }
					   console.log("The file was saved!");
				       });
		  });

    console.log(req.user);
    
    //If file is a STEP file
    if (sampleFile.name.match(/.step/i)) {
	//convert to stl
	var convert_options = {
	    mode: 'text',
	    pythonPath: '/usr/bin/python2',
	    pythonOptions: ['-u'],
	    scriptPath: config.scriptsPath,
	    args: [config.filesPath + req.user.username + '/' + sampleFile.name, dir + '/']
	};

	PythonShell.run('convert_to_stl.py', convert_options, function (err, results) {
	    if (err) throw err;
	    console.log('convert_to_stl.py -- results: %j', results);
	});

	/* The script `distance.py` prints out the "coordinates" of the design in a
	   space where the basis is given by {volume, avg face area, number of faces} */
	var distance_options = {
	    mode: 'text',
	    pythonPath: '/usr/bin/python2',
	    pythonOptions: ['-u'],
	    scriptPath: config.scriptsPath,
	    args: [config.filesPath + req.user.username + '/' + sampleFile.name]
	};

	xmas = sampleFile.name.replace(/.step/i, '.stl');
	let d = '/' + req.user.username + '/' + xmas;

	PythonShell.run('distance.py', distance_options, function(err, results) {
	    if (err) throw err;

	    console.log('distance.py -- results: %j', results);
	    l = results.length;
	    volume = Number(results[l-3]);
	    avg_face_area = Number(results[l-2]);
	    nfaces = Number(results[l-1]);

	    fobj = {
		'desription': t,
                'original_path': '/' + req.user.username + '/' + sampleFile.name,
		'path': d,
		'type': option,
		'urls': urls,
		'score': info,
		'volume': volume,
		'avg_face_area': avg_face_area,
		'nfaces': nfaces
	    };
            console.log(fobj);

	    DESIGNS.push({'user': req.user.username, 'design': fobj});

	    // console.log("DESIGNS :");
	    // console.log(DESIGNS);

	    updateDistanceMatrix();
	    // console.log("DISTANCE MATRIX");
	    // console.log(DISTANCE_MATRIX);

	    User.findOne({ 'username': req.user.username }, function(err, user) {
		if (option != 'Remixed') {
		    delete fobj.urls;
		}
		user.files.push(fobj);
		user.save((err) => {
		    if (err) throw err; 
		});
	    });
	});

	flag = 1;
	//analyze("C:/Users/Aubhik/Desktop/JN/design-contest-research/site/files/" + req.user.username + '/' + sampleFile.name, "./", req.user.username);
	analyze(config.filesPath + req.user.username + '/' + sampleFile.name, "./", req.user.username);
    }

    let d = '/' + req.user.username + '/' + xmas;

    //store file in MongoDB database
    if (!flag) {
	User.findOne({
	    'username': req.user.username
	}, function (err, user) {
	    info = 'cannot analyze a STL file. Please upload a STEP file'
	    if (option == 'Remixed') {
		user.files.push({
		    'description': t,
                    'original_path': '/' + req.user.username + '/' + sampleFile.name,
		    'path': d,
		    'type': option,
		    'urls': urls,
		    'score': info,
		    'coordinates': design_props,
		    'volume': design_props.volume, /* duplication of information, I know */
		    'avg_face_area': design_props.avg_face_area,
		    'nfaces': design_props.nfaces		    
		});
	    } else {
		user.files.push({
		    'description': t,
                    'original_path': '/' + req.user.username + '/' + sampleFile.name,
		    'path': d,
		    'type': option,
		    'score': info,
		    'coordinates': design_props,
		    'volume': design_props.volume, /* duplication of information, I know */
		    'avg_face_area': design_props.avg_face_area,
		    'nfaces': design_props.nfaces		    
		});
	    }
	    user.save(function (err) {
		if (err) throw err;
	    });
	});
    }

    /* let datetime = getDate();
    let data = '\nU0 ' + datetime + ' ' + sampleFile.name + option + urls;
    let pth = path.join(__dirname, '../files', req.user.username, req.user.username + '_log.txt');
    log(data, pth); */
    //userLog('FILE_UPLOAD', sampleFile.name + ' ' + option + ' ' + urls, req.user);
    req.flash('success_msg', "File uploaded successfully!");
    console.log("File uploaded successfully");
    res.render('upload', {
	// filename: sampleFile.name,
	filename: xmas,
	progress: 'true'
    });
});

                                /* return true if file is not a valid STEP file */
function valid(input) {
        /* TODO perform additional checks on the file */
        return input.name.match(/.step|.stp/i);
}

router.get('/altupload', (req, res) => {
    res.render('altupload');
});

router.post('/altupload', (req, res) => {
    console.log(req.files.inputFile);

    if (!req.files.inputFile) {
	req.flash('err_msg', 'Please choose a file');
	res.redirect('/users/altupload');
	return;
    }

    let input = req.files.inputFile;
    let fileName = input.name;
    let userName = req.user.username;
    let fileDir = path.join(__dirname, '..', 'files', userName);
    let filePath = path.join(fileDir, fileName);
    console.log('filename: ', fileName);
    console.log('username: ', userName);
    console.log('filedir: ', fileDir);
    console.log('filepath: ', filePath);

    /* Steps:
     * - Connect to "compute" server
     * - Move file user uploaded to appropriate directory
     * - Send "process file" request to "compute" server
     * - On SUCCESS,
     *     + Add design to users files
     *     + Redirect user to homepage
     * - On FAILURE,
     *     + Alert user
     *     + TODO
     */

    const client = net.createConnection({port: PORT, host: HOST}, () => {
	console.log('connected to COMPUTE server');
	input.mv(filePath, (err) => {
	    if (err) throw err; /* !!!!!!!!!!!!!!!!!!!!!!! */
	    let request = {command: 'PROCESS'
			   , fileName: fileName
			   , filePath: filePath
			   , userName: userName
			   , fileDir: fileDir};
	    console.log(JSON.stringify(request));
	    client.write(JSON.stringify(request));
	    req.flash('success_msg', 'File upload successful. Please wait a moment for it to reflect on your homepage.');
	    res.redirect('/users/homepage');
	});
    });
    
    // client.connect(PORT, HOST, () => {
    // 	console.log('Connected to COMPUTE server');	
    // 	input.mv(filePath, (err) => {
    // 	    if (err) throw err; /* !!!!!!!!!!!!!!!!!!!!!!!!! */
    // 	    let request = {command: 'PROCESS'
    // 			   , fileName: fileName
    // 			   , filePath: filePath
    // 			   , userName: userName
    // 			   , fileDir: fileDir};
    // 	    console.log(JSON.stringify(request));
    // 	    client.write(JSON.stringify(request)); /* send request to `compute` */
    // 	    req.flash('success_msg', 'File uploaded successfully. Please wait a moment for it to reflect on your homepage.');	    
    // 	    res.redirect('/users/homepage');       /* redirect here itself */
    // 	});
    // });

    client.on('data', (data) => {
	let result = JSON.parse(data);
	console.log('GOT: ', result);
	if (result.result === 'SUCCESS') {
            /* push information to MongoDB database */
            User.findOne({ 'username': userName }, (err, user) => {
		let designObj = {
		    description: req.body.text,
		    id: result.design_id, /* provided by "compute" */
		    name: fileName.replace(/.stp|.step/i, ''),
		    original_path: path.join('/', userName, fileName), /* e.g. /john/design1.step */
		    file_dir: fileDir,
		    path: path.join('/', userName, fileName.replace(/.stp|.step/i,'.stl')),
		    type: req.body.type,
		    urls: req.body.urls,
		    properties: result.properties
		}
		console.log(designObj);
                user.files.push(designObj);
                console.log("USER FILES:")
                console.log(user.files);
                user.save((err) => {
                    if (err) recordErr('DB_SAVE_ERR', err);
                });
	    });
	    // res.redirect('/users/homepage');
	}
	// client.destroy(); /* end connection -- destroy client */
	client.end();
    });

    client.on('close', () => {
	console.log('Disconnected from server');
    });
});

router.get('/newupload', (req, res) => {
        res.render('newupload');
});

router.post('/newupload', (req, res) => {
        console.log(req.files.inputFile);
                                                /* check whether a file was chosen */
        if (!req.files.inputFile) {
                req.flash('err_msg', 'Please choose a file');
                res.redirect('/users/newupload');
                return;
        }

        let input = req.files.inputFile;
        let userName = req.user.username;
        console.log("input: ", input);
        console.log("userName: ", userName);
                                                /* check whether the file is valid */
        if (!valid(input)) {
                req.flash('err_msg', 'Please choose a STEP file');
                res.redirect('/users/newupload');
                return;
        }

        let designName = input.name.replace(/.step|.stp/i,'');

                                                /* transfer the file to location on the server */
        let fileDir = path.join(__dirname, '../files', req.user.username);
        let filePath = path.join(fileDir, input.name);
        input.mv(filePath, (err) => {
                if (err) recordErr('FILE_MV', err);
        });

        console.log("filedir ", fileDir);
        console.log("filepath ", filePath);

                                                /* convert file to STL - required for rendering */
        let convert_options = {
                mode: 'text',
                pythonPath: '/usr/bin/python2',
                pythonOptions: ['-u'],
                scriptPath: config.scriptsPath,
                args: [filePath, fileDir + '/']
        };

        PythonShell.run('convert_to_stl.py', convert_options, (err, results) => {
                if (err) recordErr('FILE_CONVERT', err);
                console.log('convert_to_stl.py -- results: %j', results);
                /* at this point we should have an STL file in the server
                   ready to render */
        });
        
                                                /* compute "coordinates" of a design using the
                                                   python script `distance.py` */
        let distance_options = {
                mode: 'text',
                pythonPath: '/usr/bin/python2',
                pythonOptions: ['-u'],
                scriptPath: config.scriptsPath,
                args: [filePath]
        };

        PythonShell.run('distance.py', distance_options, (err, results) => {
                if (err) recordErr('DISTANCE_COMPUTE', err);
                console.log('distance.py -- results: %j', results);
                                                /* There should be a better way to extract the
                                                   information */
                let reslen = results.length;
                let volume = Number(results[reslen-3]);
                let avg_face_area = Number(results[reslen-2]);
                let nfaces = Number(results[reslen-1]);

                designObj = {
                        'description': req.body.text,
                        'name': designName,
                        'original_path': '/' + req.user.username + '/' + input.name,
                        'path': '/' + req.user.username + '/' + designName + '.stl',
                        'type': req.body.type,
                        'urls': req.body.urls,
                        'volume': volume,
                        'avg_face_area': avg_face_area,
                        'nfaces': nfaces
                };
                console.log(designObj);

                                                /* update global DESIGNS array and update distance
                                                   matrix */
                DESIGNS.push({'user': req.user.username, 'design': designObj});
                updateDistanceMatrix();

                                                /* push information to MongoDB database */
                User.findOne({ 'username': req.user.username }, (err, user) => {
                        user.files.push(designObj);
                        console.log("USER FILES:")
                        console.log(user.files);
                        user.save((err) => {
                                if (err) recordErr('DB_SAVE_ERR', err);
                        });
                });
        });

        //console.log("calling userLog with : ", userName);
        //userLog('FILE_UPLOAD', input.name + ' ' + req.body.type + ' ' + req.body.urls, userName);
        req.flash('success_msg', 'File uploaded successfully. Please wait a moment for it to reflect on your homepage.');
        res.redirect('/users/homepage');
});

function getDate(){
    var currentdate = new Date();
    var datetime = currentdate.getDate() + "/" +
	(currentdate.getMonth() + 1) + "/" +
	currentdate.getFullYear() + " @ " +
	currentdate.getHours() + ":" +
	currentdate.getMinutes() + ":" +
	currentdate.getSeconds();
    return datetime;
}

function analyze(infile, outdir, username) {
    console.log('Running analysis');
    autofea_run(infile, outdir, function (e) {
	e = JSON.stringify(e);
	console.log('done', e);
	User.findOne({
	    'username': username
	}, function (err, user) {
	    let temp = user.files.pop();
	    temp.score = e;
	    user.files.push(temp);
	    user.save(function (err) {
		if (err) throw err;
	    });
	});
    }, (e) => console.log(''));
    console.log('analysis complete');
}


function autofea_run(infile, savedir, res_callback, end_callback) {
    console.log('autofeaRun started');
    let autofea = spawn('python', ['C:/Users/Aubhik/Desktop/JN/design-contest-research/programs/autofea-v0.5/autofea05.py', infile, '-s', savedir]);
    result_str = '';
    let flag = 0;
    autofea.stdout.on('data', (data) => {
	let resp = data.toString(),
	    lines = resp.split(/(\r?\n)/g);
	result_str += resp;
	if (flag == 0) {
	    // we only want the last line
	    fea_resu = JSON.parse(lines[lines.length - 3]);
	    res_callback(fea_resu);
	    flag = 1;
	    return;
	} else
	    return;
    });
    autofea.on('close', (close) => {
	return end_callback(result_str);
    });
};

router.get('/homepage', function (req, res) {
    var tempOrg = [],
	tempRem = [];
    User.findOne({
	'username': req.user.username
    }, function (err, user) {
	for (let i = 0; i < user.files.length; i++) {
	    if (user.files[i].type == 'Remixed')
		tempRem.push(user.files[i].path);
	    else
		tempOrg.push(user.files[i].path);
	}
	res.render('homepage', {
	    org: tempOrg,
	    rem: tempRem
	});
    });
});

router.get('/recommendations', (req, res) => {
    User.getUserByUsername(req.user.username, (err, user) => {
	let recomms = recommend(user);

	/* Note: prev_design is also computed in `recommend` */
	let n_submits = user.files.length;
	let prev_design = undefined;
	let prev_name = undefined;
	if (n_submits > 0) {
	    prev_design = user.files[n_submits-1];
	    prev_name = prev_design.path;
	}

	/* Logging
	   TODO: Abstract away to a function */

	// let datetime = getDate();
	// let number_of_files = recomms.length;
	// let data = '\nD' + number_of_files + ' ' + datetime + ' O:' + original.toString() + ' R:' + remixed.toString();
	// let pth = path.join(__dirname, '../files', req.user.username, req.user.username + '_log.txt');
	// log(data,pth);

	res.render('recommendations', {
	    org: recomms,
	    usr: prev_design,
	    prevName: prev_name
	});
    });
});

router.get('/explore', function (req, res) {
    var temp = [];
    let remixed = [];
    let original = [];
    User.find({}, function (err, user) {
	for (let obj of user) {
	    for (let j = 0; j < obj.files.length; j++) {
		if (obj.files[j].type == "Remixed")
		    remixed.push(obj.files[j].path);
		else
		    original.push(obj.files[j].path);
	    }
	}

	let datetime = getDate();
	let number_of_files = remixed.length + original.length;
	let data = '\nD' + number_of_files + ' ' + datetime + ' O:' + original.toString() + ' R:' + remixed.toString();
	let pth = path.join(__dirname, '../files', req.user.username, req.user.username + '_log.txt');
	log(data,pth);

	console.log("ORIGINAL");
	console.log(original);
	
	res.render('explore', {
	    rem: remixed,
	    org: original
	});
    });
});

router.post('/login',
	    passport.authenticate('local', {
		successRedirect: '/',
		failureRedirect: '/users/login',
		failureFlash: true
	    }),
	    function (req, res) {
		// If this function gets called, authentication was successful.
		// `req.user` contains the authenticated user.
		//L1 2/4/2018 @ 12:23:43
		let datetime = getDate();
		let data = '\nL1 ' + datetime;
		let pth = path.join(__dirname, '../files', user.name, user.name + '_log.txt');
		log(data, pth);
		res.redirect('/users/' + req.user.username);
	    });

router.get('/logout', function (req, res) {
    //L0 2/4/2018 @ 12:23:43
    let datetime = getDate();
    let data = '\nL0 ' + datetime;
    let pth = path.join(__dirname, '../files', req.user.username, req.user.username + '_log.txt');
    log(data, pth);
    req.logout();
    req.flash('success_msg', 'You are now logged out');
    res.redirect('/users/login');
});

router.get('/userinfo', function(req, res) {
    let user = req.user;
    res.render('userinfo', {
	uname: user.username,
	email: user.email,
	name: user.name,
	condition: user.condition,
	nfiles: user.files.length
    });
});

router.get('/download/:userId/:designName', (req, res) => {
        let currUser = req.user.username;
        let reqFilePath = '/' + req.params.userId + '/' + req.params.designName;
        console.log(reqFilePath);
        let filePath = undefined;
        User.findOne({ 'username': req.params.userId }, (err, user) => {
                if (err) recordErr('DOWNLOAD_ERROR', err);
                for (let i = 0; i < user.files.length; i++) {
                        if (user.files[i].path == reqFilePath) {
                                filePath = user.files[i]['original_path'];
                        }
                }
                if (filePath !== undefined)
                        filePath = path.join(__dirname, '../files', filePath);
                console.log("FILEPATH FOR DOWNLOAD");
                console.log(path.join(filePath));
                res.download(filePath);
        });
});

router.get('/delete/:userId/:designName', function (req, res) {
    var currUser = req.user.username;
    var tempOrg = [],
	tempRem = [];
    var path = '/' + req.params.userId + '/' + req.params.designName;
    User.findOne({
	'username': currUser
    }, function (err, user) {
	for (let i = 0; i < user.files.length; i++) {
	    if (user.files[i].path == path) {
		user.files.splice(i, 1);
		break;
	    }
	}
	for (let i = 0; i < user.files.length; i++) {
	    if (user.files[i].type == 'Remixed')
		tempRem.push(user.files[i].path);
	    else
		tempOrg.push(user.files[i].path);
	}
	console.log(tempOrg, tempRem);
	user.save(function (err) {
	    if (err) throw err;
	});
	res.render('homepage', {
	    org: tempOrg,
	    rem: tempRem
	});
    });
});

router.get('/design/:userId/:designName', function (req, res) {
    var temp = '-' + req.params.userId + '-' + req.params.designName;
    var temp2 = '/' + req.params.userId + '/' + req.params.designName;
    var dsp;
    var urls;
    var s;
    var volume;
    var avg_face_area;
    var nfaces;
    User.findOne({
	'username': req.params.userId
    }, function (err, user) {
	for (let i = 0; i < user.files.length; i++) {
	    if (user.files[i].path == temp2) {
		dsp = user.files[i].description;
		if (user.files[i].score)
		    s = user.files[i].score;
		else
		    s = 'no score currently';
		if (user.files[i].type == 'Remixed')
		    urls = user.files[i].urls;

		volume = user.files[i].volume;
		avg_face_area = user.files[i].avg_face_area;
		nfaces = user.files[i].nfaces;

		console.log("got the following parameters for " + temp2);
		console.log("Volume: " + volume);
		console.log("Avg Face Area: " + avg_face_area);
		console.log("Num Faces: " + nfaces);

		console.log("user.files[i]:")
		console.log(user.files[i])
	    }
	}
	if (!dsp)
	    dsp = 'no description';
	//V1 2/4/2018 @ 12:23:43
	let datetime = getDate();
	if(req.user.username==req.params.userId){
	    let data = '\nV0 ' + datetime +' '+ req.protocol + '://' + req.hostname + req.originalUrl;;
	    let pth = path.join(__dirname, '../files', req.user.username, req.user.username + '_log.txt');
	    log(data, pth);
	}
	else{
	    let data = '\nV1 ' + datetime +' '+ req.protocol + '://' + req.hostname + req.originalUrl;;
	    let pth = path.join(__dirname, '../files', req.user.username, req.user.username + '_log.txt');
	    log(data, pth);
	}
	res.render('design', {
	    current: req.user.username,
	    title: req.params.designName,
	    fileName: temp2,
	    uname: req.params.userId,
	    dname: req.params.designName,
	    desp: dsp,
	    url: req.hostname + '/users' + req.path,
	    score: s,
	    volume: volume,
	    nfaces: nfaces,
	    avg_face_area: avg_face_area,
	    links: urls
	});
    });
});

router.get('/contact',function(req,res){
    res.render('contact');
});

router.post('/contact',function(req,res){
    let email = req.body.email;
    let data = req.body.text;
    var transporter = nodemailer.createTransport({
	service: 'gmail',
	auth: {
	    user: 'sitdesigncomp@gmail.com',
	    pass: 'Stevens@123'
	}
    });

    var mailOptions = {
	from: 'sitdesigncomp@gmail.com',
	to: 'sitdesigncomp@gmail.com',
	subject: 'SITDESIGN complaint',
	text: email + '\n'+ data
    };

    transporter.sendMail(mailOptions, function(error, info){
	if (error) {
	    console.log(error);
	} else {
	    console.log('Email sent: ' + info.response);
	    req.flash('success_msg', 'Your response has been recorded. Thank you!');
	    res.redirect('/users/contact');
	}
    }); 
});

module.exports = router;
