'use strict';

module.exports = function (context) {
	var path = require('path'),
		fs = require('fs');

	var appSettingsPath = path.join(context.opts.projectRoot, 'app-settings.json');

	if (!fs.existsSync(appSettingsPath)) {
		console.log("app-settings.json not found: skipping before_plugin_uninstall");
		return Promise.resolve();
	}

	var android = require('./lib/android')(context);
	var settings;
	try {
		settings = JSON.parse(fs.readFileSync(appSettingsPath, 'utf8'));
	} catch (e) {
		return Promise.resolve();
	}

	return android.clean(settings).catch(function (err) {
		if (err && err.code === 'NEXIST') {
			console.log("Platform android not found: skipping");
			return;
		}
		throw err;
	});
};
