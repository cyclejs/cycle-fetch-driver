import test from 'tape'
import { parse as parseUrl } from 'url'
import { Rx } from '@cycle/core'
import { makeFetchDriver } from '../src'

const { onNext, onCompleted } = Rx.ReactiveTest;
let originalFetch, fetches

function compareMessages (t, actual, expected) {
  t.equal(actual.length, expected.length, 'messages should be same length')
  expected.forEach((message, i) => {
    t.ok(Rx.internals.isEqual(message, actual[i]), 'message should be equal')
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
  let responseTicks = [
    510,
    500,
    550
  ]
  const request1 = 'http://api.test/resource1'
  const request2 = 'http://api.test/resource2'
  const scheduler = new Rx.TestScheduler()
  const request$ = scheduler.createHotObservable(
    onNext(300, request1),
    onNext(400, request2),
    onNext(500, request1),
    onCompleted(600)
  )
  const oldFetch = global.fetch
  global.fetch = (url, init) => {
    return scheduler.createResolvedPromise(responseTicks.shift(), {
      data: url.split('/').pop()
    })
  }
  const fetchDriver = makeFetchDriver()
  const { messages } = scheduler.startWithCreate(() => (
    fetchDriver(request$)
      .mergeAll()
  ))
  compareMessages(t, messages, [
    onNext(500, { data: 'resource2' }),
    onNext(510, { data: 'resource1' }),
    onNext(550, { data: 'resource1' }),
    onCompleted(600)
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

test('after', t => {
  global.fetch = originalFetch
  t.end()
})
