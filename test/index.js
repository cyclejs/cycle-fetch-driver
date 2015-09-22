import test from 'tape'
import { Rx } from '@cycle/core'
import { makeFetchDriver } from '../src'

var originalFetch, fetches

function mockFetch (url, options) {
  fetches.push(Array.prototype.slice.apply(arguments))
  return Promise.resolve({
    url,
    status: 200,
    statusText: 'OK',
    ok: true
  })
}

function setup () {
  fetches = []
}

test('before', t => {
  originalFetch = global.fetch
  global.fetch = mockFetch
  t.end()
})

test('makeFetchDriver', t => {
  setup()
  let fetchDriver = makeFetchDriver()
  t.ok(typeof fetchDriver === 'function', 'should return a function')
  t.end()
})

test('fetchDriver', t => {
  setup()
  let url = 'http://api.test/resource'
  let fetchDriver = makeFetchDriver()
  let request$ = Rx.Observable.just({ url })
  let response$$ = fetchDriver(request$)
  response$$.subscribe(response$ => {
    response$.subscribe(response => {
      t.equal(response.url, url)
      t.equal(fetches.length, 1, 'should call fetch once')
      t.deepEqual(fetches[0], [ 'http://api.test/resource', undefined ],
        'should call fetch with url and no options')
      t.end()
    })
  })
})

test('fetchDriver multiple requests', t => {
  let complete = 0
  function onComplete () {
    if (complete === 3) t.end()
  }

  setup()
  let fetchDriver = makeFetchDriver()
  let request1 = {
    key: 'resource1',
    url: 'http://api.test/resource1'
  }
  let request2 = {
    key: 'resource2',
    url: 'http://api.test/resource2'
  }
  let request$ = Rx.Observable.of(request1, request2)
  let response$$ = fetchDriver(request$)
  response$$
    .filter(response$ => response$.key === 'resource1')
    .subscribe(response$ => {
      response$.subscribe(
        response => {
          t.equal(response.url, request1.url, 'should return resource1')
          complete++
        },
        t.error,
        onComplete
      )
    })
  setTimeout(() => {
    response$$
      .filter(response$ => response$.key === 'resource1')
      .subscribe(response$ => {
        response$.subscribe(
          response => {
            t.equal(response.url, request1.url, 'should return resource1 again')
            complete++
          },
          t.error,
          onComplete
        )
      })
    response$$
      .filter(response$ => response$.key === 'resource2')
      .subscribe(response$ => {
        response$.subscribe(
          response => {
            t.equal(response.url, request2.url, 'should return resource2')
            complete++
          },
          t.error,
          onComplete
        )
      })
  }, 10)
})

test('after', t => {
  global.fetch = originalFetch
  t.end()
})
