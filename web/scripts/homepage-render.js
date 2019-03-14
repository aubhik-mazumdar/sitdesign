var myDivs     = new Array();
var myWatchers = new Array();

var renderDesigns   = function () {
    let outerDiv    = document.getElementById('designs');
    let designsList = document.getElementById('designs-list');
    let designs     = designsList.getElementsByTagName('li');

    designsList.style.display = 'none';

    /* model properties */
    let modelColor       = "#CAA618";
    let backgroundColor1 = "#FFFFFF";
    let backgroundColor2 = "#FFFFFF";

    if (designs.length == 0) {
	let msg       = document.createElement('h4');
	msg.style     = 'width:120%';
	msg.innerHTML = 'There are no designs to display';
	msg.align     = 'center';
	outerDiv.appendChild(msg);
    }

    for (let i = 0; i < designs.length; i++) {

	let designPath = designs[i].textContent;

	/* outer div for design */
	let dOuter = document.createElement('div');

	/* main card */
	let dCard = document.createElement('div');

	/* link to design */
	let designLink = document.createElement('a');
	designLink.setAttribute('href', '/users/design' + designPath);
	designLink.id = 'design-anchor' + i.toString();

	/* name of design */
	let designName = document.createElement('h6');
	designName.innerHTML = designPath.replace(/\/\w+?\//g,'').replace(/.stl/i,'');
	designName.align     = 'center';
	designName.id        = 'watch';

	/* delete anchor */
	let deleteAnchor = document.createElement('a');
	deleteAnchor.setAttribute('href', '/users/delete' + designPath);

	/* delete icon */
	let deleteIcon = document.createElement('i');
	deleteIcon.setAttribute('class', 'material-icons');
	deleteIcon.innerHTML = 'delete';
	
	/* canvas */
	let dCanvas = document.createElement('canvas');
	dCanvas.setAttribute('width',                    '300%');
	dCanvas.setAttribute('height',                   '300%');
	dCanvas.setAttribute('style', 'padding:5px 5px 5px 5px');

	/* viewer -- jsc3d */
	let viewer = new JSC3D.Viewer(dCanvas);
	viewer.setParameter('SceneUrl',               designPath);
	viewer.setParameter('InitRotationX',                  45);
	viewer.setParameter('InitRotationY',                 -45);
	viewer.setParameter('InitRotationZ',                 -45);
	viewer.setParameter('ModelColor',             modelColor);
	viewer.setParameter('BackgroundColor1', backgroundColor1);
	viewer.setParameter('BackgroundColor2', backgroundColor2);
	viewer.setParameter('RenderMode',                 'flat');
	viewer.setParameter('Renderer',                  'webgl');
	viewer.setParameter('ProgressBar',                 'off');

	/* attach a watcher to the div */
	let watcher = new watchDiv(dCard, designPath);

	// myWatchers.push(watcher);

	if (document.addEventListener)
	    document.addEventListener('click', watcher.unwatch, false);
	else
	    document.attachEvent('onclick', watcher.unwatch);

	/* listen to watcher */
	if (document.addEventListener)
	    document.addEventListener('click', watcher.unwatch, false);
	else
	    document.addEventListener('onclick', watcher.unwatch);

	/* Laying everything out */
	outerDiv.appendChild(dOuter);
	dOuter.appendChild(dCard);
	dCard.appendChild(dCanvas);	
	dOuter.appendChild(designLink);
	designLink.appendChild(designName);
	
	/* initialize and update the viewer */
	viewer.init();
	viewer.update();
    }

    // for (let i = 0; i < myWatchers.length; i++) {
    // 	if (document.addEventListener)
    // 	    document.addEventListener('click', myWatchers[i].unwatch, false);
    // 	else
    // 	    document.attachEvent('onclick', myWatchers[i].unwatch);
    // }
}
