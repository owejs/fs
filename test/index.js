"use strict";

var http = require("http"),
	owe = require("owe.js"),
	oweFs = require("../src"),
	oweHttp = require("owe-http");

http.createServer(oweHttp(oweFs.api({
	root: __dirname
}))).listen(5004);
