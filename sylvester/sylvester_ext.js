if (!Sylvester)
	throw 'Sylvester not found! Please load sylvester.js before this file';

Vector.prototype.toString = function() {
	var r = "[";
	for (var i = 0; i < this.elements.length; i++) {
		if (i > 0)
			r += ",";
		r += this.elements[i].toFixed(2);
	}
	return r + "]";
};
Matrix.prototype.toString = Matrix.prototype.inspect;
Line.prototype.toString = function() {
	return "{" + this.anchor + "->" + this.direction + "}";
};
Plane.prototype.toString = function() {
	return "{" + this.anchor + ",n" + this.normal + "}";
};

function Segment() {}
Segment.prototype = {
	// check if an object lives in the same space as this segment
	// if o is a segment, check if we have the same endpoints (and direction)
	// otherwise, pass through to contains
	eql: function(o) {
		// segment
		if (o.v1)
			if (o.v1.eql(this.v1) && o.v2.eql(this.v2)) return true;
		// line or plane
		if (o.anchor)
			if (this.contains(o.anchor)) return true;
		// vector
		return this.contains(o);
	},

	// return a copy
	dup: function() {
		return Segment.create(this.v1, this.v2);
	},
	
	// returns true iff argument is a point in this segment
	contains: function(o) {
		if (!this.line.contains(o))
			return null;

		// utility function- check if b is between a and c (inclusive)
		function between_inc(a, b, c) {
			if (a >= c) { return (a >= b) && (b >= c); }
			else				{ return (a <= b) && (b <= c); }
		};
		
		// point is on our line, now check if it's within our segment
		if (between_inc(this.v1.elements[0], o.elements[0], this.v2.elements[0]) && 
				between_inc(this.v1.elements[1], o.elements[1], this.v2.elements[1]) && 
				between_inc(this.v1.elements[2], o.elements[2], this.v2.elements[2]))
			return true;
		return null;
	},
	
	isParallelTo: function(o) {
		return this.line.isParallelTo(o);
	},
	
	// find intersection with another plane, line, segment, vector
	intersectionWith: function(o) {
		if (this.isParallelTo(o))
			return null;
		if (o.anchor) {
			if (o.v1) {
				// segment
				if (this.line.contains(o.line)) {
					// we're co-linear, find two intersecting points, make a new segment
					var l = [this.v1, this.v2, o.v1, o.v2];
					var r = [];
					for (var i = 0; i < l.length; i++) {
						if (this.contains(l[i]) && o.contains(l[i]))
							r.push(l[i]);
					}
					if (r.length == 4)
						// all 4 points fit- must be same segment
						return this.dup();
					else if (r.length == 3) {
						// if this happens, two of the points are the same
						if (r[0].eql(r[1]))
							return new Segment(r[0], r[2]);
						else
							return new Segment(r[0], r[1]);
					}
					else if (r.length == 2)
						// we have two points, make a new segment
						return new Segment(r[0], r[1]);
					else if (r.length == 1)
						// segments touch at their tips, return a point
						return r[0]
				}
				if (this.line.intersects(o.line)) {
					// lines cross, check that resulting point is within both segments
					var p = this.line.intersectionWith(o.line);
					if (this.contains(p) && o.contains(p))
						return p;
				}
			}
			else if (o.direction) {
				// line
				var p = o.intersectionWith(this.line);
				if (p)
					if (this.contains(p))
						return p;
			}
			else if (o.normal) {
				// plane
				if (this.line.liesIn(o))
					// whole segment is coplanar, return a copy
					return this.dup();
				// find intersection
				var p = o.intersectionWith(this.line);
				if (p)
					if (this.contains(p))
						return p
			}
		}
		else if (o.elements) {
			// we have a vector
			if (this.contains(o))
				return o;
		}
		return null;
	},
	
	translate: function(v) {
		return new Segment(this.v1.add(v), this.v2.add(v));
	},
	
	// set segment's anchor and endpoint, calculate direction etc
	setVectors: function(v1, v2) {
		v1 = Vector.create(v1);
		v2 = Vector.create(v2);
		while (v1.elements.length < 3) { v1.elements.push(0); }
		while (v2.elements.length < 3) { v2.elements.push(0); }
		var v3 = v2.subtract(v1);
		var mod = v3.modulus();
		if (mod == 0) { return null; }
		
		this.endpoint = v2;
		this.v1 = v1;
		this.v2 = v2;
		this.line = Line.create(v1,v2.subtract(v1));
		// supply anchor/direction so we can interact with other parts of sylvester
		this.anchor = this.line.anchor;
		this.direction = this.line.direction;
		return this;
	}
};

Segment.create = function(v1, v2) {
	var S = new Segment();
	return S.setVectors(v1, v2);
};

function Triangle() {}
Triangle.prototype = {
	setVectors: function(v1, v2, v3, n) {
		v1 = new Vector(v1);
		v2 = new Vector(v2);
		v3 = new Vector(v3);
		if (n)
			n = new Vector(n);
		if (v1.eql(v2) || v2.eql(v3) || v3.eql(v1))
			throw "triangle with zero area!"
		var s1 = new Segment(v1, v2);
		var s2 = new Segment(v2, v3);
		var s3 = new Segment(v3, v1);
		if (!n)
			n = s1.direction.cross(s2.direction).toUnitVector();
		if (!s1.direction.cross(s2.direction).toUnitVector().eql(n) ||
				!s2.direction.cross(s3.direction).toUnitVector().eql(n) ||
				!s3.direction.cross(s1.direction).toUnitVector().eql(n))
			throw "bad normal!"
	}
};

Triangle.create = function(v1, v2, v3, n) {
	
};
