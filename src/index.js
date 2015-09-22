import { Rx } from '@cycle/core'

function makeResponse$ (request$) {
  const fromPromise = Rx.Observable.fromPromise
  let response$ = request$
    .map(({ input, url, init }) => fromPromise(fetch(input || url, init)))
    .mergeAll()
    .replay(null, 1)
  response$.connect()
  response$.key = request$.key
  return response$
}

function byKey (key) {
  return this
    .filter(response$ => response$.key === key)
    .mergeAll()
}

function byUrl (url) {
  return this
    .mergeAll()
    .filter(response => response.url === url)
}

export function makeFetchDriver () {
  return function fetchDriver (request$) {
    let response$$ = request$
      .groupBy(({ key }) => key)
      .map(makeResponse$)
    response$$.byKey = byKey.bind(response$$)
    response$$.byUrl = byUrl.bind(response$$)
    return response$$
  }
}
