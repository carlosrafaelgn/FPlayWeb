//
// MIT License
//
// Copyright (c) 2021 Carlos Rafael Gimenes das Neves
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// https://github.com/carlosrafaelgn/FPlayWeb
//

"use strict";

// Change this value to force the browser to install the
// service worker again, and recreate the cache (this technique
// works because the browser reinstalls the service worker
// whenever it detects a change in the source code of the
// service worker).
const CACHE_PREFIX = "fplay-static-cache-";
const CACHE_VERSION = "20250724";
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

self.addEventListener("install", (event) => {
	// skipWaiting() will force the browser to start using
	// this version of the service worker as soon as its
	// installation finishes.
	// It does not really matter when we call skipWaiting(),
	// as long as we perform all other operations inside
	// event.waitUntil(). Calling event.waitUntil() forces
	// the installation process to be marked as finished
	// only when all promises passed to waitUntil() finish.

	self.skipWaiting();

	event.waitUntil(caches.open(CACHE_NAME).then((cache) => {
		// According to the spec, the service worker file
		// is handled differently by the browser and needs
		// not to be added to the cache. I tested it and I
		// confirm the service worker works offline even when
		// not present in the cache (despite the error message
		// displayed by the browser when trying to fetch it).
		//
		// Also, there is no need to worry about max-age and
		// other cache-control headers/settings, because the
		// CacheStorage API ignores them.
		//
		// Nevertheless, even though CacheStorage API ignores
		// them, tests showed that a in few occasions, when
		// the browser was fetching these files, the file
		// being added to the cache actually came from the
		// browser's own cache... Therefore, I switched from
		// cache.addAll() to this.
		//
		// Let the commented files be downloaded/cached only
		// if the browser requests them!
		const files = [
			"./",
			"assets/css/graphicalFilterEditor.css?" + CACHE_VERSION,
			"assets/css/style.css?" + CACHE_VERSION,
			"assets/fonts/OpenSans-Bold.ttf",
			"assets/fonts/OpenSans-Regular.ttf",
			"assets/images/albumArts/64x64.png",
			"assets/images/albumArts/96x96.png",
			"assets/images/albumArts/192x192.png",
			"assets/images/albumArts/256x256.png",
			"assets/images/albumArts/512x512.png",
			"assets/images/favicons/favicon-512x512.png",
			"assets/images/favicons/favicon.ico",
			"assets/images/favicons/favicon.png",
			"assets/images/favicons/manifest.webmanifest",
			"assets/images/rgb.png",
			"assets/images/rgb-animated.gif",
			"assets/images/spinner.gif",
			"assets/js/monodownmixerprocessor.js?" + CACHE_VERSION,
			"assets/js/scripts.min.js?" + CACHE_VERSION,
			"assets/lib/graphicalFilterEditor/lib-nowasm.js?" + CACHE_VERSION,
			"assets/lib/graphicalFilterEditor/lib.js.mem?" + CACHE_VERSION,
			"assets/lib/libmikmod/libmikmodclib.wasm?5",
			"assets/lib/libmikmod/libmikmodprocessor.min.js?5",
		];
		const promises = new Array(files.length);
		for (let i = files.length - 1; i >= 0; i--)
			promises[i] = cache.add(new Request(files[i], { cache: "no-cache" }));
		return Promise.all(promises);
	}));
});

self.addEventListener("activate", (event) => {
	// claim() is used to ask the browser to use this instance
	// of the service worker with all possible clients, including
	// any pages that might have been opened before this service
	// worker was downloaded/activated.

	self.clients.claim();

	event.waitUntil(
		// List all cache storages in our domain.
		caches.keys().then(function (keyList) {
			// Create one Promise for deleting each cache storage that is not
			// our current cache storage, taking care not to delete other
			// cache storages from the domain by checking the key prefix (we
			// are not using map() to avoid inserting undefined into the array).
			const oldCachesPromises = [];

			for (let i = keyList.length - 1; i >= 0; i--) {
				const key = keyList[i];
				if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
					oldCachesPromises.push(caches.delete(key));
			}

			return Promise.all(oldCachesPromises);
		})
	);
});

async function fetchResponse(url) {
	let cache = null;

	let response = null;

	try {
		cache = await caches.open(CACHE_NAME);

		response = await cache.match(url, { ignoreVary: true });

		// Return the resource if it has been found.
		if (response)
			return response;

		// When the resource cannot be found in the cache,
		// try to fetch it from the network.
		response = await fetch(url);
		if (response && !response.ok)
			response = null;
	} catch (ex) {
		// If anything goes wrong, just ignore and try
		// to fetch the response from the server again.
	}

	// If the fetch succeeds, store the response in the cache
	// for later! (This means we probably forgot to add a file
	// to the cache during the installation phase)

	// Just as requests, responses are streams and we will
	// need two usable streams: one to be used by the cache
	// and one to be returned to the browser! So, we send a
	// clone of the response to the cache.
	if (response) {
		try {
			await cache.put(url, response.clone());
		} catch (ex) {
			// If anything goes wrong, just ignore and try
			// to add the response to the cache later.
		}
		return response;
	}

	// The request was neither in our cache nor was it
	// available from the network (maybe we are offline).
	// Therefore, try to fulfill requests for favicons with
	// the largest favicon we have available in our cache.
	if (cache) {
		try {
			if (url.indexOf("favicon") >= 0)
				response = await cache.match("assets/images/favicons/favicon-512x512.png", { ignoreVary: true });
		} catch (ex) {
			// The resource was not in our cache, was not available
			// from the network and was also not a favicon...
			// Unfortunately, there is nothing else we can do :(
		}
	}

	return (response || Response.error());
}

self.addEventListener("fetch", (event) => {
	// https://developer.mozilla.org/en-US/docs/Web/API/Request
	// mode is navigate only for the document itself (/ or
	// index.html), whereas for all other requests, mode is cors,
	// no-cors and so on. So, in order to make the entire game
	// work offline we must handle all kinds of requests!

	// This will speed up the loading time after the first
	// time the user loads the game. The downside of this
	// technique is that we will work with an outdated
	// version of the resource if it has been changed at
	// the server, but has not yet been updated in our
	// local cache (which, right now, will only happen
	// when the service worker is reinstalled).

	const url = event.request.url;

	if (event.request.method !== "GET" ||
		url.includes("/examples/") ||
		// Development phase only
		url.startsWith("http://localhost"))
		return;

	event.respondWith(fetchResponse(url));
});

// References:
// https://developers.google.com/web/fundamentals/primers/service-workers/?hl=en-us
// https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle?hl=en-us
// https://developers.google.com/web/fundamentals/codelabs/offline/?hl=en-us
// https://web.dev/service-workers-cache-storage
