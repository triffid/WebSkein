// constructor for numeric values bound to input fields
function boundValue(inputElement, defaultValue, min, max, integer) {
	var self = this;

	this.input = $(inputElement);
	this.defaultValue = defaultValue;
	this.value = undefined;
	this.normalBackground = this.input.style.backgroundColor;
	this.lastValidValue = defaultValue;
	this.max = max;
	this.min = min;
	this.integer = integer;

	this.input.observe('blur', function(e) {
		try {
			self.set(this.value);
			this.style.backgroundColor = self.normalBackground;
		}
		catch (e) {
			self.normalBackground = this.style.backgroundColor;
			this.style.backgroundColor = 'orange';
			alert(e);
			this.value = self.lastValidValue;
			this.focus();
		}
	});

	this.input.observe('change', function(e) {
		this.style.backgroundColor = self.normalBackground;
	});

	this.checkValue = function(newvalue) {
		if (!isNaN(newvalue) && isFinite(newvalue)) {
			if (!isNaN(self.max) && newvalue > self.max) {
				// throw "value too large, " + newvalue + " > " + self.max;
				newvalue = self.max;
			}
			if (!isNaN(self.min) && newvalue < self.min) {
				// throw "value too large, " + newvalue + " > " + self.max;
				newvalue = self.min;
			}
			if (integer)
				newvalue = parseInt(newvalue);
			else
				newvalue = parseFloat(newvalue);
			return newvalue;
		}
		else
			throw newvalue + " is not numeric!";
	}

	this.set = function(newvalue) {
		newvalue = self.checkValue(newvalue);
		self.value = newvalue
		self.input.value = newvalue;
		self.lastValidValue = newvalue;
	};

	this.setMin = function(newvalue) {
		self.min = self.checkValue(newvalue);
		self.set(self.value);
	}

	this.setMax = function(newvalue) {
		self.max = self.checkValue(newvalue);
		self.set(self.value);
	}

	this.toString = function() {
		return this.get();
	};

	this.set(this.defaultValue);
}
