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

interface HostMediaSession {
	setPaused(paused: boolean, lengthMS: number, positionS: number): void;
	setLoading(loading: boolean, lengthMS: number, positionS: number): void;
	setMetadata(id: number, title: string | null, artist: string | null, album: string | null, track: number, year: number, lengthMS: number, positionS: number): void;
	cleanUpMediaSession?(): void;
}

class HostMediaSession {
	private static _browserWrapper: HostMediaSession | null = null;

	private static setActionHandler(mediaSession: any, type: string, callback: any | null): void {
		try {
			mediaSession.setActionHandler(type, callback);
		} catch (ex: any) {
			// Just ignore...
		}
	}

	private static setUpMediaSession(mediaSession: any | null): void {
		if (!mediaSession)
			return;

		const playPause = function () { App.player && App.player.playPause(); };

		HostMediaSession.setActionHandler(mediaSession, "previoustrack", function () { App.player && App.player.previous(); });
		HostMediaSession.setActionHandler(mediaSession, "seekbackward", function () { App.player && App.player.seekBackward(); });
		HostMediaSession.setActionHandler(mediaSession, "pause", playPause);
		HostMediaSession.setActionHandler(mediaSession, "play", playPause);
		HostMediaSession.setActionHandler(mediaSession, "seekforward", function () { App.player && App.player.seekForward(); });
		HostMediaSession.setActionHandler(mediaSession, "nexttrack", function () { App.player && App.player.next(); });
	}

	private static cleanUpMediaSession(mediaSession: any | null): void {
		if (!mediaSession)
			return;

		HostMediaSession.setActionHandler(mediaSession, "previoustrack", null);
		HostMediaSession.setActionHandler(mediaSession, "seekbackward", null);
		HostMediaSession.setActionHandler(mediaSession, "pause", null);
		HostMediaSession.setActionHandler(mediaSession, "play", null);
		HostMediaSession.setActionHandler(mediaSession, "seekforward", null);
		HostMediaSession.setActionHandler(mediaSession, "nexttrack", null);
	}

	public static getMediaSession(): HostMediaSession | null {
		if (App.hostInterface)
			return App.hostInterface;

		if (!HostMediaSession._browserWrapper) {
			// https://developers.google.com/web/updates/2017/02/media-session
			// https://developer.chrome.com/blog/media-session/
			// https://w3c.github.io/mediasession
			// https://web.dev/media-session/
			// https://developer.chrome.com/blog/html5-audio-and-the-web-audio-api-are-bffs/
			const mediaSession: any | null = ((("mediaSession" in navigator) && ("MediaMetadata" in window)) ? (navigator as any).mediaSession : null);

			if (mediaSession && ("setActionHandler" in mediaSession)) {
				HostMediaSession.setUpMediaSession(mediaSession);

				let _paused = true;
				let _loading = false;

				const setPositionState: (lengthMS: number, positionS: number) => void = (("setPositionState" in mediaSession) ?
					function (lengthMS, positionS) {
						try {
							// https://developer.mozilla.org/en-US/docs/Web/API/MediaSession/setPositionState
							if (lengthMS >= 0) {
								const lengthS = lengthMS / 1000;
								mediaSession.setPositionState({
									duration: lengthS,
									position: Math.min((positionS >= 0) ? positionS : 0, lengthS),
									playbackRate: 1
								});
							} else {
								mediaSession.setPositionState({
									duration: Infinity,
									position: ((positionS >= 0) ? positionS : 0),
									playbackRate: 1
								});
							}
						} catch (ex: any) {
							// Just ignore...
						}
					} :
					function () { }
				);

				HostMediaSession._browserWrapper = {
					setPaused: function (paused, lengthMS, positionS) {
						_paused = paused;
						mediaSession.playbackState = ((_paused || _loading) ? "paused" : "playing");
						setPositionState(lengthMS, positionS);
					},

					setLoading: function (loading, lengthMS, positionS) {
						_loading = loading;
						mediaSession.playbackState = ((_paused || _loading) ? "paused" : "playing");
						setPositionState(lengthMS, positionS);
					},

					setMetadata: function (id, title, artist, album, track, year, lengthMS, positionS) {
						if (id > 0) {
							mediaSession.metadata = new (window as any).MediaMetadata({
								title: title,
								artist: artist,
								album: album,
								artwork: [
									{ src: "assets/images/albumArts/64x64.png", sizes: "64x64", type: "image/png" },
									{ src: "assets/images/albumArts/96x96.png", sizes: "96x96", type: "image/png" },
									{ src: "assets/images/albumArts/192x192.png", sizes: "192x192", type: "image/png" },
									{ src: "assets/images/albumArts/256x256.png", sizes: "256x256", type: "image/png" },
									{ src: "assets/images/albumArts/512x512.png", sizes: "512x512", type: "image/png" }
								]
							});
							if (mediaSession.playbackState == "none")
								mediaSession.playbackState = "paused";
							setPositionState(lengthMS, positionS);
						} else {
							mediaSession.metadata = null;
							mediaSession.playbackState = "none";
						}
					},

					cleanUpMediaSession: function () {
						HostMediaSession.cleanUpMediaSession(mediaSession);
					}
				};
			}
		}

		return HostMediaSession._browserWrapper;
	}
}
