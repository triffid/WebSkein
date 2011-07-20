/*
	a point is a vector
	a normal is a vector
	a plane has one 3d point and a 3d normal
	a segment has two 2d (end)points and a 2d normal
	a triangle has three 3d points and a 3d normal
	a segment is created by intersecting a triangle with a plane
	a path is a list of points
	a layer has multiple paths
*/

var canvas;
var viewer;

var triangles = [];
var layers = [];
var lines = [];
var boundingBox = [];

var sliceTimer;

var extrusionWidth = 0.5;

// for sliceview
var modelWidth = 0;
var modelHeight = 0;

function xscale(x) {
	return linearInterpolate(x, boundingBox[0].e(1) / skeincanvas.scaleF, boundingBox[1].e(1) / skeincanvas.scaleF, skeincanvas.drawleft, skeincanvas.drawright) + skeincanvas.translationX;
}
function yscale(y) {
	return linearInterpolate(y, boundingBox[0].e(2) / skeincanvas.scaleF, boundingBox[1].e(2) / skeincanvas.scaleF, skeincanvas.drawtop, skeincanvas.drawbottom) + skeincanvas.translationY;
}

function wscale(w) {
	return linearInterpolate(w, 0, (boundingBox[1].e(1) / skeincanvas.scaleF) - (boundingBox[0].e(1) / skeincanvas.scaleF), 0, skeincanvas.drawright - skeincanvas.drawleft);
}

function xscale_invert(x) {
	return linearInterpolate(x - skeincanvas.translationX, skeincanvas.drawleft, skeincanvas.drawright, boundingBox[0].e(1) / skeincanvas.scaleF, boundingBox[1].e(1) / skeincanvas.scaleF);
}
function yscale_invert(y) {
	return linearInterpolate(y - skeincanvas.translationY, skeincanvas.drawtop, skeincanvas.drawbottom, boundingBox[0].e(2) / skeincanvas.scaleF, boundingBox[1].e(2) / skeincanvas.scaleF);
}
function wscale_invert(w) {
	return linearInterpolate(w, 0, skeincanvas.drawright - skeincanvas.drawleft, 0, (boundingBox[1].e(1) / skeincanvas.scaleF) - (boundingBox[0].e(1) / skeincanvas.scaleF));
}


// debug- dump an object recursively
function dump(arr,level) {
	var dumped_text = "";
	if(!level) level = 0;
	
	var level_padding = "";
	for(var j=0;j<level+1;j++) level_padding += "    ";
	
	if(typeof(arr) == 'object') {  
		for(var item in arr) {
			var value = arr[item];
		
			if(typeof(value) == 'object') { 
				dumped_text += level_padding + "'" + item + "' ...\n";
				dumped_text += dump(value,level+1);
			} else {
				dumped_text += level_padding + "'" + item + "' => \"" + value + "\"\n";
			}
		}
	} else { 
		dumped_text = "===>"+arr+"<===("+typeof(arr)+")";
	}
	return dumped_text;
}

function canvasInit() {
	canvas = $('stlview');
	viewer = new JSC3D.Viewer(canvas);
	
	viewer.setParameter('SceneUrl', '');
	viewer.setParameter('InitRotationX', 100);
	viewer.setParameter('InitRotationY', 120);
	viewer.setParameter('InitRotationZ', 0);
	viewer.setParameter('ModelColor', '#CAA618');
	viewer.setParameter('BackgroundColor1', '#FFFFFF');
	viewer.setParameter('BackgroundColor2', '#383840');
	viewer.setParameter('RenderMode', 'flat');
	
	viewer.init();
	viewer.update();
}

function segment2line(s) {
	return $L(s[0], s[1].subtract(s[0]));
}

function segmentIntersect(s1, s2) {
	if (s1[0].dimensions() != s2[0].dimensions())
		throw "segmentIntersect: s1 has different number of dimensions to s2!";

	var l1 = segment2line(s1);
	var l2 = segment2line(s2);
	
	var p = l1.intersectionWith(l2);

	// no intersection
	if (!p)
		return null;
	
	if (s1[0].dimensions() == 2)
		p = $V([p.e(1), p.e(2)]);
		
	var d1 = s1[0].distanceFrom(s1[1]);
	var d2 = s2[0].distanceFrom(s2[1]);
	
	// check if intersection is on s1
	if (p.distanceFrom(s1[0]) >= d1)
		return null;
	if (p.distanceFrom(s1[1]) >= d1)
		return null;
	
	// check if intersection is on s2
	if (p.distanceFrom(s2[0]) >= d2)
		return null;
	if (p.distanceFrom(s2[1]) >= d2)
		return null;
	
	return p;
}

function checkModel() {
	triangles = [];
	layers = [];
	try {
		slice_btn.disabled = viewer.scene.children[0].vertexBuffer.length <= 12;
		slice_layer_btn.disabled = slice_btn.disabled;
		
		if (viewer.afterupdate)
			debugWrite(' Success\n');
		
		// update number of layers
		calcLayers();
		
		// read list of triangles from jsc3d
		jsc3d_to_sylvester();
		
		// update sliceview scaler parameters
		if (1) {
			modelWidth = (boundingBox[1].e(1) - boundingBox[0].e(1));
			modelHeight = (boundingBox[1].e(2) - boundingBox[0].e(2));

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
			
			//debugWrite("mapping [" + boundingBox[0].e(1) + "," + boundingBox[0].e(2) + "]-[" + boundingBox[1].e(1) + "," + boundingBox[1].e(2) + 
			//						"] onto [" + left + "," + right + "]-[" + top + "," + bottom + "]\n");
		}
		
		viewer.afterupdate = undefined;
	}
	catch (err) {
		slice_btn.disabled = true;
		slice_layer_btn.disabled = true;
	}
}

function canvasLoadSTL(stl_uri) {
	debugWrite('Loading ' + stl_uri + '...');
	// viewer.replaceSceneFromUrl(stl_uri);
	// viewer.replaceScene(new JSC3D.Scene());
	viewer.afterupdate = checkModel;
}

// calculate number of layers from bounding box and layer height
// update layer-related input boxes
function calcLayers() {
	var count = 0;
	
	if (viewer.scene.children[0]) {
		var mesh = viewer.scene.children[0];
		count = Math.floor((mesh.aabb.maxZ - mesh.aabb.minZ - (layer_height.value / 2)) / layer_height.value);
 	}
	else {
		count = 0;
	}

	layer_count.set(count);
	layer.setMax(count);
	
	// equivalent to skeinforge WoT	
	extrusionWidth = layer_height.value * wot.value;
}

// read the list of triangles from jsc3d
// stored as 4 vectors- 3 points and a normal
function jsc3d_to_sylvester() {
	var mesh = viewer.scene.children[0];

	boundingBox = [$V([viewer.scene.aabb.minX, viewer.scene.aabb.minY, viewer.scene.aabb.minZ]), $V([viewer.scene.aabb.maxX, viewer.scene.aabb.maxY, viewer.scene.aabb.maxZ])];
	triangles = new Array();

	// following code mostly chopped from jsc3d.js:JSC3D.Mesh.prototype.calcFaceNormals() with relevant alterations
	var vbuf = mesh.vertexBuffer;
	var ibuf = mesh.indexBuffer;
	var nbuf = mesh.faceNormalBuffer;
	var i = 0, j = 0;
	while(i < ibuf.length) { //>
		var index = ibuf[i++] * 3;
		var x0 = vbuf[index];
		var y0 = vbuf[index + 1];
		var z0 = vbuf[index + 2];

		index = ibuf[i++] * 3;
		var x1 = vbuf[index];
		var y1 = vbuf[index + 1];
		var z1 = vbuf[index + 2];

		index = ibuf[i++] * 3;
		var x2 = vbuf[index];
		var y2 = vbuf[index + 1];
		var z2 = vbuf[index + 2];

		triangles.push([
			$V([x0, y0, z0]),										// point 1
			$V([x1, y1, z1]),										// point 2
			$V([x2, y2, z2]),										// point 3
			$V([nbuf[j], nbuf[j+1], nbuf[j+2]]).toUnitVector()	// normal
			]);
			
		j += 3;
		do { } while (ibuf[i++] != -1);
	}
	
	return triangles.length;
}

// basic linear interpolation routine
function linearInterpolate(value, oldmin, oldmax, newmin, newmax) {
	return (value - oldmin) * (newmax - newmin) / (oldmax - oldmin) + newmin;
}

// slice the whole model, one layer at a time
function sliceModel() {
	calcLayers();
	
	layer.set(layer_count.value);
	
	sliceTimer = setTimeout(slice_nextLayer, 100);
}

// proceed to the next layer when slicing a whole model
// we use a timer so that the browser has time to process some UI events and doesn't appear frozen
function slice_nextLayer() {
	sliceLayer();
	drawLayer(layer.value);
	if (layer.value > 0) {
		layer.set(layer.value - 1)
		sliceTimer = setTimeout(slice_nextLayer, 250);
	}
	else {
		layer.set(0);
	}
}

/***************************************************************************\
*                                                                           *
* now for some heavy lifting                                                *
*                                                                           *
\***************************************************************************/

// take a the list of triangles and the layer height and find the intersecting segments
function sliceLayer() {
	debugWrite('Slicing layer ' + layer.value + '...');
	
	// simplest solid model (tetrahedron) has 4 faces, so anything with less isn't a solid object
	if (triangles.length >= 4) {
		
		// accept a fudge factor
		var fudgeFactor = 0;
		if (arguments[0]) {
			fudgeFactor = parseFloat(arguments[0]);
			if (fudgeFactor > (layer_height.value / 2)) {
				debugWrite("layer offset too high, can't slice this model! aborting.\n");
				throw "layer offset too high at Z=" + ((layer_height.value * layer.value) + (layer_height.value * 0.5) + boundingBox[0].e(3)) + " + fudge " + fudgeFactor + ", layer height " + layer_height.value;
			}
		}
		
		// translate layerNum into an actual Z-value
		var planeHeight = (layer_height.value * layer.value) + (layer_height.value * 0.5) + boundingBox[0].e(3) + fudgeFactor;
		
		// create slice plane
		var sliceplane = $P($V([0, 0, planeHeight]), $V([0, 0, 1]));
		
		// empty lines
		lines = new Array();
		
		// find intersecting triangles
		for (var t = 0; t < triangles.length; t++) { //>
			triangle = triangles[t];
			var points = new Array();
			for(var i = 0; i < 3; i++) { // >
				var p0 = triangle[i];
				var p1 = triangle[(i + 1) % 3];
				// if the two points are so close as to be equal, we must ignore this line. it'll be picked up later
				if (!p0.eql(p1)) {
					// check if line intersects the plane
					var line = $L(p0, p1.subtract(p0));
					var v = sliceplane.intersectionWith(line);
					
					if (v) {
						// check if the intersecion actually lies between our two points, since sylvester's lines are infinitely long
						// TODO: find a faster way to do this
						var lineLength = p0.distanceFrom(p1);
						
						if ((v.distanceFrom(p0) <= lineLength) && (v.distanceFrom(p1) <= lineLength)) { //: >
							// edge intersects, do something intelligent
							
							points.push(v);
						}
					}
				}
			}
			if (points.length == 2) {
				var normal = $V([triangle[3].e(1), triangle[3].e(2), 0]) // line normal (3d)
				
				var p0 = $V([points[0].e(1), points[0].e(2)]);
				var p1 = $V([points[1].e(1), points[1].e(2)]);
				var n = $V([normal.e(1), normal.e(2)]);
				// work out which way around this segment is
				// if ((p0-p1) x normal).Z > 0, add p1,p0
				// if ((p1-p0) x normal).Z > 0, add p0,p1
				// if == 0, we must have a vertical line of zero length and shouldn't be here, so don't add at all
				if (points[0].subtract(points[1]).cross(normal).e(3) > 0) {
					// ((p0-p1) x normal).Z > 0
					lines.push([
							p1,
							p0,
							n
						]);
				}
				else if (points[1].subtract(points[0]).cross(normal).e(3) > 0) {
					lines.push([
						p0,
						p1,
						n
						]);
				}
			}
		}
		
		debugWrite(' (' + lines.length + ' segments)');
		
		lines_to_paths(lines, fudgeFactor);

		debugWrite(' OK\n');
	}
}

// check for combinability. if can be combined, returns null
// otherwise, returns the junction point to be added
// do NOT assume that we will return the same p1 that was passed in, in the future we may provide a new one
function checkCombine(p0, p1, p2) {
	// check for collinearity
	var s1 = p1.subtract(p0);
	var s2 = p2.subtract(p1);
	
	// check for very short runs
	var d0 = p1.distanceFrom(p0);
	var d1 = p2.distanceFrom(p1);
	var d2 = p2.distanceFrom(p0);

	if (p0.eql(p1))
		return null;
	if (p1.eql(p2))
		return p0;

	if (
		($L(p0, s1).distanceFrom(p2) < collinear_distance.value) ||	// co-linear
		(s1.angleFrom(s2) < collinear_angle.value) ||								// co-linear (new point is close to line as previous segment)
		(s1.angleFrom(s2) > (Math.PI - collinear_angle.value)) || 	// line turns back on itself
		(d0 < min_length.value) ||																	// segment will be too short
		((d0 + d1) <= combine_length.value) ||											// two consecutive short segments
		(d2 < combine_length.value) ||															// segment must double back on itself for p0 and p2 to be so close
		0) {
		// previous segment and this one are combinable!
		return null;
	}
	
	return p1;
}
	
// check path for possible combine optimisations
function combineOptimisePath(path) {
	var newpath = path;
	var delta;
	do {
		delta = 0
		var p0 = newpath.last();
		for (var i = 0; i < path.length; i++) {
			var p1 = path[i];
			var p2 = path[(i + 1) % path.length];
			
			var p = checkCombine(p0,p1,p2);
			if (!p) {
				newpath.splice(i, 1);
				delta++;
			}
			else
				p0 = p;
		}
	} while (delta > 0);
	
	if (path.length > newpath.length) {
		debugWrite("CombineOptimise dropped " + (path.length - newpath.length) + " points\n");
	}
	
	return newpath;
}

// eliminate spots where a path is 'inside out' due to polygon deflation
function eliminatePathInverseLoops(paths) {
	var i = 0;
	while (i < paths.length) {
		var path = paths[i];
		
		var lastIntersectorJ = -1;
		var lastIntersectorK = -1;
		var lastIntersectorP;
		var outside = 0;
		
		var j = 0;
		while (j < path.length) {
			var p0 = path[(j + path.length - 1) % path.length];
			var p1 = path[j];
			if (!p0)
				debugWrite("ASSERT p0 undefined!\n");
			if (!p1)
				debugWrite("ASSERT p1 undefined!\n");
								
			var k = j + 1;
			while (k < path.length) {
				var p2 = path[k % path.length];
				var p3 = path[(k + 1) % path.length];
				
				var p = segmentIntersect([p0, p1], [p2, p3]);
				
				if (p0.eql(p3))
					p = null;
				
				if (p) {
					debugWrite("\nPath " + i + ": {" + (j - 1) + "-" + j + "}" + p0 + "-" + p1 + " intersects {" + k + "-" + (k + 1) + "}" + p2+ "-" + p3 + " at " + p + "!");
					
					// debug draw!
					if (0) {
						layers[layer.value].shells.push(paths);
						if (layers[layer.value].intersections)
							layers[layer.value].intersections.push(p);
						else
							layers[layer.value].intersections = [p];
						drawLayer(layer.value);
						layers[layer.value].shells.pop();
						// break here!
						p = p;
					}
					
					if ((outside == 1) && (lastIntersectorK >= j)) {
						// cull loop
						debugWrite(" Closing path at {" + (lastIntersectorJ) + "} resuming at {" + (k + 1) + "} and creating new path from {" + j + "} to {" + lastIntersectorK + "} ");
						
						if (j == lastIntersectorJ) {
							// swap p0 and p1, because if the whole loop intersects j then we see the end of the first loop first, instead of the start of the 2nd loop which is what we see first if j > lastJ
							var px = p;
							p = lastIntersectorP;
							lastIntersectorP = px;
						}

						var newPath = [p];
						Array.prototype.push.apply(newPath, path.slice(j, lastIntersectorK + 1));

						path[lastIntersectorJ] = lastIntersectorP;
						path.splice(lastIntersectorJ + 1, k - lastIntersectorJ);
						
						paths[i] = path;
						if (newPath.length >= 3)
							paths.push(newPath);
						
						outside = 0;
						lastIntersectorJ = -1;
						lastIntersectorK = -1;
						lastIntersectorP = null;
						//layers[layer.value].intersections = [];
						
						// force re-check of spliced junction
						j--;
						k = path.length;
					}
					else if (outside) {
						debugWrite("Culling " + (lastIntersectorK - lastIntersectorJ) + " points starting at " + (lastIntersectorJ + 1) + "\n");

						path[lastIntersectorJ] = lastIntersectorP;
						path.splice(lastIntersectorJ + 1, lastIntersectorK - lastIntersectorJ);

						paths[i] = path;

						outside = 0;
						lastIntersectorJ = -1;
						lastIntersectorK = -1;
						latIntersectorP = null;
						// force re-check of spliced junction
						j--;
						k = path.length;
					}
					else {
						outside = 1;
						lastIntersectorJ = j;
						lastIntersectorK = k;
						lastIntersectorP = p;
					}
				}
				k++;
			}
			j++;
		}
		// mangle array, remove all points in the loop, rejoin flailing ends at our intersection
		if (outside) {
			debugWrite("tail-Culling " + (lastIntersectorK - lastIntersectorJ) + " points starting at " + (lastIntersectorJ + 1) + "\n");
			
			path[lastIntersectorJ] = lastIntersectorP;
			path.splice(lastIntersectorJ + 1, lastIntersectorK - lastIntersectorJ);
			
			paths[i] = path;
			outside = 0;
		}
		i++;
	}

	return paths;
}

// takes a random collection of segments and creates one or more paths
// since our lines' endpoints are in a specific winding order we can assume that p[1] connects to the next segment's p[0]
// TODO: join collinear segments while we're at it
function lines_to_paths(lines, fudge) {
	var paths = new Array;
	var cl; 		// current segment
	var path;		// path under construction
	var fp;			// find point
	var i = 0, j = 0, k = 0;
	
	for (k = 0; (k < 3) && (lines.length > 0); k++) {
		if (k > 0) {
			debugWrite(' (try ' + (k + 1) + ' finding paths)');
		}
		i = 0;
		cl = lines.splice((k * Math.random * lines.length) % lines.length, 1)[0];
		path = [cl[0]];
		fp = cl[1];
		var segcounter = 500;
		var linefound;
		
		do {
			linefound = 0;
			i = 0;
			while (i < lines.length) {
				var tp = lines[i][0]; // test point
				
				if (tp.eql(fp)) {
					// found the next segment
					cl = lines.splice(i, 1)[0];
					fp = cl[1];
					linefound = 1;
					
					if (--segcounter == 0) {
						debugWrite(" (" + lines.length + " segments remaining)");
						segcounter = 500;
					}
					
					// combinatorial optimisations
					path.push(cl[0]);
					
					if (cl[1].eql(path[0])) {
						// path is closed
						
						if (path.length > 3) {
							// path = eliminatePathInverseLoops(path);
							path = combineOptimisePath(path);
							paths.push(path.slice(0, path.length));
							debugWrite(" (" + paths.length + " paths)");
							if (lines.length) {
								cl = lines.splice(0, 1)[0];
								path = [cl[0]];
								fp = cl[1];
							}
						}
						else
							debugWrite("Closed Path with only " + path.length + " points found! discarding. ");
					}
					// i = 0;
				}
				else
					i++;
			}
		} while (linefound);
		if (lines.length) {
			// couldn't close path
			path.push(fp);
			path = combineOptimisePath(path);
			paths.push(path.slice(0, path.length));
			cl = lines.splice(Math.floor(Math.random * lines.length), 1)[0];
			path = [cl[0]];
			fp = cl[1];
		}
	}
	
	if (lines.length) {
		fudge += layer_height.value * 0.01;
		debugWrite(" " + lines.length + ' lines found without a closed path! Trying reslice with layer offset +' + fudge + '... ');
		return sliceLayer(fudge);
	}
	
	// eliminatePathInverseLoops(paths);
	
	layers[layer.value] = { outline: paths, shells: [] };
	
	for (var i = 0; i < shell_count.value; i++) {
		debugWrite(" (" + (i + 1) + " shells");
		skeinShell(i);
		debugWrite(")");
	}
}

// create shell(s) inside the perimeter.
// pass index of shell to create
function skeinShell(n) {
	var paths;
	var shrinkLevel;
	
	if (n == 0) {
		paths = layers[layer.value].outline;
		shrinkLevel = extrusionWidth / 2;
	}
	else {
		paths = layers[layer.value].shells[n - 1];
		shrinkLevel = extrusionWidth;
	}
	
	var shells = [];
	for (var i = 0, l = paths.length; i < l; i++) {
		shells[i] = shrinkPath(paths[i], extrusionWidth);
	}
	
	shells = eliminatePathInverseLoops(shells);
	for (var i = 0, l = shells.length; i < l; i++) {
		shells[i] = combineOptimisePath(shells[i]);
	}
	debugWrite(", optimised");

	layers[layer.value].shells[n] = shells;
}

// this returns a new path set <distance> mm behind the supplied path.
// NOTE: for inner paths (eg holes), this will make the path /larger/ so that the new path is inside the object
// algorithm:
// for each triplet of points x0, x1, x2
// we set p0=x0, p1=p2=x1, p3=x2
// we look for a new p1
// there are two segments s1(p1-p0), s2(p3-p2)
// find normals n1(s1.cross(Z)), n2(s2.cross(Z))
// and move s1 along normal n1 by -distance, same for s2
// then find the intersection of new s1 and new s2, this is our new p
// if there is no intersection then the whole segment should be eliminated, we do this by updating p2 and p3 but not p0 or p1 and continuing until we find one that does intersect

function shrinkPath(path, distance) {
	var newpath = [];
	var p0 = path.last();
	var p1 = path[0];
	var s1 = p1.subtract(p0);
	var n1 = s1.to3D().cross($V([0, 0, -1])).toUnitVector();
			n1 = $V([n1.e(1),n1.e(2)]).multiply(-distance);
	var backing = 0;

	p0 = p0.add(n1);
	p1 = p1.add(n1);
	
	for (var i = 0, j = 0, l = path.length; j < l; i++, j++) {
		var p2 = path[j % l];
		var p3 = path[(j + 1) % l];
		var s2 = p3.subtract(p2);
		var n2 = s2.to3D().cross($V([0, 0, -1])).toUnitVector();
				n2 = $V([n2.e(1),n2.e(2)]).multiply(-distance);
		
		p2 = p2.add(n2);
		p3 = p3.add(n2);
		
		var p, ns1, ns2;
		
		var a = Math.atan2(s2.e(2), s2.e(1)) - Math.atan2(-s1.e(2), -s1.e(1));
		if (a < 0)
			a += Math.PI * 2;

		if (a >= (Math.PI / 2)) {
			// if angle is >= 45 degrees, we use lines since we don't care how far away the intersection is
			ns1 = segment2line([p0, p1]);
			ns2 = segment2line([p2, p3]);
		}
		else {
			// debugWrite("Acute at {" + i + "}" + p0 + "-" + p1 + ":" + p2 + "-" + p3 + ": ");
			// otherwise we have to check segments to avoid inside-out loops
			ns1 = Segment.create(p0, p1);
			ns2 = Segment.create(p2, p3);
		}
		
		p = ns1.intersectionWith(ns2);
		
		if (p) {
			// if (a < (Math.PI / 2))
				// debugWrite("intersect at " + p + "\n");
			newpath.push($V([p.e(1), p.e(2)]));
			if (!backing) {
				p0 = newpath.last();
				p1 = p3;
			}
			else {
				p0 = p2;
				p1 = newpath.last();
				backing = 0;
			}
			s1 = p1.subtract(p0);
			n1 = s1.to3D().cross($V([0, 0, -1])).toUnitVector();
			n1 = $V([n1.e(1),n1.e(2)]).multiply(-distance);
		}
		else {
			//if (a < (Math.PI / 4))
				// debugWrite("no intersect! ");
			// now, decide whether to search forwards or backwards!
			var x1 = s1.to3D().cross(p3.subtract(p0).to3D());
			if (x1.e(3) < 0) {
				// debugWrite(x1 + " backwards\n");
				// p2 = p0;
				// p3 = p1;
				
				j-=2;
				backing = 1;
				
				p0 = newpath[newpath.length - 1];
				p1 = newpath[newpath.length - 2];
				s1 = p1.subtract(p0);
				n1 = s1.to3D().cross($V([0, 0, -1])).toUnitVector();
				n1 = $V([n1.e(1),n1.e(2)]).multiply(-distance);
				
				p0 = p0.add(n1);
				p1 = p1.add(n1);
			}
			else {
				// debugWrite(x1 + " forwards\n");
			}
		}
	}
	
	return combineOptimisePath(newpath);
}

function drawLayer(n) {
	var context = skeincanvas.getContext('2d');
	
	//context.restore();
	context.clearRect(-100, -100, skeincanvas.width + 100, skeincanvas.height + 100);
	//context.save();
	//context.translate(skeincanvas.translationX, skeincanvas.translationY);
	//context.scale(skeincanvas.scaleF, skeincanvas.scaleF);

	if (!layers[n] || !layers[n].outline)
		sliceLayer();
	var paths = layers[n].outline;
	var shells = layers[n].shells;
	var intersections = layers[n].intersections;
	
	var colours = [
			[128,128,128],
			[255,0,0],
			[0,255,0],
			[0,0,255],
			[255,255,0],
			[255,0,255],
			[0,255,255]
		];

	if (paths) {
		for (var j = 0; j < paths.length; j++) {
			var path = paths[j];
			drawPath(path, colours[0], 0.5);
		}
	}
	if (shells) {
		for (var j = 0; j < shells.length; j++) {
			var shell = shells[j];
			for (var i = 0; i < shell.length; i++) {
				var path = shell[i];
				drawPath(path, colours[(j % (colours.length - 2)) + 1], wscale(extrusionWidth));
			}
		}
	}
	if (intersections) {
		for (var j = 0; j < intersections.length; j++) {
			var p = intersections[j];
			var x = xscale(p.e(1));
			var y = yscale(p.e(2));
			var xl = 3;
			context.save();
				context.lineWidth = 1;
				context.strokeStyle = "rgba(128,0,0,0.5)";
				context.beginPath();
				context.moveTo(x - xl, y - xl);
				context.lineTo(x + xl, y + xl);
				context.moveTo(x - xl, y + xl);
				context.lineTo(x + xl, y - xl);
				context.stroke();
			context.restore();
		}
	}
	
	// draw reset button
	context.save();
		context.lineWidth = 2;
		context.fillStyle = "rgb(192,96,0)";
		context.beginPath();
		context.rect(0, 0, 20, 20);
		context.fill();
		context.strokeStyle = "rgb(0,255,0)";
		context.beginPath();
		context.arc(10, 10, 7, Math.PI * 0.4, Math.PI * 0.6, true);
		context.stroke();
	context.restore();
}

function drawPath(path, colour, width) {
	if (!path.length)
		return;

	var context = skeincanvas.getContext('2d');
	
	if (!width)
		width = 0.75;

	context.save()
		context.strokeStyle = 'rgba(' + colour.join(',') + ', 0.5)';
		context.lineWidth = width;
		context.lineCap = 'round';
		context.lineJoin = 'round';
		context.beginPath();
	
		path.push(path[0]);	
		for (var i = 0; i < path.length; i++) {
			var point = path[i];
			var x = xscale(point.e(1));
			var y = yscale(point.e(2));
			context.lineTo(x, y);
		}
		path.pop();
	
		context.stroke();
	context.restore();

	// lines drawn, now do normals

	context.save();
		context.strokeStyle = 'rgba(' + colour.join(',') + ',0.25)';
		context.lineWidth = 1;
		context.beginPath();
		
		path.push(path[0]);	
		for (var i = 1; i < path.length; i++) {
			var vl = 0.5; // normal tick length, millimeters
			var p0 = path[i - 1];
			var p1 = path[i];
			var n = $V([p0.e(1) - p1.e(1), p0.e(2) - p1.e(2), 0]).cross($V([0, 0, 1])).toUnitVector().multiply(vl);
			var x = (p0.e(1) + p1.e(1)) / 2;
			var y = (p0.e(2) + p1.e(2)) / 2;
			context.moveTo(xscale(x), yscale(y));
			context.lineTo(xscale(x + n.e(1)), yscale(y + n.e(2)));
		}	
		path.pop();
		
		context.stroke();
	context.restore();
	
	if (1) {
		var sl = 4;																										// start vector length
		var al = 2;																										// arrow length
		var aa = 0.85;																								// arrow angle (2 = full rotation)
		var r  = 2;																										// startpoint circle radius
		var p0 = path[0];																							// first point
		var p1 = path[1];																							// second point
		var v  = p1.subtract(p0).toUnitVector().multiply(sl);					// start vector
		var a1 = v.rotate(Math.PI *  aa, $V([0, 0])).toUnitVector().multiply(al);	// arrow arm 1
		var a2 = v.rotate(Math.PI * -aa, $V([0, 0])).toUnitVector().multiply(al);	// arrow arm 2
		var x1 = p0.e(1);																							// start point
		var y1 = p0.e(2);
		var x2 = p0.e(1) + v.e(1);																		// start point + start vector
		var y2 = p0.e(2) + v.e(2);
		
		// now draw path entry point and direction vector
		context.save();
			context.strokeStyle = 'rgba(' + colour.join(',') + ',0.5)';
			context.lineWidth = 2;
			context.beginPath();
			context.arc(xscale(x1), yscale(y1), r, 0, Math.PI * 2, true);
			context.moveTo(xscale(x1), yscale(y1));
			context.lineTo(xscale(x2), yscale(y2));
			context.stroke();
		context.restore();
		
		context.save();
			// now draw direction vector arrows
			context.strokeStyle = 'rgba(' + colour.join(',') + ',0.5)';
			context.lineWidth = 0.75;
			context.beginPath();
			context.moveTo(xscale(x2), yscale(y2));
			context.lineTo(xscale(x2 + a1.e(1)), yscale(y2 + a1.e(2)));
			context.lineTo(xscale(x2 + a2.e(1)), yscale(y2 + a2.e(2)));
			context.lineTo(xscale(x2), yscale(y2));
			context.stroke();
		context.restore();
	}
}

function pointInfo(x, y) {
	if (layers[layer.value]) {
		var lx = xscale_invert(x);
		var ly = yscale_invert(y);
		
		var p = $V([lx, ly]);
		
		var cl = $V([0, 0]);
		var d = 2147483647;
		var gr;
		var path_ind;
		var point_ind;
		var shell_ind;
		
		var outlines = layers[layer.value].outline;
		var shells = layers[layer.value].shells;
		var path;
		
		for (i = 0; i < outlines.length; i++) {
			var cpath = outlines[i];
			for (var j = 0; j < cpath.length; j++) {
				var point = cpath[j];
				var pd = point.distanceFrom(p);
				if (pd < d) {
					cl = point;
					d = pd;
					gr = 'outline';
					path = cpath;
					path_ind = i;
					point_ind = j;
				}
			}
		}
		for (i = 0; i < shells.length; i++) {
			var shellpaths = shells[i];
			for (var j = 0; j < shellpaths.length; j++) {
				var cpath = shellpaths[j];
				for (var k = 0; k < cpath.length; k++) {
					var point = cpath[k];
					if (point) {
						var pd = point.distanceFrom(p);
						if (pd < d) {
							cl = point;
							d = pd;
							gr = 'shells';
							path = cpath;
							shell_ind = i;
							path_ind = j;
							point_ind = k;
						}
					}
				}
			}
		}
		
		if (!path)
			return;
		
		drawLayer(layer.value);
		
		// var path = layers[layer.value][gr][path_ind];
		
		var description = cl + "\n"
		
		description += "Group: " + gr + "\n";
		if (gr == 'shells')
			description += "Shell " + shell_ind + "\n";
		description += "Set: " + path_ind + "\n";
		description += "Index: " + point_ind + "\n";
		
		var p0i = (point_ind + path.length - 1) % path.length;
		var p2i = (point_ind + 1) % path.length;

		var p0 = path[p0i];
		var p1 = cl;
		var p2 = path[p2i];
		
		var s1 = p1.subtract(p0);
		var s2 = p2.subtract(p1);
		
		description += "Next (blue): [" + p2i + "] = " + p2 + " (" + s2.modulus() + ")\n";
		description += "Previous (orange): [" + p0i + "] = " + p0 + " (" + s1.modulus() + ")\n";
		
		var a = Math.atan2(s2.e(2), s2.e(1)) - Math.atan2(-s1.e(2), -s1.e(1));
		if (a < 0)
			a += Math.PI * 2;
		
		description += "Angle: " + (a * 180 / Math.PI).toFixed(2) + " degrees (" + s1.angleFrom(s2) + ")\n";
		
		description += "distance(p0,p2) = " + p2.distanceFrom(p0) + "\n";
		
		description += "Combinable: ";
		if (checkCombine(p0, p1, p2))
			description += "no\n";
		else
			description += "yes\n";			

		var context = skeincanvas.getContext('2d');
		
		context.save();
			context.strokeStyle = "rgba(0, 255, 0, 1)";
			context.fillStyle = "rgba(0, 255, 0, 0.5)";
			context.beginPath();
			context.arc(xscale(cl.e(1)), yscale(cl.e(2)), 25, Math.atan2(s2.e(2), s2.e(1)), Math.atan2(-s1.e(2), -s1.e(1)), true);
			context.stroke();
		context.restore();

		context.save();
			context.strokeStyle = "rgba(0, 0, 255, 0.5)";
			context.lineWidth = 4;
			context.beginPath();
			context.moveTo(xscale(cl.e(1)), yscale(cl.e(2)));
			context.lineTo(xscale(p2.e(1)), yscale(p2.e(2)));
			context.stroke();
		context.restore();
		
		context.save();
			context.strokeStyle = "rgba(255, 128, 0, 0.5)";
			context.lineWidth = 4;
			context.beginPath();
			context.moveTo(xscale(cl.e(1)), yscale(cl.e(2)));
			context.lineTo(xscale(p0.e(1)), yscale(p0.e(2)));
			context.stroke();
		context.restore();
	
		var pointinfo = $('pointinfo');
		pointinfo.value = description;
	}
}
