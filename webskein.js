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

var top;
var bottom;
var left;
var right;

function xscale(x) {
	return linearInterpolate(x,  boundingBox[0].e(1), boundingBox[1].e(1), left, right);
}
function yscale(y) {
	return linearInterpolate(y,  boundingBox[0].e(2), boundingBox[1].e(2), top, bottom);
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

function getFloat(e, def) {
	var n = $(e).value;
	if (!isNaN(parseFloat(n)) && isFinite(n)) {
		n = parseFloat(n);
	}
	else {
		n = def;
	}
	e.value = n;
	return n;
}

function getInt(e, def) {
	var n = $(e).value;
	if (!isNaN(parseFloat(n)) && isFinite(n)) {
		n = parseFloat(n);
	}
	else {
		n = def;
	}
	n = Math.floor(n);
	e.value = n;
	return n;
}

function checkModel() {
	triangles = new Array();
	layers = new Array();
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
			var skeincanvas = $('sliceview');
		
			modelWidth = (boundingBox[1].e(1) - boundingBox[0].e(1));
			modelHeight = (boundingBox[1].e(2) - boundingBox[0].e(2));

			if ((modelWidth / modelHeight) > (skeincanvas.width / skeincanvas.height)) {
				// model limited by width, cull heights
				left = 1;
				right = skeincanvas.width;
				top = (skeincanvas.height / 2) + (modelHeight * skeincanvas.width / modelWidth / 2);
				bottom = (skeincanvas.height / 2) - (modelHeight * skeincanvas.width / modelWidth / 2);
			}
			else {
				// model limited by height
				top = 1;
				bottom = skeincanvas.height;
				left = (skeincanvas.width / 2) - (modelWidth * skeincanvas.height / modelHeight / 2);
				right = (skeincanvas.width / 2) + (modelWidth * skeincanvas.height / modelHeight / 2);
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
		sliceTimer = setTimeout(slice_nextLayer, 100);
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
		
		debugWrite(' ' + lines.length + ' segments...');
		
		lines_to_paths(lines, fudgeFactor);

		debugWrite(' OK\n');
	}
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
		
		while (i < lines.length) {
			var tp = lines[i][0]; // test point
			
			if (tp.eql(fp)) {
				// found the next segment
				cl = lines.splice(i, 1)[0];
				fp = cl[1];
				
				// combinatorial optimisations
				if (path.length >= 1) {
					var p0 = path[path.length - 1];		// start of last segment
					var p1 = cl[0];										// end of last segment/start of found segment (point found at tp.eql(fp) above)
					var p2 = cl[1];										// end of found segment
				
					// check for collinearity
					var line = $L(p0, p1.subtract(p0));
					
					// check for very short runs
					var d0 = p1.distanceFrom(p0);
					var d1 = p2.distanceFrom(p1);
	
					if (
						(line.distanceFrom(p2) < collinear_distance.value) ||	// co-linear (new point is on same line as previous segment)
						(d0 < min_length.value) ||														// segment will be too short
						((d0 + d1) <= combine_length.value) ||								// two consecutive short segments
						0) {
						// previous segment and this one are collinear or very short! combine!
						// we combine simply by not adding p1 to the path, so the next run sees p0 and p2
					}
					else
						path.push(p1);
				}
				else
					path.push(cl[0]);
				
				if (cl[1].eql(path[0])) {
					// path is closed
					
					if (path.length > 3) {
						if (1) {
							// try to combine last segment with first
							var p0 = path[path.length - 1];
							var p1 = path[0];
							var p2 = path[1];
						
							// check for collinearity
							var line = $L(p0, p1.subtract(p0));
							
							// check for very short runs
							var d0 = p1.distanceFrom(p0);
							var d1 = p2.distanceFrom(p1);
			
							if (
								(line.distanceFrom(p2) < collinear_distance.value) ||
								(d0 < min_length.value) ||
								((d0 + d1) <= combine_length.value) ||
								0) {
								// previous segment and this one are collinear or very short! combine!
								path[0] = p0;
								path.pop;
							}
						}
						
						paths.push(path.slice(0, path.length));
						if (lines.length) {
							cl = lines.splice(0, 1)[0];
							path = [cl[0]];
							fp = cl[1];
						}
					}
					else
						debugWrite("Closed Path with only " + path.length + " points found! discarding. ");
				}
				i = 0;
			}
			else {
				i++;
			}
		}
		if (lines.length) {
			// couldn't close path
			path.push(fp);
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
	
	debugWrite(" " + paths.length + " paths...");
	
	layers[layer.value] = { outline: paths };
	
	drawShell(0);
}

// draw shell(s) inside the perimeter.
// pass index of shell to draw
function drawShell(n) {
	var paths = layers[layer.value].outline;
	layers[layer.value].shells = [];
	for (var i = 0; i < paths.length; i++) {
		var shell = shrinkPath(paths[i], (extrusionWidth * n) + (extrusionWidth / 2));
		layers[layer.value].shells.push(shell);
	}
}

function drawLayer(n) {
	var skeincanvas = $('sliceview');
	var context = skeincanvas.getContext('2d');
	
	context.clearRect(0, 0, skeincanvas.width, skeincanvas.height);
	
	var paths = layers[n].outline;
	if (paths === undefined) {
		sliceLayer();
		paths = layers[n].outline;
	}
	var shells = layers[n].shells;
	
	var colours = [
			[0,0,0],
			[255,0,0],
			[0,255,0],
			[0,0,255],
			[255,255,0],
			[255,0,255],
			[0,255,255]
		];

	for (var j = 0; j < paths.length; j++) {
		var path = paths[j];
		drawPath(path, colours[0]);
	}	
	for (var j = 0; j < shells.length; j++) {
		var shell = shells[j];
		drawPath(shell, colours[1]);
	}
}

// this returns a new path set <distance> mm behind the supplied path.
// NOTE: for inner paths (eg holes), this will make the path /larger/ so that the new path is inside the object
// algorithm:
// for each triplet of points p0, p1, p2
// there are two segments s0(p1-p0), s1(p2-p1)
// find a normal n = (n[s0] + n[s1]).toUnit()
// and move the vertex p1 along this normal by negative distance.

function shrinkPath(path, distance) {
	var newpath = [];
	for (var i = 0; i < path.length; i++) {
		var p0 = path[(i + path.length - 1) % path.length];
		var p1 = path[i];
		var p2 = path[(i + 1) % path.length];
		
		var s1 = p1.subtract(p0);
		var s2 = p2.subtract(p1);
		
		// normals for our segments
		var n1 = $V([s1.e(1), s1.e(2), 0]).cross($V([0, 0, -1]));
		var n2 = $V([s2.e(1), s2.e(2), 0]).cross($V([0, 0, -1]));
		
		var n3 = n1.add(n2);
		
		var n = $V([n3.e(1), n3.e(2)]).toUnitVector();
		
		var p = p1.add(n.multiply(-distance));
		
		newpath.push(p);
	}
	
	return newpath;
}

function drawPath(path, colour) {
	var skeincanvas = $('sliceview');
	var context = skeincanvas.getContext('2d');

	context.strokeStyle = 'rgb(' + colour.join(',') + ')';
	context.lineWidth = 1;
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

	// lines drawn, now do normals

	context.strokeStyle = 'rgba(' + colour.join(',') + ',0.25)';
	context.beginPath();
	
	path.push(path[0]);	
	for (var i = 1; i < path.length; i++) {
		var vl = 1; // normal tick length, millimeters
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
		context.strokeStyle = 'rgba(' + colour.join(',') + ',0.5)';
		context.lineWidth = 2;
		context.beginPath();
		context.arc(xscale(x1), yscale(y1), r, 0, Math.PI * 2, true);
		context.moveTo(xscale(x1), yscale(y1));
		context.lineTo(xscale(x2), yscale(y2));
		context.stroke();

		if (1) {		
			// now draw direction vector arrows
			context.strokeStyle = 'rgba(' + colour.join(',') + ',0.5)';
			context.lineWidth = 0.75;
			context.beginPath();
			context.moveTo(xscale(x2), yscale(y2));
			context.lineTo(xscale(x2 + a1.e(1)), yscale(y2 + a1.e(2)));
			context.lineTo(xscale(x2 + a2.e(1)), yscale(y2 + a2.e(2)));
			context.lineTo(xscale(x2), yscale(y2));
			context.stroke();
		}
	}
}
