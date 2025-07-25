const path = require('path');
const { task, src, dest } = require('gulp');
const fs = require('fs');

task('build:icons', copyIcons);

function copyIcons() {
	const nodeSource = path.resolve('nodes', '**', '*.{png,svg}');
	const nodeDestination = path.resolve('dist', 'nodes');

	// Copy node icons - this is the main return value
	return src(nodeSource).pipe(dest(nodeDestination));
}
