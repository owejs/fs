"use strict";

var owe = require("owe-core"),
	path = require("path"),
	querystring = require("querystring"),
	stream = require("stream"),
	fs = require("fs"),
	send = require("send");

function oweFs(options) {

	if(typeof options !== "object" || options === null)
		options = {};

	options = Object.create(options);

	options.onError = options.onError || function(err) {
		return err;
	};

	function streamGenerator(isHttp, request, url, headerObject) {
		var fileStream = send(isHttp ? request : {
				headers: {}
			}, url, options),
			resultStream = fileStream;

		if(!isHttp) {
			var passThroughStream = fakeDestination(new stream.PassThrough(), headerObject),
				choseFileStream;

			resultStream = fakeDestination(new stream.PassThrough(), headerObject);

			fileStream.on("error", function(err) {
				if(choseFileStream === undefined)
					resultStream.emit("error", err);
				else
					passThroughStream.emit("error", err);
			});

			fileStream.on("file", function() {

				passThroughStream.on("error", function(err) {
					resultStream.emit("error", err);
				});

				choseFileStream = true;
				passThroughStream.pipe(resultStream);
			});

			fileStream.on("directory", function() {
				var redirectStream = send({
					headers: {}
				}, url + "/", options);

				redirectStream.on("error", function(err) {
					resultStream.emit("error", err);
				});

				choseFileStream = false;
				redirectStream.pipe(resultStream);
			});

			fileStream.pipe(passThroughStream);
		}

		var oldAdder = resultStream.addListener.bind(resultStream);

		resultStream.addListener = resultStream.on = function(event, listener) {

			var usedListener = listener;

			if(event === "error")
				usedListener = function onError(err) {
					return listener.call(resultStream, options.onError(err, isHttp));
				};

			return oldAdder(event, usedListener);
		};

		return owe.resource(resultStream, {
			file: true,
			stream: true
		});
	}

	function servedFs(path, asPromise) {
		var headers = {},
			sendStream = streamGenerator(false, null, path, headers);

		if(!asPromise)
			return sendStream;

		return new Promise(function(resolve, reject) {
			var result = [];

			sendStream.once("error", function(err) {
				reject(err);
			});

			sendStream.on("end", function() {
				resolve(owe.resource(Buffer.concat(result), {
					file: true
				}));
			});

			sendStream.on("data", function(data) {
				result.push(data);
			});

		});
	}

	var result = owe(servedFs, function router() {
			return this.value;
		}, function closer(data) {
			return streamGenerator(this.origin.http, this.origin.request, this.location.map(querystring.escape.bind(querystring)).join("/"));
		}),
		api;

	Object.defineProperty(servedFs, "api", {
		enumerable: false,
		configurable: false,
		get() {
			return api || (api = owe.api(result));
		}
	});

	return result;
}

oweFs.api = function(options) {
	return owe.api(oweFs(options));
};

function fakeDestination(destination, headerObject, clone) {
	destination = clone ? Object.create(destination) : destination;

	destination._headers = headerObject || {};
	destination.setHeader = headerObject ? function(header, val) {
		headerObject[header] = val;
	} : function() {};
	destination.finished = false;
	destination.removeHeader = function() {};
	destination.getHeader = function() {};

	return destination;
}

module.exports = oweFs;
