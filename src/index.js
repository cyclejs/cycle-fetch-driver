import Rx from 'rx'

function normalizeRequest (input) {
  let request = typeof input === 'string'
    ? { url: input }
    : { ...input }
  if (!request.key) {
    request.key = request.input && request.input.url || request.url
  }
  return request
}

function byKey (response$$, key) {
  return response$$
    .filter(response$ => response$.request.key === key)
}

function byUrl (response$$, url) {
  return response$$
    .filter(response$ => {
      let request = response$.request
      let inputUrl = request.input && request.input.url || request.url
      return inputUrl === url
    })
}

export function makeFetchDriver () {
  return function fetchDriver (request$, scheduler) {
    let response$$ = new Rx.ReplaySubject(1)
    request$
      .map(normalizeRequest)
      .subscribe(
        request => {
          let { input, url, init } = request
          let response$ = Rx.Observable.fromPromise(global.fetch(input || url, init), scheduler)
          response$.request = request
          response$$.onNext(response$)
        },
        response$$.onError.bind(response$$),
        response$$.onCompleted.bind(response$$)
      )
    response$$.byKey = byKey.bind(null, response$$)
    response$$.byUrl = byUrl.bind(null, response$$)
    return response$$
  }
}
