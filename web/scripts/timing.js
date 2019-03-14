var Stopwatch = function() {
    var offset, interval;
    var clock = 0;

    var start = () => {
	if (!interval) {
	    offset = Date.now();
	    interval = setInterval(update, 10); /* update every 10 milliseconds */
	}
    }

    var stop = () => {
	if (interval) {
	    clearInterval(interval);
	    interval = null;
	}
    }

    var update = () => {
	clock += delta();
	// elem.innerHTML = clock / 1000 + " // StopWatch = function(elem) { ...
    }

    var delta = () => {
	var now = Date.now();
	var d = now - offset;
	offset = now;
	return d;
    }

    var getTime = () => {
	return clock;
    }

    this.start = start;
    this.stop = stop;
    this.getTime = getTime;
    this.tick = clock;
}

var watchDiv = function (div, filename) {

    this.rawTimer = new Stopwatch();
    this.interactionTimer = new Stopwatch();

    div.addEventListener("mouseover", (e) =>  {
	this.rawTimer.start();
    });

    div.addEventListener("mouseout", (e) => {
	this.rawTimer.stop();
    });

    div.addEventListener("pointerdown", (e) => {
	this.interactionTimer.start();
    });

    div.addEventListener("pointerup", (e) => {
	this.interactionTimer.stop();
    });

    this.unwatch = (e) =>  {

	// console.log(e);
	// console.log(e.tagName);
	
	if (e.target.tagName == 'A' || e.target.tagName == 'BUTTON' || e.target.id == 'watch') {
	    // console.log("TIMING INFORMATION");
	    // console.log(this.rawTimer.getTime());
	    // console.log(this.interactionTimer.getTime());

	    // alert('You clicked on an exit point');

	    // let rawTime = this.rawTimer.getTime();
	    // let interactionTime = this.interactionTimer.getTime();

	    if (filename.endsWith('.stl'))
		filename = filename.replace(/.stl/,'');

	    let sendToPath = '/users' + filename + '/time';

	    // console.log(sendToPath); /* DEBUG */

	    // $.post(sendToPath, {rawTime: rawTime, interactionTime: interactionTime},
	    // 	   function (returnedData) {
	    // 	       console.log(returnedData);
	    // 	   });

	    $.post(sendToPath, {rawTime: this.rawTimer.getTime()
				, interactionTime: this.interactionTimer.getTime()},
		   function (returnedData) {
		       console.log(returnedData);
		   });
	    
	}
	// else {
	//     // console.log(e.target.tagName);
	// }
    }
    return this;
}
