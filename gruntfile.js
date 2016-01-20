/*!
 * Ratchet's Gruntfile
 * http://goratchet.com
 * Copyright 2014 Connor Sears
 * Licensed under MIT (https://github.com/twbs/ratchet/blob/master/LICENSE)
 */

/* jshint node: true */
module.exports = function (grunt) {
  'use strict';

  // Force use of Unix newlines
  grunt.util.linefeed = '\n';

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    // Metadata.
    meta: {
      // components: 'components/',
      sassPath: 'entry/sass/',
      jsPath: 'entry/js',
      distPath: 'dist/',
      entry: 'entry/',
      entryImg: 'entry/img/',
      distImg: 'dist/img/'
    },

    banner: '/*!\n' +
            ' * =====================================================\n' +
            ' * <%= pkg.name %> v<%= pkg.version %> (<%= pkg.homepage %>)\n' +
            ' * Copyright <%= grunt.template.today("yyyy") %> <%= pkg.author %>\n' +
            ' *\n' +
            ' * v<%= pkg.version %> designed by @sjz.\n' +
            ' * =====================================================\n' +
            ' */\n',

    sass: {
      options: {
        banner: '<%= banner %>',
        //sourcemap: 'none',
        style: 'expanded',
        unixNewlines: true
      },
      sjz: {
        files: {
          '<%= meta.distPath %>main.css': '<%= meta.entry %>main.scss',
        }
      }
    },

    cssmin: {
      options: {
        banner: '', // set to empty; see bellow
        keepSpecialComments: '*', // set to '*' because we already add the banner in sass
        compatibility : 'ie8',
        noAdvanced : true
      },
      sjz: {
        files: {
          '<%= meta.distPath %>main.min.css': '<%= meta.distPath %>main.css'
        }
      }
    },

    watch: {
      // src: {
      //   files: [
      //     '<%= meta.srcPath %>**/*.scss'
      //   ],
      //   tasks: ['sass']
      // },
      sjz: {
        files: [
          '<%= meta.entry %>**/*.scss',
          //'<%= meta.entry %>**/*.js'
        ],
        // tasks: ['sass:sjz', 'sass:hotelForSearch', 'requirejs:hotelFromOrder', 'requirejs:hotelBeforeOrder', 'requirejs:hotelForSearch', 'cssmin:hotel', 'cssmin:hotelForSearch'],
        tasks: ['sass:sjz','cssmin:sjz']
      }
    },

    copy: {
      sjz: {
        files: [
          {expand: true, cwd: '<%= meta.entryImg %>', src: "**", dest: "<%= meta.distImg %>"}
        ]
        // src: '<%= meta.entryImg %>*',
        // dest: '<%= meta.distImg %>'
      }
    },

    jshint: {
      options: {
        // jshintrc: 'js/.jshintrc'
        '-W033' : true,
        '-W014' : true,
        '-W030' : true,
        '-W032' : true,
        '-W069' : true,
        '-W061' : true,
        '-W103' : true,//__proto__     
      },
      grunt: {
        src: ['Gruntfile.js', 'grunt/*.js']
      },
      sjz:{
        src: ['<%= meta.jsPath %>*.js']
      }
    },

    connect: {
        server: {
            options: {
                port: 3000,
                base: ''
            }
        }
    },

    open: {
        kitchen: {
            path: 'http://localhost:3000/index.html'
        }
    },

    uglify: {
      // options: {
      //   banner: '<%= banner %>',
      //   compress: true,
      //   mangle: true,
      //   preserveComments: false
      // },
      // user: {
      //   src: '<%= meta.distPath %>build.all.js',
      //   dest: '<%= meta.distPath %>build.js'
      // },
      // ucenter: {
      //   src: '<%= meta.distPath %>ucenter/build.all.js',
      //   dest: '<%= meta.distPath %>ucenter/build.js'
      // }
      user: {
        files: [
          {
            src: '<%= meta.distPath %>build.all.js',
            dest: '<%= meta.distPath %>build.js'
          }
        ]
      },
      ucenter: {
        files: [
          {
            src: '<%= meta.distPath %>ucenter/build.all.js',
            dest: '<%= meta.distPath %>ucenter/build.js'
          }
        ]
      }
    },

    requirejs: {
      sjz: {
        options: {
          baseUrl: "./",
          // baseUrl: 'entry/huoche/',
          // name : '<%= meta.entry %>js/lib/almond',
          name : '<%= meta.entry %>js/lib/require',
          // mainConfigFile: "entry/huoche/config.js",
          include : [
            '<%= meta.entry %>js/main'
          ],
          out: '<%= meta.distPath %>build.all.js',
          // optimize : 'uglify2',
          optimize : 'none',
          wrap : true
        }
      }
    }
  });

  // Load the plugins
  require('load-grunt-tasks')(grunt, { scope: 'devDependencies' });
  require('time-grunt')(grunt);

  // server
  grunt.registerTask('server', 'Run server', ['connect', 'open',  'watch']);
  // grunt.registerTask('sjz', ['sass:sjz', 'cssmin:sjz', 'jshint:sjz', 'requirejs', 'uglify']);
  grunt.registerTask('sjz', ['sass:sjz', 'cssmin:sjz', 'jshint:sjz', 'copy', 'requirejs', 'uglify']);
  grunt.registerTask('js', ['jshint:sjz', 'requirejs', 'uglify:user']);
  // grunt.registerTask('hotel', ['sass:hotel', 'sass:hotelForSearch', 'requirejs:hotelFromOrder', 'requirejs:hotelBeforeOrder', 'requirejs:hotelForSearch', 'cssmin:hotel', 'cssmin:hotelForSearch']);
};
