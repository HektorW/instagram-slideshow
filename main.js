
///////////
// Instagram
///////////
var Instagram = {
	CLIENT_ID: 'a90c4fd61c0c4d91be39b574b06fd562',
	FETCH_COUNT: 60,

	BASE_URL: 'https://api.instagram.com/v1',

	fetchTag: function(tag, maxId) {
		var options = {
			type: 'tags',
			arg: tag,
			queries: []
		};

		if (maxId) {
			options.queries.push('MAX_TAG_ID=' + maxId);
		}

		return this.fetch(options);
	},

	fetch: function(options) {
		var url = this.BASE_URL;

		url += '/' + options.type;
		url += '/' + options.arg;

		url += '/media/recent';

		options.queries = options.queries || [];

		options.queries.push('client_id=' + this.CLIENT_ID);
		options.queries.push('count=' + this.FETCH_COUNT);

		url += '?' + options.queries.join('&');

		var promise = $.Deferred();

		var $xhr = $.ajax({
			type: 'GET',
			url: url,
			dataType: 'jsonp',

			success: function(data) {
				promise.resolve(new ImageData(data));
			},
			error: function() {
				console.error('Error while fetching', url);
				promise.reject();
			}
		});

		return promise;
	}
};



///////////
// ImageData
///////////
function ImageData(data) {
	this.setData(data);
}
ImageData.prototype = {
	setData: function(data) {
		this.currentImageIndex = -1;

		this.data = data;

		this.images = data.data;
		this.pagination = data.pagination;
	},

	updateData: function(data) {
		this.setData(data);
	},

	nextImage: function() {
		this.currentImageIndex = ++this.currentImageIndex % this.images.length;

		return this.images[this.currentImageIndex];
	}
};




///////////
// Util
///////////
var Util = {
	templateReplace: function(template, data) {
		var pattern = /\{\{([\w\.\d]+)\}\}/g;
		return template.replace(pattern, function(match, group1) {
			var keys = group1.split('.');
			var value = data;

			for (var i = 0, len = keys.length; i < len; i++) {
				value = value[keys[i]];

				if (typeof value === 'undefined') {
					return match;
				}
			}

			return value;
		});
	},

	getQuery: function(name) {
		if (!this._queries) {
			this._queries = {};

			var queryArr = window.location.search.substr(1).split('&');
			for (var i = 0, len = queryArr.length; i < len; i++) {
				var split = queryArr[i].split('=');
				this._queries[split[0]] = split[1] || true;
			}
		}

		return this._queries[name];
	}
}



///////////
// Slideshow
///////////
var Slideshow = {
	imageData: null,
	animating: false,
	animationDuration: 4000,
	slideDuration: 10000,

	init: function($container) {
		this.$container = $container;

		this.imageTemplate = $('[data-image-template]').get(0).innerHTML;

		this.slideDuration = Util.getQuery('slideduration') || this.slideDuration;

		this.$next = null;
		this.$current = null;
	},

	updateImageData: function(imageData) {
		if (!this.imageData)  {
			this.imageData = imageData;
			this.startSlideshow();
		} else {
			this.imageData.update(imageData);
		}
	},

	startSlideshow: function() {
		this.$current = this.renderImage(this.imageData.nextImage());
		this.$container.append(this.$current);
		
		this.prepareNext();
		this.scheduleNextSlide();
	},

	scheduleNextSlide: function() {
		this._timeoutId = setTimeout($.proxy(this.showNext, this), this.slideDuration);
	},


	showNext: function() {
		if (this.animating) {
			return;
		}

		this.$current.addClass('animate-out');
		this.$next.removeClass('pending').addClass('animate-in');

		setTimeout($.proxy(this.afterNextAnimation, this), this.animationDuration);

		this.animating = true;
	},

	afterNextAnimation: function() {
		this.animating = false;

		this.$next.removeClass('animate-in');

		this.$current.remove();
		this.$current = this.$next;

		this.prepareNext();
		this.scheduleNextSlide();
	},

	prepareNext: function() {
		this.$next = this.renderImage(this.imageData.nextImage());
		this.$next.addClass('pending');
		this.$container.append(this.$next);
	},


	renderImage: function(image) {
		var templateStr = this.imageTemplate;
		var resStr = Util.templateReplace(templateStr, image);

		var $image = $(resStr);

		return $image;
	}
};







///////////
// App
///////////
var App = {
	hashtag: 'dlbi',

	$elem: null,
	imageTemplate: null,

	init: function() {
		this.$elem = $('#app');

		if (Util.getQuery('hashtag')) {
			this.hashtag = Util.getQuery('hashtag');
		}

		Slideshow.init(this.$elem);

		this.bindEvents();

		Instagram.fetchTag(this.hashtag).done($.proxy(this.imageDataUpdated, this));

		this.resize();
	},

	bindEvents: function() {
		$(window).resize($.proxy(this.resize, this));
	},

	resize: function() {
		var size = window.innerWidth > window.innerHeight ? window.innerHeight : window.innerWidth;
		var margin = 10;
		size -= margin * 2;

		this.$elem.css({
			width: size,
			height: size
		});
	},

	imageDataUpdated: function(imageData) {
		Slideshow.updateImageData(imageData);
	}
};


App.init();