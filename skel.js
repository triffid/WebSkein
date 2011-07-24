var outline = [
	[
		[-27.00,6.36],[-26.08,6.83],[-25.00,7.00],[-6.12,7.00],[-6.12,3.50],[-1.41,3.50],[-1.41,7.00],[0.74,7.00],[0.74,12.00],[-0.06,12.00],[0.00,30.69],[0.47,29.40],[1.01,28.35],[1.65,27.36],[2.40,26.44],[3.23,25.60],[4.15,24.86],[5.14,24.21],[6.20,23.68],[7.30,23.25],[8.45,22.95],[9.59,22.77],[10.79,22.70],[11.98,22.76],[13.14,22.95],[14.29,23.25],[15.39,23.68],[16.44,24.21],[17.44,24.86],[18.36,25.60],[19.19,26.44],[19.94,27.36],[20.58,28.35],[21.11,29.38],[21.54,30.51],[21.85,31.65],[22.03,32.82],[22.09,34.02],[22.03,35.20],[21.84,36.37],[21.53,37.51],[21.11,38.62],[20.57,39.67],[19.92,40.66],[19.18,41.58],[18.34,42.41],[17.44,43.14],[16.42,43.80],[15.37,44.33],[14.26,44.75],[13.12,45.06],[11.95,45.24],[10.77,45.30],[9.59,45.23],[8.42,45.05],[7.28,44.74],[6.20,44.32],[5.13,43.77],[4.14,43.13],[3.22,42.38],[2.38,41.54],[1.64,40.62],[1.00,39.63],[0.46,38.58],[0.05,37.49],[0.07,49.94],[0.29,50.85],[0.65,51.72],[1.15,52.53],[1.76,53.24],[2.47,53.85],[3.28,54.35],[4.15,54.71],[5.06,54.93],[32.52,55.38],[49.58,58.38],[55.81,60.34],[57.87,60.60],[59.83,60.29],[61.60,59.39],[62.99,58.00],[63.91,56.22],[64.22,54.25],[63.90,52.27],[63.01,50.52],[61.58,49.10],[59.81,48.21],[57.86,47.91],[52.62,48.32],[50.63,48.17],[46.75,47.28],[43.12,45.64],[39.91,43.33],[37.19,40.39],[36.34,39.13],[36.20,35.65],[36.39,33.66],[37.38,29.80],[39.10,26.21],[41.51,23.04],[42.94,21.65],[46.86,18.88],[48.27,17.48],[49.17,15.71],[49.48,13.73],[48.54,3.44],[48.32,2.41],[47.98,1.74],[47.05,0.67],[46.33,0.30],[45.00,0.00],[-25.01,0.00],[-26.09,0.17],[-26.89,0.58]
	],[
		[24.03,12.37],[24.13,11.75],[24.29,11.15],[24.52,10.56],[24.80,10.00],[25.15,9.47],[25.54,8.99],[25.99,8.54],[26.47,8.15],[27.00,7.80],[27.56,7.52],[28.15,7.29],[28.75,7.13],[29.37,7.03],[39.41,7.00],[32.59,22.70],[24.00,22.70]
	],[
		[25.92,39.99],[26.66,38.88],[27.87,38.05],[29.25,37.77],[32.25,37.77],[33.56,38.03],[34.79,38.83],[35.57,39.99],[35.83,41.30],[35.57,42.75],[34.79,43.92],[33.62,44.70],[32.25,44.97],[29.25,44.97],[27.87,44.70],[26.70,43.92],[25.92,42.75],[25.65,41.37]
	],[
		[38.80,12.37],[39.54,11.26],[40.75,10.42],[42.13,10.15],[45.13,10.15],[46.44,10.41],[47.67,11.20],[48.45,12.37],[48.71,13.68],[48.45,15.12],[47.67,16.29],[46.51,17.07],[45.13,17.35],[42.13,17.35],[40.75,17.07],[39.58,16.29],[38.80,15.12],[38.53,13.75]
	],[
		[53.55,55.63],[53.27,54.25],[53.53,52.94],[54.33,51.71],[55.49,50.93],[56.80,50.67],[59.87,50.65],[61.25,50.93],[62.36,51.67],[63.20,52.88],[63.47,54.25],[63.20,55.63],[62.42,56.80],[61.25,57.58],[59.87,57.85],[56.87,57.85],[55.49,57.58],[54.33,56.80]
	],[
		[-3.21,24.74],[-6.63,12.00],[-8.26,12.00],[-8.26,10.22],[-15.60,12.11],[-11.69,26.72]
	]
]; /**/

/* var outline = [
	[
		[1, 1], [1, 11], [11, 3], [21, 11], [21, 1]
	]
]; */

var skelVertices = [];
var skelSegments = [];
var skelEvents = [];

var lastcp = null;

function binaryInsertionSort(a, i, o) {
	// utility function
	var low = 0;
	var high = a.length;
	
	// binary insertion sort
	while (low < high) {
		var mid = (low + ((high - low) / 2)) | 0;
		var midval = a[mid][0];
		
		if (midval < i) {
			low = mid + 1;
		}
		else if (midval > i) {
			high = mid;
		}
		else {
			a.splice(mid, 0, [i, o]);
			return; // mid
		}
	}
	a.splice(low, 0, [i, o]);
	return; // low
}

function buildPathDataMap() {
	skelVertices = [];
	skelEvents = [];
	skelSegments = [];
	for (var i = 0, l = outline.length; i < l; i++) {
		var path = outline[i];
		// first in this loop
		var fsv = null;
		// previous
		var psv = null;
		for (var j = 0, m = path.length; j < m; j++) {
			var point = path[j];
			// new vector
			var sv = new skelVertex($V(point));
			// if this is the first, save it
			if (fsv == null)
				fsv = sv;
			// if we have a previous, tell new vertex about it
			if (psv)
				sv.setPrevV(psv);
			// save to our list
			sv.svindex = skelVertices.length;
			skelVertices.push(sv);
			// save for next round
			psv = sv;
		}
		// set last.next = first to close the loop
		sv.setNextV(fsv);
	}
}

function pointInfo(x, y) {
	if (skelVertices.length == 0)
		return;
		
	var pit = $('pointInfoTxt');
	if (!pit)
		return;
	
	var px = xscale_invert(x);
	var py = yscale_invert(y);
	
	var p = $V([px, py]);
	
	var pld = [];
	
	for (var i = 0, l = skelVertices.length; i < l; i++) {
		var nd = p.distanceFrom(skelVertices[i].vector);
		binaryInsertionSort(pld, nd, skelVertices[i]);
	}
	
	// set a distance threshold of 3 pixels
	var d = pld[0][0] + wscale_invert(3);
	
	// remove all points that are too far away
	for (var i = 0, l = pld.length; i < l; i++) {
		if (pld[i][0] > d) {
			pld.splice(i, pld.length - i);
			break;
		}
	}
	
	var cp = pld[0][1];
	var d = cp.vector.add(cp.bisector).distanceFrom(p);
	
	// pick point whose bisector is closest to our actual xy
	for (var i = 1, l = pld.length; i < l; i++) {
		var tp = pld[i][1];
		var nd = tp.vector.add(tp.bisector).distanceFrom(p);
		if (nd < d) {
			cp = tp;
			d = nd;
		}
	}
	
	if (cp != lastcp) {
		lastd = d;
		
		var ci = cp.svindex;
	
		var context = skeincanvas.getContext('2d');
		
		drawcanvas();
		
		context.save();
		context.strokeStyle = "rgba(255, 0, 0, 0.3)";
		context.beginPath();
		context.arc(xscale(cp.vector.e(1)), yscale(cp.vector.e(2)), 5, 0, Math.PI * 2, true);
		context.stroke();
		
		context.strokeStyle = "rgba(0, 255, 0, 0.3)";
		context.lineWidth = 5;
		context.beginPath();
		context.moveTo(xscale(cp.vector.e(1)), yscale(cp.vector.e(2)));
		context.lineTo(xscale(cp.nextV.vector.e(1)), yscale(cp.nextV.vector.e(2)));
		context.stroke();

		context.strokeStyle = "rgba(0, 0, 255, 0.3)";
		context.lineWidth = 5;
		context.beginPath();
		context.moveTo(xscale(cp.vector.e(1)), yscale(cp.vector.e(2)));
		context.lineTo(xscale(cp.prevV.vector.e(1)), yscale(cp.prevV.vector.e(2)));
		context.stroke();

		context.restore();
		
		description  = "Vertex: " + ci + "\n";
		description += "Pos   : " + cp.vector + "\n";
		description += "Bisect: " + cp.bisector + "\n";
		description += "Reflex: " + cp.isReflex + "\n";
		description += "Next: " + cp.nextV.svindex + "\n";
		description += "Prev: " + cp.prevV.svindex + "\n";
		
		pit.value = description;
	}
}

function skelEventInsert(t, e) {
	binaryInsertionSort(skelEvents, t, e);
}

function findEdgeEvent(sv) {
	// next vertex
	var nv = sv.nextV;
	// create two lines along the bisectors
	var svbl = $L(sv.vector, sv.bisector);
	var nvbl = $L(nv.vector, nv.bisector);
	// see if they intersect
	var ip = svbl.intersectionWith(nvbl);
	
	// if they do
	if (ip) {
		ip.elements.length = sv.vector.elements.length;
		// check that it's actually inside our object
		var id = sv.bisector.positionAlong(ip.subtract(sv.vector));
		if (id >= 0) {
			// if so, we have an edge event!
			// now find where to put it
			id += sv.startTime;
			skelEventInsert(id, [sv, nv, ip]);
		}
	}
}

function findSplitEvent(sv) {
	// next vertex
	for (var i = 0, l = skelVertices.length; i < l; i++) {
		// the two points that flank the segment we're checking
		var cv1 = skelVertices[i];
		var cv2 = cv1.nextV;
		
		if (cv1 === sv)
			continue;
		if (cv2 === sv)
			continue;
		
		// form lines from the bisectors
		var bl1 = $L(cv1.vector, cv1.bisector);
		var bl2 = $L(cv2.vector, cv2.bisector);
		
		// find where they intersect
		var tp = bl1.intersectionWith(bl2);
		
		// hoist our reflex bisector to 45 degrees from X-Y plane
		var rb = $V([sv.bisector.e(1), sv.bisector.e(2), sv.bisector.modulus()]);
		var rr = $L(sv.vector, rb);
		
		// if the bisectors intersect, we should be able to hoist a triangle
		if (tp) {
			// find closest point on cv1-cv2 from p
			var cp = cv1.nextSeg.line.pointClosestTo(tp);
			
			// find distance from p to cv1-cv2
			var dp = cp.distanceFrom(tp);
			
			if (cv1.nextSeg.normal.isParallelTo(tp.subtract(cp))) {
				// triangle's tip is above Z=0, nothing fancy
				var t = new Triangle(cv2.vector.to3D(), cv1.vector.to3D(), tp.to3D().add($V([0, 0, dp])));
			}
			else if (cv1.nextSeg.normal.isAntiparallelTo(tp.subtract(cp))) {
				// triangle's tip is below Z=0, extend the base up to catch rr
				var t3p = tp.to3D().add($V([0, 0, -dp]));
				var plane = $P($V([0, 0, modelMax]), $V([0, 0, 1]));
				var te1 = $L(cv1.vector.to3D(), t3p.subtract(cv1.vector.to3D())).intersectionWith(plane);
				var te2 = $L(cv2.vector.to3D(), t3p.subtract(cv2.vector.to3D())).intersectionWith(plane);
				var t = new Triangle(te1, te2, t3p);
			}
			var p = t.intersectionWith(rr);
			if (p) {
				// reflex ray intersects our triangle
				var time = p.e(3);
				// check that this happens inside our object. if it happens outside, time is negative
				if ((time > 0) && (time < modelMax)) {
					time += sv.startTime;
					skelEventInsert(time, [sv, cv1, cv2, p]);
					// skelSegments.push(new Segment(sv.vector, $V([p.e(1), p.e(2)])));
				}
			}
		}
		else {
			// stripe (l1 and l2 do not intersect)

			// hoist the bisectors into 3d, and make their Z length equal to their 2d modulus, so they have an angle of 45 degrees to the XY plane
			var te1 = $V([cv1.bisector.e(1), cv1.bisector.e(2), cv1.bisector.modulus()]);
			var te2 = $V([cv2.bisector.e(1), cv2.bisector.e(2), cv2.bisector.modulus()]);
			
			// create lines from the hoisted bisectors
			var l1 = $L(cv1.vector, te1);
			var l2 = $L(cv2.vector, te2);
			
			// first, form a plane coplanar to our stripe. we can use a base point as an anchor, and take the cross product of the line between base points, and one edge line as our normal
			var plane = $P(l1.anchor, l1.direction.cross(l2.anchor.subtract(l1.anchor)).toUnitVector());
			// second, find if ray intersects plane
			var p = plane.intersectionWith(rr);
			if (p) {
				// reflex ray intersects our plane. now check if ray is between the "goalposts"
				if (plane.normal.isParallelTo(l1.direction.cross(p.subtract(l1.anchor))) &&
						plane.normal.isParallelTo(l2.direction.cross(l2.anchor.subtract(p)))) {
					// reflex ray intersects our stripe
					var time = p.e(3);
					// check that this happens inside our object. if it happens outside, time is negative
					if ((time > 0) && (time < modelMax)) {
						time += sv.startTime;
						skelEventInsert(time, [sv, cv1, cv2, p]);
						// skelSegments.push(new Segment(sv.vector, $V([p.e(1), p.e(2)])));
					}
				}
			}
		}
	}
}

function findEvents() {
	for (var i = 0, l = skelVertices.length; i < l; i++) {
		var sv = skelVertices[i];
		
		findEdgeEvent(sv);
		if (sv.isReflex)
			findSplitEvent(sv);
	}
}

function runSkeletonEvents() {
	// find initial events
	skelSegments = [];
	skelEvents = [];
	findEvents();
	while (skelEvents.length) {
		var eventTime = skelEvents[0][0];
		var checkVertices = [];
		// process found events
		while (skelEvents.length && eventTime == skelEvents[0][0]) {
			var event = skelEvents.splice(0, 1)[0];
			var time = event[0];
			var svInvolved = event[1];
			if (svInvolved.length == 3) {
				// edge event
				if (svInvolved[0].alive && svInvolved[1].alive) {
					// points involved haven't already been involved with an earlier event
					var v1 = svInvolved[0];
					var v2 = svInvolved[1];
					var p = svInvolved[2];
					v2.alive = false;
					skelSegments.push([new Segment(v1.vector, p), 0]);
					skelSegments.push([new Segment(v2.vector, p), 0]);
					if (v2.nextV === v1) {
						// loop has shrunk to zero size
						v1.alive = false;
					}
					else {
						v1.translate(p.subtract(v1.vector));
						v1.startTime = time;
						v1.setNextV(v2.nextV);
						checkVertices.push(v1);
					}
				}
			}
			else if (svInvolved.length == 4){
				// reflex event
				// in svInvolved we have 4 elements- reflex vector, v1, v2, and p
				// reflex intersects the segment between v1 and v2 at point p
				// p is 3 dimensional, its Z value is our time signature
				// we must split the segment between v1 and v2, inserting a new point
				// our loops are anti-clockwise, so and nv.prev=v2 and nv.next = rv.next, and rv.next = v1
				var rv = svInvolved[0];
				var v1 = svInvolved[1];
				var v2 = svInvolved[2];
				var p  = $V([svInvolved[3].e(1), svInvolved[3].e(2)]);
				rv.translate(p.subtract(rv.vector));
				rv.startTime = time;
				var newp = new skelVertex(p);
				newp.startTime = time;
				newp.setPrevV(v1);
				newp.setNextV(rv.nextV);
				rv.setNextV(v2);
				newp.svindex = skelVertices.length;
				skelVertices.push(newp);
				checkVertices.push(rv, v1, v2, newp);
				skelSegments.push([new Segment(v1.vector, p), 1]);
				skelSegments.push([new Segment(v2.vector, p), 1]);
			}
		}
		for (var i = 0, l = checkVertices.length; i < l; i++) {
			var newp = checkVertices[i];
			findEdgeEvent(newp.prevV);
			if (newp.prevV.isReflex)
				findSplitEvent(newp.prevV);
			findEdgeEvent(newp);
			if (newp.isReflex)
				findSplitEvent(newp);
		}
	}
}
