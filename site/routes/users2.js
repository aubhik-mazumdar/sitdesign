const express       = require('express');
const fileUpload    = require('express-fileupload');
const fs            = require('fs');
const LocalStrategy = require('passport-local').Strategy;
const net           = require('net');
const nodemailer    = require('nodemailer');
const passport      = require('passport');
const path          = require('path');

const User          = require('../models/user');

const router        = express.Router();
router.use(fileUpload());

/* Messages to User */
const UPLOAD_MSG = 'File upload processing. Please wait a moment while we render your design.'
const REGIST_MSG = 'You are registered. Please login to continue.'

/* Passport */
passport.user(new LocalStrategy(
    (username, password, done) => {
	User.getUserByUsername(username, (err, user) => {
	    if (err) throw err;                             /* LOG */
	    if (!user) {
		return done(null, false, {
		    message: 'Unknown user'
		});
	    }

	    User.comparePassword(password, user.password, (err, isMatch) => {
		if (err) throw err;                         /* LOG */
		if (isMatch) {
		    return done(null, user);
		} else {
		    return done(null, false, {
			message: 'Incorrect password'
		    });
		}
	    });
	});
    }
));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.getUserById(id, (err, user) => {
	done(err, user);
    });
});


/*
 * Helper Functions
 */

let getFilePaths = (userName, designName) => {
    let fileDir = path.join(__dirname, '..', 'files', userName);
    let filePath = path.join(fileDir, designName);
    return {fileDir, filePath};
};


/*
 * Communication settings with `compute` server
 */

const PORT = 8080;
const HOST = '127.0.0.1';


/* 
 * Registration 
 */

router.get('/register', (req, res) => {
    res.render('register');
});

router.post('/register', (req, res) => {

    req.checkBody('name', 'Please enter a name').notEmpty();
    req.checkBody('email', 'Please enter an email address').notEmpty();
    req.checkBody('email', 'Please enter a valid email address').isEmail();
    req.checkBody('username', 'Please enter a username').notEmpty();
    req.checkBody('password', 'Please enter a password').notEmpty();
    req.checkBody('password2', 'Passwords do not match').equals(req.body.password);

    let errors = req.validationErrors();

    if (errors) {
	res.render('register', { errors });
    } else {

	let registerUser = new User({
	    name      : req.body.name,
	    email     : req.body.email,
	    username  : req.body.username,
	    password  : req.body.password,
	    condition : getCondition.next().value
	});

	User.createUser(registerUser, (err, user) => {

	    /* Handle the err if user already exists */
	    if (err) throw err;                             /* LOG */

	    let userDir = path.join(__dirname, '..', 'files', user.username);
	    fs.mkdirSync(userDir);
	});

	req.flash('success_msg', REGIST_MSG);
	res.redirect('/users/login');
    }
});


/* 
 * Upload 
 */

router.get('/upload', (req, res) => {
    res.render('upload');
});

router.post('/upload', (req, res) => {
    if (!req.files.inputFile) {
	req.flash('err_msg', 'Please choose a file');
	res.redirect('/users/upload');
    }

    if (!req.body.text) {
	req.flast('err_msg', 'Please enter a description');
	res.redirect('/users/upload');
    }

    let input    = req.files.inputFile;
    let fileName = input.name;
    let userName = req.user.username;
    let fileDir  = path.join(__dirname, '..', 'files', userName);
    let filePath = path.join(fileDir, fileName);


    const client = net.createConnection({port: PORT, host: HOST}, () => {

	input.mv(filePath, (err) => {
	    if (err) throw err;                             /* LOG */

	    let request = {command : 'UPLOAD'
			   , fileName
			   , filePath
			   , userName
			   , fileDir};
	    
	    client.write(JSON.stringify(request));

	    req.flash('success_msg', UPLOAD_MSG);
	    res.redirect('/users/homepage');
	});
    });

    client.on('data', (data) => {
	let result = JSON.parse(data);

	if (result.result == 'SUCCESS') {
	    User.findOne({'username': userName}, (err, user) => {

		let stlFile = fileName.replace(/.stp|.step/i,'.stl');
		let designPath = path.join('/', userName, stlFile);

		let designObj = {
		    description   : req.body.text,
		    name          : fileName.replace(/.stp|.step/i, ''),
		    original_path : path.join('/', userName, fileName),
		    file_dir      : fileDir,
		    path          : stlFile,
		    type          : req.body.type,
		    urls          : req.body.urls,
		    properties    : result.properties
		};

		user.files.push(designObj);

		user.save((err) => {
		    if (err) throw err;;                    /* LOG */
		});
		
	    });
	}
	client.end();
    });

    client.on('close', () => {
	console.log('Disconnected from COMPUTE');
    });
});


/* 
 * View Design 
 * This part needs to be worked on a bit more 
 */

router.get('/design/:userId/:designName', (req, res) => {

    let filePath = path.join('/', req.params.userId, req.params.designName)

    User.findOne({
	'username': req.paras.userId
    }, (err, user) => {

	let design = user.files.find((e) => e.path == filePath);
	let extra  = {current    : req.user.username
		      , title    : req.params.designName
		      , fileName : filePath
		      , uname    : req.params.userId
		      , dname    : req.params.designName}

	res.render('design', Object.assign({}, design, ));
    });
});


/* 
 * Design Download 
 */

router.get('/download/:userId/:designName', (req, res) => {
    let currUser    = req.user.username;
    let reqFilePath = path.join('/', req.params.userId, req.params.designName);
    let filePath    = null;
    
    User.findOne({ 'username': req.params.userId }, (err, user) => {
        if (err) throw err;

	filePath = user.files.find((e) => e.path == reqFilePath)['original_path'];
	
        // if (!filePath)
        //     filePath = path.join(__dirname, '../files', filePath);
	
        res.download(filePath);
    });
});


/* 
 * Design Deletion 
 */

router.get('/delete/:userId/:designName', (req, res) => {
    
    const client = net.createConnection({port: PORT, host: HOST}, () => {

	var currUser   = req.user.username;
	var designPath = '/' + req.params.userId + '/' + req.params.designName;
	var removed    = null;

	User.findOne({
	    'username': currUser,
	}, (err, user) => {
	    for (let i = 0; i < user.files.length; i++) {
		if (user.files[i].path == designPath) {
		    removed = user.files.splice(i, 1);
		}
	    }
	    
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

	    client.write(JSON.stringify(request));
	});
    });

    client.on('data', (data) => {
	res.redirect('/users/homepage');	
    });

    client.on('close', () => {
	console.log('Disconnected from the server.');
    });	

});



/* 
 * Homepage 
 */

router.get('/homepage', (req, res) => {
    User.findOne({
	'username': req.user.username
    }, (err, user) => {
	if (err) throw err;                                 /* LOG */
	res.render('homepage', {
	    org: user.files.filter((e) => e.type == 'Original');
	    rem: user.files.filter((e) => e.type == 'Remixed');
	});
    });
});


/* 
 * Recommendations 
 */
router.get('/recommendations', (req, res) => {
    User.getUserByUsername(req.user.username, (err, user) => {

	const client = net.createConnection({port: PORT, host: HOST}, () => {
	    console.log('connected to COMPUTE server');

	    let request = {command: 'RECOMMEND'
			   , userName: user.username
			   , condition: user.condition}
	    
	    client.write(JSON.stringify(request));
	});

	client.on('data', (data) => {
	    let result = JSON.parse(data);
	    res.render('recommendations', {
		org: result.recommendations /* org stands for original btw, and is
					     * used here since the layout for 'recommendations'
					     * was copied from the layout for 'homepage' */
	    });
	    client.end();
	});

	client.on('close', () => {
	    console.log('Disconnected from the server.');
	});
    });
});


/* 
 * Login 
 */

router.get('/login', (req, res) => {
    res.render('login');
});

router.post('/login',
	    passport.authenticate('local', {
		successRedirect : '/',
		failureRedirect : '/users/login',
		failureFlash    : true
	    }),
	    (req, res) => {
		res.redirect('/users/' + req.user.username);
	    });


/* 
 * Logout 
 */

router.get('/logout', (req, res) => {
    req.logout();
    req.flast('success_msg', 'You are now logged out.');
    res.redirect('/users/login');
});


/* 
 * User Info 
 */

router.get('/userinfo', (req, res) => {
    let user = req.user;
    res.render('userinfo', {
	uname     : user.username,
	email     : user.email,
	name      : user.name,
	condition : user.condition,
	nfiles    : user.files.length
    });
});


/* 
 * Contact 
 */

router.get('/contact', (req, res) => {
    res.render('contact');
});

router.post('/contact', (req, res) => {
    let email = req.body.email;
    let data  = req.body.text;

    let transporter = nodemailer.createTransport({
	server : 'gmail',
	auth   : {
	    user : 'sitdesigncomp@gmail.com',
	    pass : 'Stevens@123'
	}
    });

    let mailOptions = {
	from    : 'sitdesigncomp@gmail.com',
	to      : 'sitdesigncomp@gmail.com',
	subject : 'SITDESIGN communication',
	text    : email + '\n' + data
    };
    
    transporter.sendMail(mailOptions, (err, info) => {
	if (err) throw err;                                 /* LOG */

	req.flash('success_msg', 'Your response has been recorded. Thank you!');
	res.redirect('/users/contact');
    });
});


/* 
 * Explore 
 * DEBUG ONLY  -- renders all designs in database 
 */

router.get('/explore', (req, res) => {
    let temp     = [];
    let remixed  = [];
    let original = [];

    User.find({}, (err, user) => {
	for (let obj of user) {
	    for (let j = 0; j < obj.files.length; j++) {
		if (obj.files[j].type == 'Remixed')
		    remixed.push(obj.files[j].path);
		else
		    original.push(obj.files[j].path);
	    }
	}

	res.render('explore', {
	    rem: remixed,
	    org: original
	});
    });
});
