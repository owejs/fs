"use strict";

const owe = require("owe-core");
const path = require("path");
const querystring = require("querystring");
const stream = require("stream");
const fs = require("fs");
const send = require("send");

function oweFs(options) {

	if(typeof options !== "object" || options === null)
		options = {};

	options = Object.create(options);

	options.onError = options.onError || (err => err);

	function streamGenerator(isHttp, request, url, headerObject) {
		const fileStream = send(isHttp ? request : {
			headers: {}
		}, url, options);
		const resultResource = {
			file: true,
			stream: true
		};

		let resultStream = fileStream;

		if(!headerObject)
			headerObject = {};

		if(!isHttp) {

			const passThroughHeader = Object.create(headerObject);
			const resultHeader = Object.create(headerObject);
			const passThroughStream = fakeDestination(new stream.PassThrough(), passThroughHeader);

			let choseFileStream;

			resultStream = fakeDestination(new stream.PassThrough(), resultHeader);

			fileStream.on("error", err => {
				if(choseFileStream !== false)
					resultStream.emit("error", err);
			});

			fileStream.on("stream", () => {
				if(choseFileStream !== false)
					resultResource.contentType = passThroughHeader["Content-Type"];
			});

			fileStream.on("file", () => {
				choseFileStream = true;
				passThroughStream.pipe(resultStream);
			});

			fileStream.on("directory", function() {
				const redirectStream = send({
					headers: {}
				}, url + "/", options);

				redirectStream.on("stream", () => {
					resultResource.contentType = resultHeader["Content-Type"];
				});

				redirectStream.on("error", err => {
					resultStream.emit("error", err);
				});

				choseFileStream = false;
				redirectStream.pipe(resultStream);
			});

			fileStream.pipe(passThroughStream);
		}

		const oldAdder = resultStream.addListener.bind(resultStream);

		resultStream.addListener = resultStream.on = function(event, listener) {

			let usedListener = listener;

			if(event === "error")
				usedListener = function onError(err) {
					return listener.call(resultStream, options.onError(err, isHttp));
				};

			return oldAdder(event, usedListener);
		};

		return owe.resource(resultStream, resultResource);
	}

	function servedFs(path, asPromise) {
		const headers = {};
		const sendStream = streamGenerator(false, null, path, headers);

		if(!asPromise)
			return sendStream;

		return new Promise((resolve, reject) => {
			const result = [];

			sendStream.once("error", err => reject(err));

			sendStream.on("end", () => {
				resolve(owe.resource(Buffer.concat(result), {
					file: true,
					contentType: owe.resource(sendStream).contentType
				}));
			});

			sendStream.on("data", data => result.push(data));

		});
	}

	const result = owe(servedFs, function router() {
			return this.value;
		}, function closer(data) {
			return streamGenerator(this.origin.http, this.origin.request, this.location.map(querystring.escape.bind(querystring)).join("/"));
		});

	let api;

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

	destination._headers = headerObject || {}; // jscs: ignore disallowDanglingUnderscores
	destination.setHeader = headerObject ? (header, val) => {
		headerObject[header] = val;
	} : function() {};
	destination.finished = false;
	destination.removeHeader = function() {};
	destination.getHeader = function() {};

	return destination;
}

module.exports = oweFs;
