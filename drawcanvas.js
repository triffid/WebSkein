// for sliceview
var modelWidth = 0;
var modelHeight = 0;
var modelMinX = 0;
var modelMinY = 0;
var modelMaxX = 0;
var modelMaxY = 0;
var modelMax = 0;

function linearInterpolate(value, oldmin, oldmax, newmin, newmax) {
	return (value - oldmin) * (newmax - newmin) / (oldmax - oldmin) + newmin;
}

function xscale(x) {
	return linearInterpolate(x, modelMinX / skeincanvas.scaleF, modelMaxX / skeincanvas.scaleF, skeincanvas.drawleft, skeincanvas.drawright) + skeincanvas.translationX;
}
function yscale(y) {
	return linearInterpolate(y, modelMinY / skeincanvas.scaleF, modelMaxY / skeincanvas.scaleF, skeincanvas.drawtop, skeincanvas.drawbottom) + skeincanvas.translationY;
}

function wscale(w) {
	return linearInterpolate(w, 0, (modelMaxX / skeincanvas.scaleF) - (modelMinX / skeincanvas.scaleF), 0, skeincanvas.drawright - skeincanvas.drawleft);
}

function xscale_invert(x) {
	return linearInterpolate(x - skeincanvas.translationX, skeincanvas.drawleft, skeincanvas.drawright, modelMinX / skeincanvas.scaleF, modelMaxX / skeincanvas.scaleF);
}
function yscale_invert(y) {
	return linearInterpolate(y - skeincanvas.translationY, skeincanvas.drawtop, skeincanvas.drawbottom, modelMinY / skeincanvas.scaleF, modelMaxY / skeincanvas.scaleF);
}
function wscale_invert(w) {
	return linearInterpolate(w, 0, skeincanvas.drawright - skeincanvas.drawleft, 0, (modelMaxX / skeincanvas.scaleF) - (modelMinX / skeincanvas.scaleF));
}

function findBounds() {
	modelMinX = modelMaxX = outline[0][0][0];
	modelMinY = modelMaxY = outline[0][0][1];
	
	skeincanvas.scale = 0;
	skeincanvas.scaleF = 1;
	skeincanvas.translationX = 0;
	skeincanvas.translationY = 0;
	
	for (var i = 0, l = outline.length; i < l; i++) {
		var path = outline[i];
		for (var j = 0, m = path.length; j < m; j++) {
			var point = path[j];
			if (point[0] > modelMaxX)
				modelMaxX = point[0];
			if (point[0] < modelMinX)
				modelMinX = point[0];
			if (point[1] > modelMaxY)
				modelMaxY = point[1];
			if (point[1] < modelMinY)
				modelMinY = point[1];
		}
	}
	
	modelWidth = modelMaxX - modelMinX;
	modelHeight = modelMaxY - modelMinY;
	
	modelMax = Math.sqrt((modelWidth * modelWidth) + (modelHeight * modelHeight));
	
	if ((modelWidth / modelHeight) > (skeincanvas.width / skeincanvas.height)) {
		// model limited by width, cull heights
		skeincanvas.drawleft = 5;
		skeincanvas.drawright = skeincanvas.width - 10;
		skeincanvas.drawtop = (skeincanvas.height / 2) - (modelHeight * (skeincanvas.width - 10) / modelWidth / 2);
		skeincanvas.drawbottom = (skeincanvas.height / 2) + (modelHeight * (skeincanvas.width - 10) / modelWidth / 2);
	}
	else {
		// model limited by height
		skeincanvas.drawtop = 5;
		skeincanvas.drawbottom = skeincanvas.height - 10;
		skeincanvas.drawleft = (skeincanvas.width / 2) - (modelWidth * (skeincanvas.height - 10) / modelHeight / 2);
		skeincanvas.drawright = (skeincanvas.width / 2) + (modelWidth * (skeincanvas.height - 10) / modelHeight / 2);
	}
}

function drawcanvas() {
	var context = skeincanvas.getContext('2d');
	context.clearRect(0, 0, skeincanvas.width, skeincanvas.height);

	if (0) {
		// draw skelVertex segments in magenta
		if (skelVertices.length) {
			context.save();
			context.strokeStyle = "rgba(255, 128, 255, 0.3)";
			context.lineWidth = 1.5;
			for (var i = 0, l = skelVertices.length; i < l; i++) {
				var sv = skelVertices[i];
				context.beginPath();
				context.moveTo(xscale(sv.vector.e(1)), yscale(sv.vector.e(2)));
				context.lineTo(xscale(sv.nextV.vector.e(1)), yscale(sv.nextV.vector.e(2)));
				context.stroke();
			}
			context.restore();
		}
	}

	if (0) {	
		// draw skelVertex non-reflex bisectors in blue, reflex bisectors in red
		if (skelVertices.length) {
			context.save();
			context.lineWidth = 2;
			for (var i = 0, l = skelVertices.length; i < l; i++) {
				var sv = skelVertices[i];
				if (sv.isReflex == false)
					context.strokeStyle = "rgba(128, 128, 255, 0.5)";
				else
					context.strokeStyle = "rgba(255, 128, 128, 0.5)";
				context.beginPath();
				context.moveTo(xscale(sv.vector.e(1)), yscale(sv.vector.e(2)));
				context.lineTo(xscale(sv.vector.add(sv.bisector).e(1)), yscale(sv.vector.add(sv.bisector).e(2)));
				context.stroke();
			}
			context.restore();
		}
	}

	if (0) {	
		// draw edge events in green
		if (edgeEvents.length) {
			var eel = 5;
			context.save();
			context.strokeStyle = "rgba(128, 255, 128, 0.5)";
			context.lineWidth = 1.2;
			for (var i = 0, l = edgeEvents.length; i < l; i++) {
				var edgeEvent = edgeEvents[i];
				var time = edgeEvent[0];
				var sv = edgeEvent[1];
				var p = sv.vector.add(sv.bisector.multiply(time));
				context.beginPath();
				context.moveTo(xscale(p.e(1)) - eel, yscale(p.e(2)) - eel);
				context.lineTo(xscale(p.e(1)) + eel, yscale(p.e(2)) + eel);
				context.moveTo(xscale(p.e(1)) - eel, yscale(p.e(2)) + eel);
				context.lineTo(xscale(p.e(1)) + eel, yscale(p.e(2)) - eel);
				// context.moveTo(xscale(p.e(1)), yscale(p.e(2)));
				// context.lineTo(xscale(sv.vector.e(1)), yscale(sv.vector.e(2)));
				// context.moveTo(xscale(p.e(1)), yscale(p.e(2)));
				// context.lineTo(xscale(sv.nextV.vector.e(1)), yscale(sv.nextV.vector.e(2)));
				context.stroke();
			}
			context.restore();
		}
	}
	
	try {
		// draw the skeleton in orange (edge events) and green (reflex events)
		if (skelSegments.length) {
			context.save();
			context.strokeStyle = "rgba(255, 192, 0, 0.5)";
			context.lineWidth = 1;
			for (var i = 0, l = skelSegments.length; i < l; i++) {
				var skelSegment = skelSegments[i][0];
				if (skelSegments[i][1])
					context.strokeStyle = "rgba(0, 255, 0, 0.5)";
				else
					context.strokeStyle = "rgba(255, 192, 0, 0.5)";
				context.beginPath();
				context.moveTo(xscale(skelSegment.v1.e(1)), yscale(skelSegment.v1.e(2)));
				context.lineTo(xscale(skelSegment.v2.e(1)), yscale(skelSegment.v2.e(2)));
				context.stroke();
			}
			context.restore();
		}
	}
	catch (e) {
		$('pointInfoTxt').value += e;
	}

	// draw outline in black
	context.save();
	context.strokeStyle = "rgba(0, 0, 0, 0.2)";
	context.lineWidth = 1;
	for (var i = 0, l = outline.length; i < l; i++) {
		var path = outline[i];
		context.beginPath();
		for (var j = 0, m = path.length; j < m; j++) {
			var point = path[j];
			context.lineTo(xscale(point[0]), yscale(point[1]));
		}
		context.closePath();
		context.stroke();
	}
	context.restore();
	
	// draw zero crosshair
	context.save();
	context.strokeStyle = "rgba(0, 0, 0, 0.2)";
	context.lineWidth = 1;
	context.beginPath();
	context.moveTo(xscale(-10), yscale(0));
	context.lineTo(xscale(10), yscale(0));
	context.moveTo(xscale(0), yscale(-10));
	context.lineTo(xscale(0), yscale(10));
	context.stroke();
	context.restore();
}
