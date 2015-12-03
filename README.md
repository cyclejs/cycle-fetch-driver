# Cycle Fetch Driver

A [Cycle.js](http://cycle.js.org) [Driver](http://cycle.js.org/drivers.html) for making HTTP requests, using the [Fetch API](https://fetch.spec.whatwg.org/).

## Install

```sh
npm install @cycle/fetch
```

## API

### ```makeFetchDriver(scheduler: Scheduler) -> fetchDriver: function```

Factory that returns a fetch driver. It takes an optional ```scheduler``` argument to pass into ```fromPromise```.

## Usage

Basics:

```js
import 'whatwg-fetch' // polyfill if you want to support older browsers
import Cycle from '@cycle/core';
import { makeFetchDriver } from '@cycle/fetch';

function main(responses) {
  // ...
}

const drivers = {
  Fetch: makeFetchDriver()
}

Cycle.run(main, drivers);
```

Simple and normal use case:

```js
function main({ DOM, HTTP }) {
  const HELLO_URL = 'http://localhost:8080/hello';
  const request$ = Rx.Observable.just(HELLO_URL);
  const vtree$ = HTTP
    .byUrl(HELLO_URL)
    .mergeAll()
    .flatMap(res => res.text()) // We expect this to be "Hello World"
    .startWith('Loading...')
    .map(text =>
      h('div.container', [
        h('h1', text)
      ])
    );

  return {
    DOM: vtree$,
    HTTP: request$
  };
}
```

Select all the responses for a certain key:

```js
function main({ DOM, HTTP }) {
  const HELLO_URL = 'http://localhost:8080/hello';
  const request$ = Rx.Observable.just({
    key: 'hello',
    url: HELLO_URL
  });
  const vtree$ = HTTP
    .byKey('hello')
    .mergeAll()
    .flatMap(res => res.text()) // We expect this to be "Hello World"
    .startWith('Loading...')
    .map(text =>
      h('div.container', [
        h('h1', text)
      ])
    );

  return {
    DOM: vtree$,
    HTTP: request$
  };
}
```
