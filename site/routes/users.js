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
router.use(fileUpload());

router.get('/upload', function (req, res) {
  res.render('upload');
});

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
      password: password
    });
    User.createUser(newUser, function (err, user) {
      if (err) throw err;
      console.log(user);
    });
    req.flash('success_msg', 'You are registered, please login');
    res.redirect('/users/login');
  }
});

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
  let info='not analyzed yet';
  let t = req.body.text;
  let option = req.body.type;
  let urls = req.body.urls;
  let flag=0;
  if (option == 'Remixed')
    urls = urls.split(';');  
  // Use the mv() method to place the file somewhere on your server
  var dir = path.join('./files/', req.user.username);//files/aubhik/
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
    //If file is a STEP file
    if(sampleFile.name.match(/.step/i)){
      //convert to stl
        var options = {
          mode: 'text',
          pythonOptions: ['-u'],
          scriptPath: 'C:/Users/Aubhik/Desktop/JN/design-contest-research/programs/autofea-v0.5',
          args: ['C:/Users/Aubhik/Desktop/JN/design-contest-research/site/files/' + req.user.username + '/' + sampleFile.name, dir + '/']
        };
        
        PythonShell.run('convert_to_stl.py',options, function (err,results) {
          if (err) throw err;
          console.log('results: %j',results);
        });
        
        xmas = sampleFile.name.replace(/.step/i,'.stl');
        let d = '/' + req.user.username + '/' + xmas;
        User.findOne({'username':req.user.username},function(err,user){
          if (option == 'Remixed') {
            user.files.push({
              'description': t,
              'path': d,
              'type': option,
              'urls': urls,
              'score': info
            });
          } else {
            user.files.push({
              'description': t,
              'path': d,
              'type': option,
              'score':info
            });
          }
          user.save(function (err) {
            if (err) throw err;
          });
        });
        flag=1;
        analyze("C:/Users/Aubhik/Desktop/JN/design-contest-research/site/files/"+ req.user.username + '/' + sampleFile.name, "./",req.user.username);
    }
  let d = '/' + req.user.username + '/' + xmas;
  //store file in MongoDB database
  if(!flag){
    User.findOne({
      'username': req.user.username
    }, function (err, user) {
      info='cannot analyze a STL file. Please upload a STEP file'
      if (option == 'Remixed') {
        user.files.push({
          'description': t,
          'path': d,
          'type': option,
          'urls': urls,
          'score': info
        });
      } else {
        user.files.push({
          'description': t,
          'path': d,
          'type': option,
          'score':info
        });
      }
      user.save(function (err) {
        if (err) throw err;
      });
    });
  }
  req.flash('success_msg', "File uploaded successfully!");
  console.log("File uploaded successfully");
  res.render('upload',{
    filename: sampleFile.name,
    progress: 'true'
  });
});

function analyze(infile,outdir,username){
  console.log('Running analysis');
  autofea_run(infile, outdir, function(e){
    e = JSON.stringify(e);
    console.log('done',e);
    User.findOne({'username': username}, function (err, user){
      let temp = user.files.pop();
      temp.score = e;
      user.files.push(temp);
      user.save(function(err){
        if (err) throw err;
      });
    });
  },(e)=>console.log(''));
  console.log('analysis complete');
}


function autofea_run(infile, savedir, res_callback, end_callback) {
  console.log('autofeaRun started');
  let autofea = spawn('python', ['C:/Users/Aubhik/Desktop/JN/design-contest-research/programs/autofea-v0.5/autofea05.py', infile, '-s', savedir]);
  result_str = '';
  let flag=0;
  autofea.stdout.on('data', (data) => {
  let resp = data.toString(), lines = resp.split(/(\r?\n)/g);
  result_str += resp;
  if(flag==0){
  // we only want the last line
    fea_resu = JSON.parse(lines[lines.length-3]);
    res_callback(fea_resu);
    flag=1;
    return;
  }	
  else
    return;
  });
  autofea.on('close', (close) => {
      return end_callback(result_str);
  });
};

router.get('/homepage', function (req, res) {
  var tempOrg = [], tempRem = [];
  User.findOne({
    'username': req.user.username
  }, function (err, user) {
    for (let i = 0; i < user.files.length; i++) {
      if(user.files[i].type=='Remixed')
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



router.get('/delete/:userId/:designName',function(req,res){
    var currUser= req.user.username;
    var tempOrg = [], tempRem = [];
    var path = '/' + req.params.userId + '/' + req.params.designName;
    User.findOne({'username':currUser},function(err,user){
      for(let i=0;i<user.files.length;i++){
        if(user.files[i].path == path){
          user.files.splice(i,1);
          break;
        }
      }
      for (let i = 0; i < user.files.length; i++) {
        if(user.files[i].type=='Remixed')
          tempRem.push(user.files[i].path);
        else
          tempOrg.push(user.files[i].path);
      }
      console.log(tempOrg,tempRem);
      user.save(function(err){
        if(err) throw err;
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
  User.findOne({
    'username': req.params.userId
  }, function (err, user) {
    for (let i = 0; i < user.files.length; i++) {
      if (user.files[i].path == temp2) {
        dsp = user.files[i].description;
        if(user.files[i].score)
          s = user.files[i].score;
        else
          s = 'no score currently';
        if (user.files[i].type == 'Remixed')
          urls = user.files[i].urls;
      }
    }
    if (!dsp)
      dsp = 'no description';
    res.render('design', {
      current: req.user.username,
      title: req.params.designName,
      fileName: temp2,
      uname: req.params.userId,
      dname: req.params.designName,
      desp: dsp,
      url: req.hostname + '/users' + req.path,
      score: s,
      links: urls
    });
  });
});

router.get('/explore', function (req, res) {
  var temp = [];
  let remixed = [];
  let original = [];
  User.find({}, function (err, user) {
    for (let obj of user) {
      if (obj.username == req.user.username)
        continue;
      for (let j = 0; j < obj.files.length; j++) {
        if (obj.files[j].type == "Remixed")
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

router.post('/login',
  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/users/login',
    failureFlash: true
  }),
  function (req, res) {
    // If this function gets called, authentication was successful.
    // `req.user` contains the authenticated user.
    res.redirect('/users/' + req.user.username);
  });

router.get('/logout', function (req, res) {
  req.logout();
  req.flash('success_msg', 'You are now logged out');
  res.redirect('/users/login');
})


module.exports = router;