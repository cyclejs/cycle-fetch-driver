import test from 'tape'
import Rx from 'rx'
import { parse as parseUrl } from 'url'
import { makeFetchDriver } from '../src'

const { onNext } = Rx.ReactiveTest
let originalFetch, fetches

function compareMessages (t, actual, expected) {
  t.equal(actual.length, expected.length, 'messages should be same length')
  expected.forEach((message, i) => {
    t.ok(
      Rx.internals.isEqual(actual[i], message),
      'message should be equal'
    )
  })
}

function mockFetch (input, init) {
  const url = input.url || input
  const resource = parseUrl(url).pathname.replace('/', '')
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
  const fetchDriver = makeFetchDriver()
  t.ok(typeof fetchDriver === 'function', 'should return a function')
  t.end()
})

test('fetchDriver', t => {
  setup()
  const url = 'http://api.test/resource'
  const fetchDriver = makeFetchDriver()
  const request$ = Rx.Observable.just({ url })
  fetchDriver(request$)
    .mergeAll()
    .toArray()
    .subscribe(
      responses => {
        t.equal(responses.length, 1)
        const response = responses[0]
        t.equal(response.url, url)
        t.equal(fetches.length, 1, 'should call fetch once')
        t.deepEqual(fetches[0], [ 'http://api.test/resource', undefined ],
          'should call fetch with url and no options')
        t.end()
      },
      t.error
    )
})

test('fetchDriver should support multiple requests', t => {
  setup()
  const scheduler = new Rx.TestScheduler()
  const request1 = 'http://api.test/resource1'
  const request2 = 'http://api.test/resource2'
  const requests = [
    { ticks: 300, value: request1 },
    { ticks: 400, value: request2 },
    { ticks: 500, value: request1 }
  ]
  const responses = requests.map(request => (
    { ticks: request.ticks + 120, value: request.value.split('/').pop() }
  ))
  const requestMessages = requests.map(request => onNext(request.ticks, request.value))
  const request$ = scheduler.createHotObservable(...requestMessages)
  const oldFetch = global.fetch
  global.fetch = (url, init) => {
    const response = responses.shift()
    return scheduler.createResolvedPromise(response.ticks, response.value)
  }
  const fetchDriver = makeFetchDriver(scheduler)
  const { messages } = scheduler.startScheduler(() => (
    fetchDriver(request$)
      .mergeAll()
  ))
  compareMessages(t, messages, [
    onNext(421, 'resource1'),
    onNext(521, 'resource2'),
    onNext(621, 'resource1')
  ])
  global.fetch = oldFetch
  t.end()
})

test('fetchDriver should support string requests', t => {
  setup()
  const fetchDriver = makeFetchDriver()
  const request1 = 'http://api.test/resource1'
  fetchDriver(Rx.Observable.just(request1))
    .byKey(request1)
    .mergeAll()
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
  const fetchDriver = makeFetchDriver()
  const request1 = {
    url: 'http://api.test/resource1'
  }
  fetchDriver(Rx.Observable.just({ input: request1 }))
    .byKey(request1.url)
    .mergeAll()
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

test('fetchDriver should support multiple subscriptions', t => {
  function checkFetchCount () {
    t.equal(fetches.length, 1, 'should call fetch once')
    if (++checkCount === 2) t.end()
  }
  setup()
  let checkCount = 0
  const url = 'http://api.test/resource'
  const fetchDriver = makeFetchDriver()
  const request$ = Rx.Observable.just({ url })
  const responses$ = fetchDriver(request$)
    .mergeAll()
    .toArray()
  responses$
    .subscribe(checkFetchCount, t.error)
  responses$
    .subscribe(checkFetchCount, t.error)
})

test('byUrl should support request url', t => {
  setup()
  const request1 = { url: 'http://api.test/resource1', key: 'resource1' }
  const request2 = { url: 'http://api.test/resource2', key: 'resource2' }
  const fetchDriver = makeFetchDriver()
  const request$ = Rx.Observable.of(request1, request2)
  fetchDriver(request$)
    .byUrl(request2.url)
    .mergeAll()
    .toArray()
    .subscribe(
      responses => {
        t.equal(responses.length, 1)
        t.equal(responses[0].data, 'resource2')
        t.end()
      },
      t.error
    )
})

test('byUrl should support input url', t => {
  setup()
  const request1 = { input: { url: 'http://api.test/resource1' }, key: 'resource1' }
  const request2 = { input: { url: 'http://api.test/resource2' }, key: 'resource2' }
  const fetchDriver = makeFetchDriver()
  const request$ = Rx.Observable.of(request1, request2)
  fetchDriver(request$)
    .byUrl(request2.input.url)
    .mergeAll()
    .toArray()
    .subscribe(
      responses => {
        t.equal(responses.length, 1)
        t.equal(responses[0].data, 'resource2')
        t.end()
      },
      t.error
    )
})

test('isolateSource and isolateSink should exist on the HTTP Source (response$$)', t => {
  setup()
  const fetchDriver = makeFetchDriver()
  const request$ = new Rx.Subject()
  const response$$ = fetchDriver(request$)
  t.ok(typeof response$$.isolateSource === 'function')
  t.ok(typeof response$$.isolateSink === 'function')
  t.end()
})

test('isolateSource and isolateSink should exist on a scoped HTTP Source (response$$)', t => {
  setup()
  const fetchDriver = makeFetchDriver()
  const request$ = new Rx.Subject()
  const response$$ = fetchDriver(request$)
  const scopedRequest$ = response$$.isolateSink(request$, 'foo')
  const scopedResponse$$ = response$$.isolateSource(response$$, 'foo')
  t.ok(typeof scopedResponse$$.isolateSource === 'function')
  t.ok(typeof scopedResponse$$.isolateSink === 'function')
  t.end()
})

test('isolateSource and isolateSink should hide responses from outside the scope', t => {
  setup()
  const fetchDriver = makeFetchDriver()
  const proxyRequest$ = new Rx.Subject()
  const response$$ = fetchDriver(proxyRequest$)
  const request1 = 'http://api.test/resource1'
  const request2 = 'http://api.test/resource2'
  const ignoredRequest$ = Rx.Observable.just(request1)
  const request$ = Rx.Observable.just(request2).delay(10)
  const scopedRequest$ = response$$.isolateSink(request$, 'foo')
  const scopedResponse$$ = response$$.isolateSource(response$$, 'foo')
  scopedResponse$$.subscribe(response$ => {
    t.equal(typeof response$.request, 'object')
    t.equal(response$.request.url, request2)
    response$.subscribe(response => {
      t.equal(response.status, 200)
      t.equal(response.data, 'resource2')
      t.end()
    })
  })
  Rx.Observable.merge(ignoredRequest$, scopedRequest$)
    .subscribe(proxyRequest$.asObserver())
})

test('after', t => {
  global.fetch = originalFetch
  t.end()
})
