var fs   = require('fs');
var path = require('path')

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


function userLog(action, info, name) {
    let timeStamp = getDate();

    /* debug */
    console.log("action: ", action);
    console.log("info: ", info);
    console.log("name: ", name);

    let filePath = path.join(__dirname, '../files', name, 'activity.log');

    console.log("log file: ", filePath) /* debug */

    let errMsg = timeStamp + ' unable to log information; affected user: ' + name;

    let data = '\n' + timeStamp + ' : ' + action + ' - ' + info;

    fs.open(filePath, 'a', (err, fd) => {
	if (err)
	    console.log(errMsg);

	fs.appendFile(fd, data, (err) => {
	    if (err)
		console.log(errMsg);

	    fs.close(fd, (err) => {
		if (err)
		    console.log(errMsg);
	    });
	});
    });
}

module.exports = {
    userLog,
    getDate
};
