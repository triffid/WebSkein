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
var triangles = new Array();
var layers = new Array();
var boundingBox = [];
var sliceTimer;
var layerHeight = 0.3;
var layerNum = 0;
var layerCount = 0;

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
		$('slice_btn').disabled = viewer.scene.children[0].vertexBuffer.length <= 12; //>
		if (viewer.afterupdate)
			debugWrite(' Success\n');
		calcLayers();
		jsc3d_to_sylvester();
		viewer.afterupdate = undefined;
	}
	catch (err) {
		$('slice_btn').disabled = true;
	}
}

function canvasLoadSTL(stl_uri) {
	debugWrite('Loading ' + stl_uri + '...');
	// viewer.replaceSceneFromUrl(stl_uri);
	// viewer.replaceScene(new JSC3D.Scene());
	viewer.afterupdate = checkModel;
}

function calcLayers() {
	layerHeight = getFloat('layer_height_txt', 0.3);
	layerNum = getInt('layer_txt', 0);
	
	if (layerHeight < 0.05) {
		layerHeight = 0.05;
		$('layer_height_txt').value = layerHeight;
	}

	if (viewer.scene.children[0]) {
		var mesh = viewer.scene.children[0];
		layerCount = Math.floor((mesh.aabb.maxZ - mesh.aabb.minZ - (layerHeight / 2)) / layerHeight);
		$('layer_count_txt').value = layerCount;
 	}
	else {
		layerCount = 0;
		$('layer_count_txt').value = layerCount;
	}
	
	if (layerNum > layerCount)
		layerNum = layerCount;
	
	$('layer_txt').value = layerNum;
}

function jsc3d_to_sylvester() {
	var mesh = viewer.scene.children[0];

	boundingBox = [$V([viewer.scene.aabb.minX, viewer.scene.aabb.minY, viewer.scene.aabb.minZ]), $V([viewer.scene.aabb.maxX, viewer.scene.aabb.maxY, viewer.scene.aabb.maxZ])];
	triangles = new Array();

	// following code mostly chopped from jsc3d.js:JSC3D.Mesh.prototype.calcFaceNormals()
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
			
		// debug.value += '[' + (j / 3) + ']{' + [[x0,y0,z0].join(','),[x1,y1,z1].join(','),[x2,y2,z2].join(',')].join('}{') + '}\n';
			
		j += 3;
		do { } while (ibuf[i++] != -1);
	}
	
	return triangles.length;
}

function linearInterpolate(value, oldmin, oldmax, newmin, newmax) {
	return (value - oldmin) * (newmax - newmin) / (oldmax - oldmin) + newmin;
}

function sliceModel() {
	calcLayers();
	
	layerNum = -1;
	$('layer_txt').value = layerNum;
	
	sliceTimer = setTimeout(slice_nextLayer, 100);
}

function slice_nextLayer() {
	if (layerNum < getInt('layer_count_txt', 0)) {
		layerNum++;
		$('layer_txt').value = layerNum;
		sliceLayer();
		drawLayer(layerNum);
		sliceTimer = setTimeout(slice_nextLayer, 100);
	}
}

/***************************************************************************\
*                                                                           *
* now for some heavy lifting                                                *
*                                                                           *
\***************************************************************************/

// take a the list of triangles and the layer height and find the intersecting segments
function sliceLayer() {
	debugWrite('Slicing layer ' + layerNum + '...');
	
	// simplest solid model (tetrahedron) has 4 faces, 3 vertexes per face so anything with less than 12 isn't a solid object
	if (triangles.length >= 12) {
		// alert('Size is ' + (boundingBox[1].e(1) - boundingBox[0].e(1)) + 'mm x ' + (boundingBox[1].e(2) - boundingBox[0].e(2)) + 'mm x ' + (boundingBox[1].e(3) - boundingBox[0].e(3)) + 'mm');
		// alert(triangles.length + ' triangles');
		// so now we have triangles, which is an array of arrays of 4 vectors (3 points and a normal)
		
		var sliceplane = $P($V([0, 0, (layerHeight * layerNum) + (layerHeight * 0.5) + boundingBox[0].e(3)]), $V([0, 0, 1]));
		var lines = new Array();
		
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
				// lines.push(points);
				// debug.value += '[' + t + ']{' + [points[0].elements.join(','), points[1].elements.join(',')].join('}{') + '}\n';
			}
		}
		
		debugWrite(' ' + lines.length + ' segments...');
		
		lines_to_paths(lines);

		debugWrite(' OK\n');
	}
}
	
// takes a random collection of segments and creates one or more paths
// since our lines' endpoints are in a specific winding order we can assume that p[1] connects to the next segment's p[0]
// TODO: join collinear segments while we're at it
function lines_to_paths(lines) {
	var paths = new Array;
	var cl; 		// current segment
	var path;		// path under construction
	var fp;			// find point
	var i = 0, j = 0, k = 0;
	
	for (k = 0; (k < 10) && (lines.length > 0); k++) {
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
						(line.distanceFrom(p2) < getFloat('collinear_distance_txt', 0.15)) ||
						((d0 + d1) <= getFloat('combine_length_txt', 0.5)) ||
						(d0 < getFloat('min_length_txt', 0.4))
						) {
						// previous segment and this one are collinear or very short! combine!
						// we combine simply by not adding p1 to the path
					}
					else
						path.push(p1);
				}
				else
					path.push(cl[0]);
				
				if (cl[1].eql(path[0])) {
					// path is closed
					
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
							(line.distanceFrom(p2) < getFloat('collinear_distance_txt', 0.15)) ||
							((d0 + d1) <= getFloat('combine_length_txt', 0.5)) ||
							(d0 < getFloat('min_length_txt', 0.4))
							) {
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
		debugWrite(lines.length + ' lines found without a closed path! Try a different layer thickness, a mere +/-0.001 may do it\n');
	}
	
	debugWrite(" " + paths.length + " paths...");
	
	layers[layerNum] = { outline: paths };
}

function drawLayer(layerNum) {
	var skeincanvas = $('sliceview');
	var context = skeincanvas.getContext('2d');
	
	context.clearRect(0, 0, skeincanvas.width, skeincanvas.height);
	
	var paths = layers[layerNum].outline;
	if (paths === undefined) {
		sliceLayer();
		paths = layers[layerNum].outline;
	}
	
	var colours = [
			[255,0,0],
			[0,255,0],
			[0,0,255],
			[255,255,0],
			[255,0,255],
			[0,255,255],
			[0,0,0]
		];

	for (var j = 0; j < paths.length; j++) {
		var path = paths[j];
		drawPath(path, colours[j % colours.length]);
		path.pop();
	}	
}

function drawPath(path, colour) {
	path.push(path[0]);
	
	var skeincanvas = $('sliceview');
	var context = skeincanvas.getContext('2d');

	var xzoom = skeincanvas.width / (boundingBox[1].elements[0] - boundingBox[0].elements[0]);
	var yzoom = skeincanvas.heigt / (boundingBox[1].elements[1] - boundingBox[0].elements[1]);
	var zoom = xzoom;
	if (yzoom < zoom) //>
		zoom = yzoom;
	
	xzoom = zoom * (boundingBox[1].elements[0] - boundingBox[0].elements[0]) / 4;
	yzoom = zoom * (boundingBox[1].elements[1] - boundingBox[0].elements[1]) / 4;
	
	function xscale(x) {
		return linearInterpolate(x,  boundingBox[0].elements[0], boundingBox[1].elements[0], (skeincanvas.width / 2)  - xzoom, (skeincanvas.width / 2)  + xzoom);	
	}
	function yscale(y) {
		return linearInterpolate(y,  boundingBox[0].elements[1], boundingBox[1].elements[1], (skeincanvas.height / 2) - yzoom, (skeincanvas.height / 2) + yzoom);
	}
	
	context.strokeStyle = 'rgb(' + colour.join(',') + ')';
	context.lineWidth = 1;
	context.beginPath();
	
	for (var i = 0; i < path.length; i++) {
		var point = path[i];
		var x = xscale(point.e(1));
		var y = yscale(point.e(2));
		context.lineTo(x, y);
	}	
	
	context.stroke();		

	// lines drawn, now do normals

	context.strokeStyle = 'rgba(' + colour.join(',') + ',0.25)';
	context.beginPath();
	for (var i = 1; i < path.length; i++) {
		var vl = 6; // normal tick length
		var p0 = path[i - 1];
		var p1 = path[i];
		var n = $V([p0.e(1) - p1.e(1), p0.e(2) - p1.e(2), 0]).cross($V([0, 0, 1])).toUnitVector();
		var x = xscale((p0.e(1) + p1.e(1)) / 2);
		var y = yscale((p0.e(2) + p1.e(2)) / 2);
		context.moveTo(x, y);
		context.lineTo(x + (n.e(1) * vl), y + (n.e(2) * vl));
	}	
	context.stroke();		
	
	if (1) {
		var sl = 4;																										// start vector length
		var al = 2;																										// arrow length
		var aa = 0.85;																								// arrow angle (2 = full rotation)
		var r = 2;																										// startpoint circle radius
		var p0 = path[0];																						// first point
		var p1 = path[1];																						// second point
		var v = p1.subtract(p0).toUnitVector();												// start vector
		var a1 = v.rotate(Math.PI * aa, $V([0, 0])).toUnitVector();		// arrow arm 1
		var a2 = v.rotate(Math.PI * -aa, $V([0, 0])).toUnitVector();	// arrow arm 2
		var x1 = xscale(p0.e(1));																			// start point
		var y1 = yscale(p0.e(2));
		var x2 = xscale(p0.e(1) + (v.e(1) * sl));											// start point + start vector
		var y2 = yscale(p0.e(2) + (v.e(2) * sl));

		// now draw path entry point and direction vector
		context.strokeStyle = 'rgba(' + colour.join(',') + ',0.5)';
		context.lineWidth = 2;
		context.beginPath();
		context.arc(x1, y1, r, 0, Math.PI * 2, true);
		context.moveTo(x1, y1);
		context.lineTo(x2, y2);
		context.stroke();

		if (1) {		
			// now draw direction vector arrows
			context.strokeStyle = 'rgba(' + colour.join(',') + ',0.5)';
			context.lineWidth = 0.75;
			context.beginPath();
			context.moveTo(x2, y2);
			context.lineTo(xscale(p0.e(1) + (v.e(1) * sl) + (a1.e(1) * al)), yscale(p0.e(2) + (v.e(2) * sl) + (a1.e(2) * al)));
			context.lineTo(xscale(p0.e(1) + (v.e(1) * sl) + (a2.e(1) * al)), yscale(p0.e(2) + (v.e(2) * sl) + (a2.e(2) * al)));
			context.lineTo(x2, y2);
			context.stroke();
		}
	}
}
