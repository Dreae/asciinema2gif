// Released into the Public Domain by tav <tav@espians.com>

/*global phantom, $, document, asciinema, callPhantom*/

var system = require('system'),
  webpage = require('webpage');

var argv, failure;

// Get the command line arguments.
argv = system.args;

if (argv.length === 1) {
  console.log("Usage: render.js URL [FRAMES_PER_SECOND]");
  phantom.exit(0);
}

// Utility function to ensure a page load succeeded.
function checkStatus(status) {
  if (status !== 'success') {
    console.log("ERROR: Couldn't open " + argv[1] + ".");
    console.log("ERROR: " + failure);
    phantom.exit(1);
  }
}

// Capture any resource errors when loading pages.
function newPage() {
  var page = webpage.create();
  page.onResourceError = function (err) {
    failure = err.errorString;
  };
  // Uncomment this to see console.log calls from within pages.
  // page.onConsoleMessage = function (info) {
  //   console.log(info);
  // };
  return page;
}

// Do a first pass to detect the exact dimensions of the asciicast.
var page = newPage();
page.viewportSize = {width: 4096, height: 2160};
page.open(argv[1], function (status) {
  console.log(">> Fetching: " + argv[1]);
  checkStatus(status);

  var diff,
    frame = 1,
    framerate = argv[2] ? parseInt(argv[2], 10) : 10,
    interval = 1000 / framerate,
    last = 0,
    stop = false;

  var bb = page.evaluate(function() {
    return document.getElementsByClassName('asciinema-terminal')[0].getBoundingClientRect();
  });
  page.clipRect = {
    top: bb.top,
    left: bb.left,
    width: bb.width,
    height: bb.height
  };
  
  page.onCallback = function(running, progress) {
    if(progress) {
      console.log(">> Progress: " + progress);
      return;
    }

    if(running) {
      console.log(">> Generating screenshots ...");
      var now = Date.now();
      setTimeout(function screenshot() {
        if(stop) {
          console.log(">> Done!");
          phantom.exit(0);
          return;
        }

        page.render('frames/' + (("00000000" + frame++).substr(-8, 8)) + '.png', {format: 'png'});
        now = Date.now();
        if ((diff = (interval - now - last)) <= 0) {
          setTimeout(screenshot, 0);
        } else {
          setTimeout(screenshot, diff);
        }
        last = now;
      }, interval);
    } else {
      stop = true;
    }
  }

  console.log(">> Preparing window ...");
  page.evaluate(function() {
    var fetch = asciinema.HttpArraySource.prototype.fetchData;
    asciinema.HttpArraySource.prototype.fetchData = function(setLoading, onResult) {
      fetch.call(this, setLoading, function() {
        onResult();
        callPhantom(true);

        var prev = "";
        var sameCount = 0;

        setTimeout(function checkProgress() {
          var width = $('.gutter')[0].children[0].style.width;
          if (width === prev) {
            sameCount += 1;
            if (sameCount === 3) {
              callPhantom(false);
              return;
            }
          } else {
            callPhantom(true, width);
            sameCount = 0;
          }
          prev = width;
          setTimeout(checkProgress, 100);
        }, 0);
      });
    };

    var el = $('.start-prompt')[0];
    var ev = document.createEvent('Events');
    ev.initEvent('click', true, false);
    el.dispatchEvent(ev);
  });
});
