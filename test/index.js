"use strict";

const http = require("http");
const owe = require("owe.js");
const oweFs = require("../src");
const oweHttp = require("owe-http");

const fs = oweFs({
	root: __dirname,
	onError(err, isHttp) {
		if(!isHttp)
			return err;

		console.error(err);

		return `<h1>Error ${err.status}</h1>`;
	}
});

fs("derp", true).then(res => {
	console.log(String(res));
	console.log(owe.resource(res));
}, err => console.error(err));

http.createServer(
	oweHttp(
		owe.api(fs)
	)
).listen(5004);
