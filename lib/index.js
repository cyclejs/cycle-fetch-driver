'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.makeFetchDriver = makeFetchDriver;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _objectAssign = require('object-assign');

var _objectAssign2 = _interopRequireDefault(_objectAssign);

var _cycleCore = require('@cycle/core');

function normalizeRequest(input) {
  var request = typeof input === 'string' ? { url: input } : (0, _objectAssign2['default'])({}, input);
  if (!request.key) {
    request.key = request.input && request.input.url || request.url;
  }
  return request;
}

function byKey(response$$, key) {
  return response$$.filter(function (response$) {
    return response$.request.key === key;
  });
}

function byUrl(response$$, url) {
  return response$$.filter(function (response$) {
    var request = response$.request;
    var inputUrl = request.input && request.input.url || request.url;
    return inputUrl === url;
  });
}

function makeFetchDriver() {
  return function fetchDriver(request$) {
    var response$$ = new _cycleCore.Rx.ReplaySubject(1);
    request$.map(normalizeRequest).subscribe(function (request) {
      var input = request.input;
      var url = request.url;
      var init = request.init;

      var response$ = _cycleCore.Rx.Observable.fromPromise(fetch(input || url, init));
      response$.request = request;
      response$$.onNext(response$);
    }, response$$.onError.bind(response$$), response$$.onCompleted.bind(response$$));
    response$$.byKey = byKey.bind(null, response$$);
    response$$.byUrl = byUrl.bind(null, response$$);
    return response$$;
  };
}