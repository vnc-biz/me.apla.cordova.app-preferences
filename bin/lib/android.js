'use strict';

var mappings = require('./mappings'),
	platformName = 'android';

module.exports = function (context) {
	var path = require('path'),
		fs = require('fs'),
		ET = require('elementtree');

	var projectRoot = context.opts.projectRoot;

	function getResPath() {
		// cordova-android 7+ uses app/src/main/res
		return Promise.resolve(
			path.join('platforms', 'android', 'app', 'src', 'main', 'res')
		);
	}

	function getJavaPath() {
		return Promise.resolve(
			path.join('platforms', 'android', 'app', 'src', 'main', 'java')
		);
	}

	function mapConfig(config) {
		var element = { attrs: {}, children: [] };

		if (!config.type) {
			throw new Error('no type defined for ' + JSON.stringify(config));
		}

		var mapping = mappings[config.type];
		if (!mapping) throw new Error('no mapping for ' + config.type);

		element.tagname = mapping[platformName];

		if (mapping.required) {
			mapping.required.forEach(function (k) {
				if (!(k in config)) {
					throw new Error(['attribute', k, 'not found for', config.title, '(' + config.type + ')'].join(' '));
				}
			});
		}

		if (mapping.attrs) {
			for (var attrName in mapping.attrs) {
				if (!config.hasOwnProperty(attrName)) continue;
				var attrConfig = mapping.attrs[attrName];
				var elementKey = attrConfig[platformName];
				var targetCheck = elementKey.split('@');
				var targetAttr;
				if (targetCheck.length === 2 && targetCheck[0] === '') {
					targetAttr = targetCheck[1];
					element.attrs[targetAttr] = [];
				}
				if (attrConfig.value) {
					if (!attrConfig.value[config[attrName]] || !attrConfig.value[config[attrName]][platformName])
						throw new Error('no mapping for type: ' + config.type + ', attr: ' + attrName + ', value: ' + config[attrName]);
					if (targetAttr)
						element.attrs[targetAttr].push(attrConfig.value[config[attrName]][platformName]);
					else
						element[elementKey] = attrConfig.value[config[attrName]][platformName];
				} else {
					if (targetAttr)
						element.attrs[targetAttr].push(config[attrName]);
					else
						element[elementKey] = config[attrName];
				}
			}
		}

		if (mapping.fixup && mapping.fixup[platformName]) {
			mapping.fixup[platformName](element, config, mapping);
		}

		return element;
	}

	function buildNode(parent, config, stringsArrays) {
		for (var attr in config.attrs) {
			if (config.attrs[attr] && config.attrs[attr].constructor === Array)
				config.attrs[attr] = config.attrs[attr].join('|');
		}
		var newNode = new ET.SubElement(parent, config.tagname);
		newNode.attrib = config.attrs;
		if (config.strings) stringsArrays.push(config.strings);
		if (config.children) {
			config.children.forEach(function (child) {
				buildNode(newNode, child, stringsArrays);
			});
		}
	}

	function buildSettings(configJson) {
		var screenNode = new ET.Element('PreferenceScreen'),
			resourcesNode = new ET.Element('resources'),
			stringsArrays = [];

		screenNode.set('xmlns:android', 'http://schemas.android.com/apk/res/android');

		configJson.forEach(function (preference) {
			var node = mapConfig(preference);
			if (preference.type === 'group' && preference.items && preference.items.length) {
				preference.items.forEach(function (childNode) {
					node.children.push(mapConfig(childNode));
				});
			}
			buildNode(screenNode, node, stringsArrays);
		});

		stringsArrays.forEach(function (stringsArray) {
			var titlesXml = new ET.SubElement(resourcesNode, 'string-array'),
				valuesXml = new ET.SubElement(resourcesNode, 'string-array');
			titlesXml.set('name', 'apppreferences_' + stringsArray.name);
			valuesXml.set('name', 'apppreferences_' + stringsArray.name + 'Values');
			for (var i = 0, l = stringsArray.titles.length; i < l; i++) {
				var titleItemXml = new ET.SubElement(titlesXml, 'item'),
					valueItemXml = new ET.SubElement(valuesXml, 'item');
				titleItemXml.text = stringsArray.titles[i];
				valueItemXml.text = stringsArray.values[i];
			}
		});

		return {
			preferencesDocument: new ET.ElementTree(screenNode),
			preferencesStringDocument: new ET.ElementTree(resourcesNode)
		};
	}

	function mkdirp(dir) {
		var abs = path.resolve(projectRoot, dir);
		if (!fs.existsSync(abs)) fs.mkdirSync(abs, { recursive: true });
	}

	function build(config) {
		return getResPath().then(function (pathRes) {
			var docs = buildSettings(config);
			var pathXml = path.join(pathRes, 'xml');
			var pathValues = path.join(pathRes, 'values');
			mkdirp(pathXml);
			mkdirp(pathValues);
			fs.writeFileSync(path.resolve(projectRoot, pathXml, 'apppreferences.xml'), docs.preferencesDocument.write());
			fs.writeFileSync(path.resolve(projectRoot, pathValues, 'apppreferences.xml'), docs.preferencesStringDocument.write());
			console.log('android preferences file was successfully generated');
		}).catch(function (err) {
			if (err && err.code === 'NEXIST') {
				console.log('Platform android not found: skipping');
				return;
			}
			throw err;
		});
	}

	function afterPluginInstall() {
		return Promise.resolve();
	}

	function clean() {
		return Promise.resolve();
	}

	return { mapConfig, buildSettings, build, afterPluginInstall, clean };
};
