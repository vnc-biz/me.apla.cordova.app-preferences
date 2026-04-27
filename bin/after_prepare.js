'use strict';

module.exports = function (context) {
	var path = require('path'),
		fs = require('fs'),
		ET = require('elementtree');

	var appSettingsPath = path.join(context.opts.projectRoot, 'app-settings.json');

	if (!fs.existsSync(appSettingsPath)) {
		console.log("app-settings.json not found: skipping app-preferences build");
		return Promise.resolve();
	}

	var settings;
	try {
		settings = JSON.parse(fs.readFileSync(appSettingsPath, 'utf8'));
	} catch (e) {
		console.log("app-settings.json parse error: skipping app-preferences build");
		return Promise.resolve();
	}

	var promises = context.opts.platforms
		.filter(function (p) { return p === 'android'; })
		.map(function () {
			return require('./lib/android')(context).build(settings);
		});

	return Promise.all(promises).catch(function (err) {
		if (err && err.code === 'NEXIST') {
			console.log("Platform not found: skipping app-preferences build");
			return;
		}
		throw err;
	});
};
