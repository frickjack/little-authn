const gulp = require('gulp');
const merge = require('merge-stream');
const exec = require('child_process').exec;
const mkdirp = require('mkdirp');
const replace = require('gulp-replace');
const gulpHelper = require('@littleware/little-elements/gulpHelper');
const package = require('./package.json');
const basePath = "src/@littleware/little-authn";

// TODO - automate version assignment
gulpHelper.defineTasks(gulp, { basePath, data: { jsroot: `/modules/${package.version}` } });


gulp.task('compile', gulp.series('little-compilets-bin', function(done) {
  // place code for your default task here
  //console.log( "Hello, World!" );
  //gulp.src( "src/**/*" ).pipe( gulp.dest( "build/" ) );
  done();
}));

gulp.task('default', gulp.series('compile', function(done) {
  // place code for your default task here
  //console.log( "Hello, World!" );
  //gulp.src( "src/**/*" ).pipe( gulp.dest( "build/" ) );
  done();
}));

