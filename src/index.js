import { Rx } from '@cycle/core'

function createResponse$ (request$) {
  const fromPromise = Rx.Observable.fromPromise
  let response$ = request$
    .map(({ input, url, init }) => fromPromise(fetch(input || url, init)))
    .mergeAll()
    .replay(null, 1)
  response$.connect()
  response$.key = request$.key
  return response$
}

export function makeFetchDriver () {
  return function fetchDriver (request$) {
    return request$
      .groupBy(({ key }) => key)
      .map(createResponse$)
  }
}
