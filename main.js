
///////////
// Instagram
///////////
var Instagram = {
	CLIENT_ID: 'a90c4fd61c0c4d91be39b574b06fd562',
	FETCH_COUNT: 60,

	BASE_URL: 'https://api.instagram.com/v1',

	fetchTagMedia: function(tag, maxId) {
		var options = {
			type: 'tags',
			arg: tag,
			queries: []
		};

		if (maxId) {
			options.queries.push('MAX_TAG_ID=' + maxId);
		}

		return this.fetchMedia(options);
	},

	fetchUserMedia: function(userId, maxId) {
		var options = {
			type: 'users',
			arg: userId,
			queries: []
		};

		if (maxId) {
			options.queries.push('MAX_ID=' + maxId);
		}

		return this.fetchMedia(options);
	},

	fetchUser: function(username) {
		var url = this.BASE_URL;

		url += '/users/search';

		url += '?' + Util.buildQuery({
			client_id: this.CLIENT_ID,
			q: username
		});

		var promise = $.Deferred();

		$.ajax({
			type: 'GET',
			dataType: 'jsonp',
			url: url,

			success: function(data) {
				var users = data.data;
				for (var i = 0, len = users.length; i < len; i++) {
					var user = users[i];
					if (user.username === username) {
						promise.resolve(user);
						return;
					}
				}
				console.error('Couldn\'t find user with username', username);
				promise.reject();
			},
			error: function() {
				console.error('Error while fetching', url);
				promise.reject();
			}
		})

		return promise;
	},

	fetchMedia: function(options) {
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

	updateData: function(imageData) {
		this.currentImageIndex = -1;
		this.data = imageData.data;
		this.images = imageData.images;
		this.pagination = imageData.pagination;
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

				if (value === undefined || value === null) {
					return match;
				}
			}

			return value;
		});
	},

	getBrowserQuery: function(name) {
		if (!this._queries) {
			this._queries = {};

			var queryArr = window.location.search.substr(1).split('&');
			for (var i = 0, len = queryArr.length; i < len; i++) {
				var split = queryArr[i].split('=');
				this._queries[split[0]] = split[1] || true;
			}
		}

		return this._queries[name];
	},

	buildQuery: function(queries) {
		var arr = [];

		for (var q in queries) {
			if (!queries.hasOwnProperty(q)) continue;

			arr.push(q + '=' + queries[q]);
		}

		return arr.join('&');
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

		this.slideDuration = Util.getBrowserQuery('slideduration') || this.slideDuration;

		this.$next = null;
		this.$current = null;
	},

	updateImageData: function(imageData) {
		if (!this.imageData)  {
			this.imageData = imageData;
			this.startSlideshow();
		} else {
			this.imageData.updateData(imageData);
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

	refreshInterval: 5 * 60 * 1000,

	init: function() {
		this.$elem = $('#app');

		if (Util.getBrowserQuery('hashtag')) {
			this.hashtag = Util.getBrowserQuery('hashtag');
		}
		if (Util.getBrowserQuery('refreshinterval')) {
			this.refreshInterval = parseInt(Util.getBrowserQuery('refreshinterval'), 10) || this.refreshInterval;
		}

		Slideshow.init(this.$elem);

		this.bindEvents();

		this.fetchImageData();
		this.setupRefreshInterval();
		this.resize();
	},

	setupRefreshInterval: function() {
		this.refreshIntervalId = setInterval($.proxy(this.fetchImageData, this), this.refreshInterval);
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

	fetchImageData: function() {
		// Instagram.fetchTagMedia(this.hashtag).done($.proxy(this.imageDataUpdated, this));
		// Instagram.fetchUserMedia('9440393').done($.proxy(this.imageDataUpdated, this));
		var imageDataUpdated = $.proxy(this.imageDataUpdated, this);
		Instagram.fetchUser('snickapela').done(function(user) {
			Instagram.fetchUserMedia(user.id).done(imageDataUpdated);
		});
	},

	imageDataUpdated: function(imageData) {
		Slideshow.updateImageData(imageData);
	}
};


App.init();