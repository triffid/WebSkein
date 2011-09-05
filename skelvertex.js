function skelVertex(v) {
	this.vector = v.dup();
	this.nextV = null;
	this.prevV = null;
	this.nextSeg = null;
	this.prevSeg = null
	this.bisector = null;
	this.startTime = 0;
	this.crashTime = null;
	this.crashSV = null;
	this.isReflex = false;
	this.alive = true;
}
skelVertex.prototype = {
	setNextV: function(sv) {
		this.nextV = sv;
		sv.prevV = this;
		this.nextSeg = new Segment(this.vector, sv.vector);
		if (this.nextSeg == null || !this.nextSeg.v1)
			throw "segment creation failed!"
		this.nextSeg.nextV = sv;
		this.nextSeg.prevV = this;
		sv.prevSeg = this.nextSeg;
		if (sv.nextV)
			this.nextV.recalculateBisector();
		if (this.prevV)
			this.recalculateBisector();
	},
	setPrevV: function(sv) {
		this.prevV = sv;
		sv.nextV = this;
		this.prevSeg = new Segment(sv.vector, this.vector);
		if (this.prevSeg == null || !this.prevSeg.v1)
			throw "segment creation failed!"
		this.prevSeg.nextV = this;
		this.prevSeg.prevV = sv;
		sv.nextSeg = this.prevSeg;
		if (sv.prevV)
			this.prevV.recalculateBisector();
		if (this.nextV)
			this.recalculateBisector();
	},
	translate: function(v) {
		this.vector = this.vector.add(v);
		if (this.nextV) {
			this.nextSeg.setVectors(this.vector, this.nextV.vector);
			this.nextV.recalculateBisector();
		}
		if (this.prevV) {
			this.prevSeg.setVectors(this.prevV.vector, this.vector);
			this.prevV.recalculateBisector();
		}
		if (this.nextSeg && this.prevSeg)
			this.recalculateBisector();
	},
	recalculateBisector: function() {
		if ((this.nextSeg == null) || (this.prevSeg == null)) {
			this.bisector = null;
			return;
		}
		var ns = this.nextSeg.translate(this.nextSeg.normal);
		var ps = this.prevSeg.translate(this.prevSeg.normal);
		var ip = ns.line.intersectionWith(ps.line);
		if (ip) {
			ip.elements.length = this.vector.elements.length;
			this.bisector = ip.subtract(this.vector);
		}
		else if (this.nextV.vector.eql(this.prevV.vector)) {
			// next and prev points are the same point
			this.bisector = this.nextV.vector.subtract(this.vector);
		}
		else {
			// next and prev segments are parallel or anti-parallel
			this.bisector = $V([this.nextSeg.normal.p(1), this.nextSeg.normal.p(2)]);
		}
		
		var a = Math.atan2(this.nextSeg.direction.e(2), this.nextSeg.direction.e(1)) - Math.atan2(-this.prevSeg.direction.e(2), -this.prevSeg.direction.e(1));
		if (a < 0)
			a += Math.PI * 2;
		if (a > Math.PI)
			this.isReflex = true;
		else
			this.isReflex = false;
	},
	positionAtTime: function(t) {
		if (this.crashTime == null)
			return null;
		if (this.bisector == null)
			return null;
		var delta = t - this.startTime;
		return this.vector.add(this.bisector.multiply(delta));
	}
};
