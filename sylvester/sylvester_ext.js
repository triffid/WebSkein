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

Vector.prototype.positionAlong = function(p) {
	return this.dot(p) / Math.pow(this.modulus(), 2);
}

function Segment(v1, v2) { this.setVectors(v1, v2); }
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
		this.normal = this.direction.to3D().cross($V([0, 0, 1])).toUnitVector();
		while (this.normal.elements.length > this.v1.elements.length)
			this.normal.elements.pop();
		return this;
	}
};

Segment.create = function(v1, v2) {
	return new Segment(v1, v2);
};

function Triangle(v1, v2, v3, n) {
	this.setVectors(v1, v2, v3, n);
}
Triangle.prototype = {
	// find intersection with another plane, line, segment, vector
	intersectionWith: function(o) {
		if (this.plane.isParallelTo(o))
			return null;
		if (o.anchor) {
			if (o.v1) {
				// segment
				// a segment can intersect a triangle in a number of ways - it can pass through, in which case our result is simply a point, however if it's coplanar and intersecting, it may be larger than our triangle, or smaller, or start inside and end outside. in all these cases the result is a segment but we may have to handle them separately
				// TODO: check for coplanar segment
				// find if the segment's line intersects us
				var p = this.intersectionWith(o.line);
				// then get the segment to check if the intersection point is between its ends
				return o.intersectionWith(p);
			}
			else if (o.direction) {
				// line
				// TODO: check for coplanar line. if the line is coplanar and intersecting, we may return a segment.
				// first find if the line intersects our plane
				var p = this.plane.intersectionWith(o);
				if (!p) return null;
				// now work out if that point is inside our triangle. if it is, the cross product between it and each side will be parallel to our normal
				for (var i = 0; i < 3; i++) {
					// var c = p.subtract(this.v[i]).cross(this.s[i].direction);
					var c = this.s[i].direction.cross(p.subtract(this.v[i]));
					if (c.isAntiparallelTo(this.normal))
						return null;
				}
				// looks like it does intersect after all
				return p;
			}
			else if (o.normal) {
				// plane
				// there are 4 ways our triangle can intersect a plane- at 1 point, at two points, along a whole segment, or the whole triangle may be coincident with the plane. we should check the corners for coincidence first, then try to find an intersection
				var p = [];
				for (var i = 0; i < 3; i++) {
					var q = o.intersectionWith(this.v[i]);
					if (q)
						p.push(q);
				}
				if (p.length == 3)
					// entire triangle is coincident. return it as-is
					return this;
				if (p.length == 2)
					// we have one whole edge on the plane
					return new Segment(p[0], p[1]);
				if (p.length == 1);
					// we have one point on the plane. Either our triangle just touches the plane, or the plane cuts through the middle and intersects one corner and an edge. don't do anything yet!
				// now see if our edges intersect the plane
				var q = [];
				for (var i = 0; i < 3; i++) {
					var ip = this.s[i].intersectionWith(o);
					if (ip)
						q.push(ip);
				}
				if (q.length == 2)
					// the plane cuts through our triangle. return a segment
					return new Segment(q[0], q[1]);
				if (q.length == 3 && p.length == 1) {
					// the plane cuts through our triangle, intersecting one point and one edge (but all 3 edges show up as intersecting due to sharing the point)
					// work out which point is the odd one out
					for (var i = 0; i < 3; i++) {
						if (!q[i].eql(p[0]))
							return new Segment(q[i], p[0]);
					}
				}
				if (q.length == 0 && p.length == 1)
					// our triangle touches the plane only at one corner, return a point
					return p[0];
				// we do not intersect
				return null;
			}
		}
		else if (o.elements) {
			// vector- same as line above
			// first find if the line intersects our plane
			var p = this.plane.intersectionWith(line);
			if (!p) return null;
			// now work out if that point is inside our triangle. if it is, the cross product between it and each side will be parallel to our normal
			for (var i = 0; i < 3; i++) {
				var c = p.subtract(this.v[i]).cross(this.s[i].direction);
				if (c.isAntiparallelTo(this.normal))
					return null;
			}
			// looks like it does intersect after all
			return p;
		}
		return null;
	},
	setVectors: function(v1, v2, v3, n) {
		v1 = Vector.create(v1);
		v2 = Vector.create(v2);
		v3 = Vector.create(v3);
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
		
		this.v1 = v1;
		this.v2 = v2;
		this.v3 = v3;
		this.s1 = s1;
		this.s2 = s2;
		this.s3 = s3;
		this.v = [v1, v2, v3];
		this.s = [s1, s2, s3];
		this.anchor = v1;	// picked at random, doesn't really matter which point we use. ideally, we'd find the center of the triangle, but why bother?
		this.normal = n;
		this.plane = $P(this.anchor, this.normal);
	}
};

Triangle.create = function(v1, v2, v3, n) {
	return new Triangle(v1, v2, v3, n);
};
