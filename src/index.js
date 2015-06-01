"use strict";

var owe = require("owe-core"),
	path = require("path"),
	send = require("send");

function fs(options) {

	return {
		router() {
			return this.value;
		},
		closer(data) {
			var isHttp = this.origin.type === "http",
				request = isHttp ? this.origin.request : {
					headers: {}
				},
				url = path.join.apply(path, this.location),
				stream = send(request, url, options);

			if(!isHttp) {

				let pipe = stream.pipe.bind(stream);

				stream.pipe = function pipe(destination) {
					destination = Object.create(destination);

					destination._headers = {};
					destination.setHeader = destination.removeHeader = function() {};

					pipe(destination);
				};
			}

			return stream;
		}
	};
}

module.exports = fs;
