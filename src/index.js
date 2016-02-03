import Rx from 'rx'

function getUrl (request) {
  return request.input && request.input.url || request.url
}

function normalizeRequest (input) {
  const request = typeof input === 'string'
    ? { url: input }
    : { ...input }
  if (!request.key) {
    request.key = getUrl(request)
  }
  return request
}

function byKey (response$$, key) {
  return response$$
    .filter(response$ => response$.request.key === key)
}

function byUrl (response$$, url) {
  return response$$
    .filter(response$ => getUrl(response$.request) === url)
}

function isolateSink (request$, scope) {
  return request$.map(request => {
    if (typeof request === 'string') {
      return { url: request, _namespace: [scope] }
    }
    request._namespace = request._namespace || []
    request._namespace.push(scope)
    return request
  })
}

function isolateSource (response$$, scope) {
  const isolatedResponse$$ = response$$.filter(response$ =>
    Array.isArray(response$.request._namespace) &&
    response$.request._namespace.indexOf(scope) !== -1
  )
  isolatedResponse$$.isolateSource = isolateSource
  isolatedResponse$$.isolateSink = isolateSink
  return isolatedResponse$$
}

// scheduler option is for testing because Reactive-Extensions/RxJS#976
export function makeFetchDriver (scheduler) {
  return function fetchDriver (request$) {
    const response$$ = new Rx.ReplaySubject(1)
    request$
      .map(normalizeRequest)
      .subscribe(
        request => {
          const { input, url, init } = request
          const response$ = Rx.Observable.fromPromise(global.fetch(input || url, init), scheduler)
          response$.request = request
          response$$.onNext(response$)
        },
        response$$.onError.bind(response$$),
        response$$.onCompleted.bind(response$$)
      )
    response$$.byKey = byKey.bind(null, response$$)
    response$$.byUrl = byUrl.bind(null, response$$)
    response$$.isolateSource = isolateSource
    response$$.isolateSink = isolateSink
    return response$$
  }
}
