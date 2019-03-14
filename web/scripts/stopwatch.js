var Stopwatch = function(elem) {
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
	elem.innerHTML = clock/1000 + "  s";
    }

    var delta = () => {
	var now = Date.now();
	var d = now - offset;
	offset = now;
	return d;
    }

    this.start = start;
    this.stop = stop;
    this.tick = clock;
}
