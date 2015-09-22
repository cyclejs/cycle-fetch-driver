import { parse as parseUrl } from 'url'
import test from 'tape'
import { Rx } from '@cycle/core'
import { makeFetchDriver } from '../src'

var originalFetch, fetches

function mockFetch (input, init) {
  let url = input.url || input
  let resource = parseUrl(url).pathname.replace('/', '')
  fetches.push(Array.prototype.slice.apply(arguments))
  return Promise.resolve({
    url,
    status: 200,
    statusText: 'OK',
    ok: true,
    data: resource
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
    if (complete === 7) t.end()
  }
  function fetchResource (response$$, resource) {
    return response$$
      .filter(response$ => response$.key === resource)
      .subscribe(response$ => {
        response$.subscribe(
          response => {
            t.equal(response.data, resource, `should return ${resource}`)
            complete++
          },
          t.error,
          onComplete
        )
      })
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
  let request$ = Rx.Observable.of(request1, request2, request1)
  let response$$ = fetchDriver(request$)
  fetchResource(response$$, 'resource1')
  setTimeout(() => {
    fetchResource(response$$, 'resource1')
    fetchResource(response$$, 'resource2')
  }, 10)

  response$$
    .mergeAll()
    .filter(response => response.url === request1.url)
    .subscribe(
      response => {
        t.equal(response.data, 'resource1', 'should return resource1')
        complete++
      },
      t.error,
      onComplete
    )
})

test('after', t => {
  global.fetch = originalFetch
  t.end()
})
