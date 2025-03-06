# Overview of Export Helpers

The build for this should be extremely simple and boils down to commonjs
needing to use `module.exports` and modulejs needing to use the `export`
keyword.

So the primary source code does no exporting of content, when the build
script is invoked, a copy of the primary source file with the appended
common.js file contents are placed into the dist directory with a .js
file extension. Additionally, a copy of the source with the appended
contents of the module.js file contents are saved in the dist directory
with a .mjs extension.

Now both systems paradigms are met