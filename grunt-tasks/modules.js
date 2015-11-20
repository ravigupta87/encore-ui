var path = require('path');
var _ = require('lodash');

module.exports = function (grunt) {
    var markdown = require('marked');

    function enquote (str) {
        return '\'' + str + '\'';
    }

    //Common encore.ui module containing all modules for src and templates
    //findModule: Adds a given module to config
    function findModule (category, name) {
        if (_.isUndefined(name)) {
            return;
        }

        function parseMarkdown (text) {
            return markdown(text);
        }

        var globBase = ['src', category, name].join('/');
        var _srcFiles = grunt.file.expand([
            globBase + '/' + name + '.module.js', // (NEW Manifest) Must load first ('src/components' only)
            globBase + '/scripts/!(*.spec|*.page|*.exercise).js' // Load additional scripts
        ]);
        var _tplFiles = grunt.file.expand([ globBase + '/*.tpl.html' ]);
        var _tplJsFiles = grunt.file.expand([ 'templates/' + name + '/templates/*.html' ]);
        var _docMdFiles = grunt.file.expand(globBase + '/*.md');
        var _docJsFiles = grunt.file.expand(globBase + '/docs/!(*.midway).js');
        var _docHtmlFiles = grunt.file.expand(globBase + '/docs/*.html');
        var _docLessFiles = grunt.file.expand(globBase + '/*.less');
        var _docMidwayFiles = grunt.file.expand(globBase + '/docs/*.midway.js');
        var _docExerciseFiles = grunt.file.expand(globBase + '/**/*.exercise.js');

        // Fetch Module Metadata
        var metadataJson = globBase + '/' + name + '.meta.json';
        var metadata = {};
        if (grunt.file.exists(metadataJson)) {
            metadata = grunt.file.readJSON(metadataJson);
        }

        // Using Metadata as a base, add on additional information
        var module = _.defaults(metadata, {
            name: name,
            moduleName: enquote('encore.ui.' + name),
            category: category,
            description: '',
            stability: 'experimental', // should be set by <module>.meta.json
            keywords: [], // should be set by <module>.meta.json
            displayName: name, // should be set by <module>.meta.json
            srcFiles: _srcFiles,
            tplFiles: _tplFiles,
            tplJsFiles: _tplJsFiles,
            docs: { // TODO: replace with <rx-example>
                md: _docMdFiles.map(grunt.file.read).map(parseMarkdown).join('\n'),
                js: _docJsFiles.map(grunt.file.read).join('\n'),
                html: _docHtmlFiles.map(grunt.file.read).join('\n'),
                less: _docLessFiles.map(grunt.file.read).join('\n'),
                midway: [
                    _docMidwayFiles.map(grunt.file.read).join('\n') +
                        '// this component\'s exercise.js file, if it exists, is below\n' +
                        _docExerciseFiles.map(grunt.file.read).join('\n')
                ].join('\n')
            }
        });

        grunt.config('config.modules', grunt.config('config.modules').concat(module));
    }//findModule

    grunt.registerTask('modules', 'Auto-discover EncoreUI modules and load their details into config', function () {
        // Iterate over source modules to build config.modules
        grunt.file
            .expand({ cwd: 'src/' }, '**/*.module.js')
            .forEach(function (modPath) {
                var pathArr = modPath.split('/');

                // accounts for src/:category/:module/<module>.module.js
                var category = pathArr[0];
                var mod = pathArr[1];

                // account for src/:category/<category>.module.js
                var splitMod = mod.split('.');
                if (splitMod.length > 0) {
                    mod = splitMod[0];
                }

                findModule(category, mod);
            });

        /* sorted modules array for various filtering */
        var modules = _.sortBy(grunt.config('config.modules'), 'name');

        /* Fetch Atoms, Components, Molecules, and Quarks from all modules */
        grunt.config('config.atoms', _.filter(modules, { category: 'atoms' }));
        grunt.config('config.components', _.filter(modules, { category: 'components' }));
        grunt.config('config.molecules', _.filter(modules, { category: 'molecules' }));
        grunt.config('config.quarks', _.filter(modules, { category: 'quarks' }));

        /* Determine modules with source files */
        // used by config.meta.(modules|all)
        var jsModules = _.filter(modules, function (module) {
            return module.srcFiles.length > 0;
        });
        grunt.config('config.srcModules', _.pluck(jsModules, 'moduleName'));

        /* Determine modules with templates */
        // used by config.meta.tplmodules
        var tplModules = _.pluck(modules, 'tplJsFiles').filter(function (tpls) {
            return tpls.length > 0;
        });
        grunt.config('config.tplModules', tplModules.map(function (tpls) {
            // remove first two directories from template paths
            return tpls.map(function (tplPath) {
                var templatePath = tplPath.split(path.sep) // convert path string to array
                    .slice(2) // ignore first two directories
                    .join(path.sep); // convert back to path string

                // return a single-quoted string
                return enquote(templatePath);
            });
        }));

        //- used in grunt-tasks/phantomjs-checks.js
        //  - run via `grunt test:full` on TravisCI
        grunt.config('config.demoModules', grunt.config('config.components'));

        // Set the concat task to concatenate the given src modules
        var srcFiles = _.pluck(modules, 'srcFiles'); // OK
        grunt.config('concat.dist.src', grunt.config('concat.dist.src').concat(srcFiles));

        // Set the concat-with-templates task to concat the given src & tpl modules
        var tplJsFiles = _.pluck(modules, 'tplJsFiles'); // OK
        grunt.config('concat.distTpls.src', grunt.config('concat.distTpls.src').concat(srcFiles).concat(tplJsFiles));
    });
};
