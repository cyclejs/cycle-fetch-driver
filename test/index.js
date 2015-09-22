import test from 'tape'
import { parse as parseUrl } from 'url'
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
  fetchDriver(request$)
    .mergeAll()
    .toArray()
    .subscribe(
      responses => {
        t.equal(responses.length, 1)
        let response = responses[0]
        t.equal(response.url, url)
        t.equal(fetches.length, 1, 'should call fetch once')
        t.deepEqual(fetches[0], [ 'http://api.test/resource', undefined ],
          'should call fetch with url and no options')
        t.end()
      },
      t.error
    )
})

test('fetchDriver multiple requests', t => {
  let inflight = 4
  function onComplete () {
    if (!--inflight) t.end()
  }
  function fetchResource (response$$, resource, count) {
    return response$$
      .byKey(resource)
      .toArray()
      .subscribe(
        responses => {
          t.equal(responses.length, count, `should get ${count} responses`)
          responses.forEach(response => {
            t.equal(response.data, resource, `should return ${resource}`)
          })
        },
        t.error,
        onComplete
      )
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
  fetchResource(response$$, 'resource1', 2)
  setTimeout(() => {
    fetchResource(response$$, 'resource1', 2)
    fetchResource(response$$, 'resource2', 1)
  }, 10)

  response$$
    .byUrl(request1.url)
    .toArray()
    .subscribe(
      responses => {
        t.equal(responses.length, 2, 'should get 2 responses')
        responses.forEach(response => {
          t.equal(response.data, 'resource1', 'should return resource1')
        })
      },
      t.error,
      onComplete
    )
})

test('fetchDriver should support string requests', t => {
  setup()
  let fetchDriver = makeFetchDriver()
  let request1 = 'http://api.test/resource1'
  fetchDriver(Rx.Observable.just(request1))
    .byKey(request1)
    .toArray()
    .subscribe(
      responses => {
        t.equal(responses.length, 1)
        responses.forEach(response => {
          t.equal(response.data, 'resource1', 'should return resource1')
        })
        t.end()
      }
    )
})

test('fetchDriver should support Request object', t => {
  setup()
  let fetchDriver = makeFetchDriver()
  let request1 = {
    url: 'http://api.test/resource1'
  }
  fetchDriver(Rx.Observable.just({ input: request1 }))
    .byKey(request1.url)
    .toArray()
    .subscribe(
      responses => {
        t.equal(responses.length, 1)
        responses.forEach(response => {
          t.equal(response.data, 'resource1', 'should return resource1')
        })
        t.end()
      }
    )
})

test('after', t => {
  global.fetch = originalFetch
  t.end()
})
