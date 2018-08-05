var User = require('../models/user');

var DISTANCE_MATRIX = new Object();
var DESIGNS = new Array();
var parameters = ['volume', 'avg_face_area', 'nfaces'];

function updateDistanceMatrix() {
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

function startupCompute() {
    User.find({}, (err, users) => {
	for (let user of users) {
	    for (let design of user.files) {
		DESIGNS.push({'user': user.username, 'design': design});
	    }
	}
	updateDistanceMatrix();
	console.log("DISTANCE MATRIX");
	console.log(DISTANCE_MATRIX);
    });
}

function calculateDistance(d1, d2) {
    let v = (d1.volume - d2.volume)**2;
    let f = (d1.nfaces - d2.nfaces)**2;
    let a = (d1.avg_face_area - d2.avg_face_area)**2;
    return Math.sqrt(v + f + a);
}

function stripPath(p) {
    return p.substring(0, p.length-4);
}

startupCompute();
