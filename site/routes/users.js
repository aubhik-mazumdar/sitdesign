var config	  = require('./config');
var express	  = require('express');
var fileUpload	  = require('express-fileupload');
var fs		  = require('fs');
var LocalStrategy = require('passport-local').Strategy;
var logger        = require('../scripts/logging');
var net		  = require('net');
var nodemailer    = require('nodemailer');
var passport	  = require('passport');
var path	  = require('path');
var router	  = express.Router();
var User	  = require('../models/user');


router.use(fileUpload());

/*** Passport stuff ***/
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


let PORT = 8080;
let HOST = '127.0.0.1';

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


// function getDate(){
//     var currentdate = new Date();
//     var datetime = currentdate.getDate() + "/" +
// 	(currentdate.getMonth() + 1) + "/" +
// 	currentdate.getFullYear() + " @ " +
// 	currentdate.getHours() + ":" +
// 	currentdate.getMinutes() + ":" +
// 	currentdate.getSeconds();
//     return datetime;
// }


/** Logging **/
// function logger.userLog(action, info, name) {
//     let timeStamp = getDate();

//     console.log("action: ", action);
//     console.log("info: ", info);
//     console.log("name: ", name);

//     let filePath = path.join(__dirname, '../files', name, 'activity.log');
//     console.log("log filepath: ", filePath);

//     let errMsg = timeStamp + ' unable to log information; affected user: ' + name;

//     let data = '\n' + timeStamp + ' : ' + action + ' - ' + info;
//     fs.open(filePath, 'a', (err, fd) => {
// 	if (err) {
// 	    console.log(errMsg);
// 	}

// 	fs.appendFile(fd, data, (err) => {
// 	    if (err) {
// 		console.log(errMsg);
// 	    }
// 	    fs.close(fd, (err) => {
// 		if (err) {
// 		    console.log(errMsg);
// 		}
// 	    });
// 	});
//     });
// }

                                /* recordErr: log error information to a errors.log file */
function recordErr(msg, err) {
        let timeStamp = logger.getDate();
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
        let timeStamp = logger.getDate();
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
    logger.userLog('VISIT', 'UPLOAD PAGE', req.user.username);
    res.render('upload');
});

router.get('/contact', function (req, res) {
    logger.userLog('VISIT', 'CONTACT PAGE', req.user.username);
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
	    let datetime = logger.getDate();
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

router.get('/altupload', (req, res) => {
    logger.userLog('VISIT', 'UPLOAD PAGE', req.user.username);
    res.render('altupload');
});

router.post('/altupload', (req, res) => {
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
    console.log(req.files.inputFile);
    let fileUploaded = typeof req.files['inputFile'] !== "undefined" ? req.files['inputFile'].name : '';
    
    req.checkBody('inputFile', 'Please upload a valid STEP file').isSTEP(fileUploaded);
    req.checkBody('text', 'Please enter a description').notEmpty();
    let errors = req.validationErrors();

    // if (!req.files.inputFile || !req.body.text) {
    // 	req.flash('err_msg', 'Please fill everything in this form');
    // 	// res.redirect('/users/altupload');
    // 	return;
    // }

    let input = req.files.inputFile;
    let fileName = input.name;
    let userName = req.user.username;
    let fileDir = path.join(__dirname, '..', 'files', userName);
    let filePath = path.join(fileDir, fileName);
    console.log('filename: ', fileName);
    console.log('username: ', userName);
    console.log('filedir: ', fileDir);
    console.log('filepath: ', filePath);

    let action = 'UPLOAD ' + filePath;
    logger.userLog('ACTION', action, userName);

    const client = net.createConnection({port: PORT, host: HOST}, () => {
	console.log('connected to COMPUTE server');

	if (errors) {
	    console.log('Description has not been filled');
	    res.render('altupload', { errors });
	} else {
	    input.mv(filePath, (err) => {
		if (err) throw err; /* !!!!!!!!!!!!!!!!!! */

		let request = {command: 'UPLOAD'
			       , fileName
			       , filePath
			       , userName
			       , fileDir};
		console.log(JSON.stringify(request));
		client.write(JSON.stringify(request));
		req.flash('success_msg', 'File upload successful. Please wait a moment for it to reflect on your homepage.');
		res.redirect('/users/homepage');
	    });
	}

	// input.mv(filePath, (err) => {
	//     if (err) throw err; /* !!!!!!!!!!!!!!!!!!!!!!! */
	//     let request = {command: 'UPLOAD'
	// 		   , fileName: fileName
	// 		   , filePath: filePath
	// 		   , userName: userName
	// 		   , fileDir: fileDir};
	//     console.log(JSON.stringify(request));
	//     client.write(JSON.stringify(request));
	//     req.flash('success_msg', 'File upload successful. Please wait a moment for it to reflect on your homepage.');
	//     res.redirect('/users/homepage');
	// });
    });
    
    client.on('data', (data) => {
	let result = JSON.parse(data);
	console.log('GOT: ', result);
	if (result.result === 'SUCCESS') {
            /* push information to MongoDB database */
            User.findOne({ 'username': userName }, (err, user) => {
		let designObj = {
		    description: req.body.text,
		    original_name: fileName,
		    name: fileName.replace(/.stp|.step/i, ''),
		    original_path: path.join('/', userName, fileName), /* e.g. /john/design1.step */
		    file_dir: fileDir,
		    path: path.join('/', userName, fileName.replace(/.stp|.step/i,'.stl')),
		    type: req.body.type,
		    urls: req.body.urls,
		    properties: result.properties,
		    score: result.score
		}
		console.log(designObj);
                user.files.push(designObj);
                console.log("USER FILES:")
                console.log(user.files);
		
                user.save((err) => {
                    if (err) recordErr('DB_SAVE_ERR', err);
                });
		
	    });
	}
	client.end(); /* end connection */
    });

    client.on('close', () => {
	console.log('Disconnected from server');
	client.end(); /* REQUIRED? !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! */
    });
});

router.get('/homepage', (req, res) => {
    logger.userLog('VISIT', 'HOME PAGE', req.user.username);
    let designs = [];
    User.findOne({
	'username': req.user.username
    }, (err, user) => {
	for (let i = 0; i < user.files.length; i++) {
	    designs.push(user.files[i].path);
	}

	res.render('new-homepage', {
	    desg: designs
	});
    });
});

router.get('/old-homepage', function (req, res) {
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
    logger.userLog('VISIT', 'RECOMMENDATIONS PAGE', req.user.username);
    User.getUserByUsername(req.user.username, (err, user) => {

	const client = net.createConnection({port: PORT, host: HOST}, () => {
	    console.log('connected to COMPUTE server');

	    let request = {command: 'RECOMMEND'
			   , userName: user.username
			   , condition: user.condition}
	    
	    console.log(JSON.stringify(request)); // DEBUG
	    client.write(JSON.stringify(request));
	    // client.write('CLOSE');
	    // req.flash('success_msg', 'Generating recommendations');
	});

	client.on('data', (data) => {
	    let result = JSON.parse(data);
	    for (let i = 0; i < result.recommendations.length; i++) {
		let info = result.recommendations[i];
		logger.userLog('\tSHOW ', info, req.user.username);
	    }
	    res.render('recommendations', {
		org: result.recommendations /* org stands for original btw, and is
					     * used here since the layout for 'recommendations'
					     * was copied from the layout for 'homepage' */
	    });
	    client.end();
	});

	client.on('close', () => {
	    console.log('Disconnected from the server.');
	    /* Make sure to log all this information */
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

	let datetime = logger.getDate();
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

		logger.userLog('\nLOGIN','\n', req.user.username);
				
		res.redirect('/users/' + req.user.username);
	    });

router.get('/logout', function (req, res) {
    //L0 2/4/2018 @ 12:23:43
    // logger.userLog('LOGOUT', '\n', req.user.username);
    req.logout();
    req.flash('success_msg', 'You are now logged out');
    res.redirect('/users/login');
});

router.get('/userinfo', function(req, res) {
    logger.userLog('VISIT', 'PROFILE PAGE', req.user.username);
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

	logger.userLog('DOWNLOAD', filePath, req.user.username);
	
        res.download(filePath);
    });
});

router.get('/delete/:userId/:designName', (req, res) => {
    
    const client = net.createConnection({port: PORT, host: HOST}, () => {
	console.log('Connected to COMPUTE server');	
	var currUser = req.user.username;
	var designPath = '/' + req.params.userId + '/' + req.params.designName;
	var removed = null;
	console.log('Delete request: ', designPath);

	User.findOne({
	    'username': currUser,
	}, (err, user) => {
	    // let removed = null;
	    console.log("user files: ", user.files);

	    for (let i = 0; i < user.files.length; i++) {
		console.log('Checking : ', user.files[i].path)
		if (user.files[i].path == designPath) {
		    removed = user.files.splice(i, 1);
		}
	    }
	    
	    console.log('removed ', removed);
	    console.log(user.files);

	    var request = {command: 'DELETE'
			   , userName: user.username
			   , designName: removed[0].name
			   , designPath: removed[0].original_path
			   , designRenderPath: removed[0].path};
	    
	    console.log('Sending request: ')
	    console.log(request);

	    user.save((err) => {
		if (err) throw err;
	    });

	    logger.userLog('DELETE', request.designPath, req.user.username);

	    client.write(JSON.stringify(request));
	});
    });

    client.on('data', (data) => {
	res.redirect('/users/homepage');	
    });

    client.on('close', () => {
	console.log('Disconnected from the server.');
	/* Make sure to log all this information */
    });	

});

router.get('/old-delete/:userId/:designName', function (req, res) {
    var currUser = req.user.username;
    var tempOrg = [],
	tempRem = [];
    var path = '/' + req.params.userId + '/' + req.params.designName;
    console.log('Delete request!');
    console.log(path);

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

    let designName = temp2;
    if (designName.endsWith('.stl')) {
	designName.replace(/.stl/i, '');
    }
    
    logger.userLog('VISIT', 'DESIGN PAGE ' + designName, req.user.username);
    
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
	// let datetime = getDate();
	// if(req.user.username==req.params.userId){
	//     let data = '\nV0 ' + datetime +' '+ req.protocol + '://' + req.hostname + req.originalUrl;;
	//     let pth = path.join(__dirname, '../files', req.user.username, req.user.username + '_log.txt');
	//     log(data, pth);
	// }
	// else{
	//     let data = '\nV1 ' + datetime +' '+ req.protocol + '://' + req.hostname + req.originalUrl;;
	//     let pth = path.join(__dirname, '../files', req.user.username, req.user.username + '_log.txt');
	//     log(data, pth);
	// }
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
    logger.userLog('VISIT', 'CONTACT PAGE', req.user.username);
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

router.post('/:userId/:designName/time', (req, res) => {
    let designPath = path.join('/',req.params.userId,req.params.designName);
    let value = req.body;
    let info = 'raw-time ' + value.rawTime + ' interaction-time ' + value.interactionTime;

    logger.userLog('INTERACT', designPath + ' ' + info, req.user.username);
    
    console.log(value);    
    res.send('done');
});

router.get('/help', (req, res) => {
    res.render('help', {
	example: '/example.stl'
    });
});


module.exports = router;
