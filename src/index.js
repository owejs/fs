"use strict";

var owe = require("owe-core"),
	path = require("path"),
	querystring = require("querystring"),
	send = require("send");

function oweFs(options) {

	return owe({}, function router() {
		return this.value;
	}, function closer(data) {
		var isHttp = this.origin.type === "http",
			request = isHttp ? this.origin.request : {
				headers: {}
			},
			url = this.location.map(querystring.escape.bind(querystring)).join("/"),
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

		return owe.resource(stream, {
			type: "file",
			stream: true
		});
	});
}

oweFs.api = function(options) {
	return owe.api(oweFs(options));
};

module.exports = oweFs;
