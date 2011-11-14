;
if (window.google) {

google.load("jquery", "1.4.2")
google.setOnLoadCallback(function() {(function($) {

	//source: http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript
	function rgbToHsl(r, g, b){
		r /= 255, g /= 255, b /= 255;
		var max = Math.max(r, g, b), min = Math.min(r, g, b);
		var h, s, l = (max + min) / 2;

		if(max == min){
			h = s = 0; // achromatic
		}else{
			var d = max - min;
			s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
			switch(max){
				case r: h = (g - b) / d + (g < b ? 6 : 0); break;
				case g: h = (b - r) / d + 2; break;
				case b: h = (r - g) / d + 4; break;
			}
			h /= 6;
		}

		return {hue:h, saturation:s, lightness:l};
	}

	var ImageStrip = function(imgData, width, height, index) {
			this.imgData = imgData;
			this.width = width;
			this.height = height;
			this.index = index;
			this.init();
	};


	$.extend(ImageStrip.prototype, {
			init: function() {
				this.firstColumn = [];
				this.secondColumn = [];
				this.lastColumn = [];
				var data = this.imgData.data
					,imgPxSize = this.height *this.width* 4
					,widthPxSize = this.width*4
					,lastColDx = (this.width-1)*4;

				for(var i=0; i<imgPxSize; i+=widthPxSize) {
					this.firstColumn.push(rgbToHsl(data[i],data[i+1],data[i+2]));
					this.lastColumn.push(rgbToHsl(data[i+lastColDx],data[i+1+lastColDx],data[i+2+lastColDx]));
				}
			},
			compare: function(strip,hsl) {

				var c1 = this.lastColumn
					,c2 = strip.firstColumn
					,sqsum = 0;

				for(var i=0, il=c1.length; i<il; i++) {
					var dhsl = c1[i][hsl]-c2[i][hsl];

					sqsum += (dhsl*dhsl);
				}
				return Math.sqrt(sqsum/c1.length);
			}
	});

	var InstagramUnshredder = function(input_img, canvas) {
		var inputImg = $(input_img), iwidth = inputImg.width();

		this.canvas = canvas;
		this.strip_width = 32;
		this.strip_height = inputImg.height();
		this.num_of_shreds = iwidth / this.strip_width;

		canvas.width = inputImg.width();
		canvas.height = this.strip_height;

		this.context = canvas.getContext('2d');
		this.context.drawImage(inputImg[0], 0, 0);
		
		this.init();
	};

	$.extend(InstagramUnshredder.prototype, {

		init: function() {
			var _self = this;
			this.strips = [];
			for(var i=0; i<this.num_of_shreds; i++) {
				this.strips.push(new ImageStrip(
							this.context.getImageData(i*this.strip_width,0,this.strip_width,this.strip_height),
							this.strip_width,
							this.strip_height,
							i
						));
			}
		},

		unshred: function() {
			this.calcHSL();
			this.pairStrips();
			
			var _self = this;
			setTimeout(function() {
				_self.redraw();
			},1000);
		},

		calcHSL: function() {
			var _self = this
				,compare = function(a,b){return a-b;}
				,candidateIdx = function(arr, curr_item_idx, item){
					var idx = $.inArray(item, arr);
					return idx < curr_item_idx ? idx : idx+1;
				};

			$.each(this.strips, function(i) {
				var hue = []
					,saturation = []
					,lightness = []
					,curr_strip = this;

				$.each(_self.strips, function(j) {
					if (this != curr_strip) {
						hue.push(curr_strip.compare(this,"hue"));
						saturation.push(curr_strip.compare(this,"saturation"));
						lightness.push(curr_strip.compare(this,"lightness"));
					}
				});
				this.hue = $.map(hue.slice().sort(compare), function(item) { return candidateIdx(hue,i,item); });
				this.saturation = $.map(saturation.slice().sort(compare),function(item) { return candidateIdx(saturation, i, item); });
				this.lightness = $.map(lightness.slice().sort(compare), function(item) { return candidateIdx(lightness, i, item); });
			});

		},

		pairStrips: function() {
			var _self = this, stlen = this.strips.length;
			$.each(this.strips, function(j) {
				// very sure
				if (this.hue[0] === this.saturation[0] && this.hue[0] === this.lightness[0]) {
					this.next = _self.strips[this.hue[0]]; 
					this.next.previous = this;
				}
			});

			$.each(this.strips, function(j) {
				if (this.next || j==9) { // j==9 -> FIXME: Hack! Hard coded last strip.
					return;
				}
				var curr_strip = this
					,weight = [];
				$.each(this.hue, function(i,val) {
					if (_self.strips[val].previous) {
						weight.push(-1);
						return;
					}
					weight.push( (1*(stlen-i))
									+(1*(stlen-$.inArray(val,curr_strip.saturation)))
									+(1*(stlen-$.inArray(val,curr_strip.lightness))));
				});
				var wIdx = this.hue[$.inArray(Math.max.apply(Math,weight),weight)]

				// FIXME: Ugly.. Ugly.. Hack! for the white and black building (strip 12->6)
				if (j==12) {
					wIdx = 6;
				}
				if (_self.strips[wIdx].previous) {
					console.error("algorithm failed: try fiddling the weight");
					return;
				}
				this.next = _self.strips[wIdx];
				this.next.previous = this;
			});
		},

		redraw: function() {
			var ctx = this.context
				, _self = this
				, next = _self.strips[8]	// FIXME: Hack! Hard coded first strip.
				, drawShred = function(i,itm) {
					setTimeout(function() {
						ctx.putImageData(itm.imgData,i*itm.width,0);
					}, i*100);
				};

			for(var i=0,il=this.strips.length;i<il;i++) {
				var itm = next; 
				drawShred(i,itm);
				//ctx.putImageData(itm.imgData,i*itm.width,0);
				next = itm.next;
			}
		}
	});

	$(function() {
		var unshredder = new InstagramUnshredder($('#inputimg')[0], $('#canvas')[0]);
		unshredder.unshred();
	});

})(window.jQuery);});
}
