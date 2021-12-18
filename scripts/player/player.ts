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

class Player {
	public static readonly maxVolume = 40;

	private static readonly nop = function () { };

	public readonly audioContext: AudioContext;
	public readonly graphicalFilterControl: GraphicalFilterControl;
	public readonly stereoPannerControl: StereoPannerControl;

	private audio: HTMLAudioElement;
	private audioContextTimeout: number;
	private audioContextSuspended: boolean;
	private source: MediaElementAudioSourceNode;
	private filterOutput: AudioNode;
	private stereoPannerInput: AudioNode;

	private _alive: boolean;
	private _loading: boolean;
	private _paused: boolean;
	private _volume: number;
	private _playlist: Playlist | null;
	private _currentSong: Song | null;
	private lastObjectURL: string | null;

	private readonly mediaSession: any | null;

	private readonly boundPlaybackError: any;
	private readonly boundNotifySongChanged: any;
	private readonly boundCheckAudioContext: any;
	//private readonly boundNotifyLoadingChanged: any;
	//private readonly boundNotifyPausedChanged: any;

	public onsongchanged: ((song: Song | null) => void) | null;
	public onloadingchanged: ((loading: boolean) => void) | null;
	public onpausedchanged: ((paused: boolean) => void) | null;
	public oncurrenttimeschanged: ((currentTimeS: number) => void) | null;
	public onerror: ((message: string) => void) | null;

	public constructor(filterContainer: HTMLDivElement, stereoPannerSlider: HTMLElement, volume?: number, graphicalFilterControlEnabled?: boolean, graphicalFilterControlSimpleMode?: boolean, stereoPannerControlEnabled?: boolean) {
		this.audioContextTimeout = 0;
		this.audioContextSuspended = true;
		// https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/AudioContext#options
		// https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/baseLatency
		// https://bugs.chromium.org/p/chromium/issues/detail?id=1231090
		this.audioContext = (window.AudioContext ? new window.AudioContext({
			latencyHint: "playback"
		}) : new (window as any)["webkitAudioContext"]({
			latencyHint: "playback"
		})) as AudioContext;
		this.audioContext.suspend();
		this.audioContext.onstatechange = this.audioContextStateChanged.bind(this);

		this.graphicalFilterControl = new GraphicalFilterControl(filterContainer, this.audioContext, graphicalFilterControlEnabled, graphicalFilterControlSimpleMode, this.filterChanged.bind(this));

		this.stereoPannerControl = new StereoPannerControl(stereoPannerSlider, this.audioContext, stereoPannerControlEnabled, this.stereoPannerChanged.bind(this));

		this.onsongchanged = null;
		this.onloadingchanged = null;
		this.onpausedchanged = null;
		this.oncurrenttimeschanged = null;
		this.onerror = null;

		this.boundPlaybackError = this.playbackError.bind(this);
		this.boundNotifySongChanged = this.notifySongChanged.bind(this);
		this.boundCheckAudioContext = this.checkAudioContext.bind(this);
		//this.boundNotifyLoadingChanged = this.notifyLoadingChanged.bind(this);
		//this.boundNotifyPausedChanged = this.notifyPausedChanged.bind(this);

		this.audio = new Audio();
		this.audio.loop = false;
		this.audio.controls = false;
		this.audio.volume = 1;

		const boundPlaybackLoadStarted = this.playbackLoadStarted.bind(this);
		this.audio.onwaiting = boundPlaybackLoadStarted;
		this.audio.onloadstart = boundPlaybackLoadStarted;

		this.audio.oncanplay = this.playbackLoadEnded.bind(this);

		this.audio.onended = this.playbackEnded.bind(this);
		this.audio.onerror = this.boundPlaybackError;

		this.audio.onpause = this.playbackPaused.bind(this);

		const boundPlaybackStarted = this.playbackStarted.bind(this);
		this.audio.onplay = boundPlaybackStarted;
		this.audio.onplaying = boundPlaybackStarted;

		const boundPlaybackAborted = this.playbackAborted.bind(this);
		this.audio.onabort = boundPlaybackAborted;
		this.audio.onemptied = boundPlaybackAborted;

		this.audio.ondurationchange = this.playbackLengthChanged.bind(this);

		this.audio.ontimeupdate = this.currentTimeChanged.bind(this);

		this.source = this.audioContext.createMediaElementSource(this.audio);

		this._alive = true;
		this._loading = false;
		this._paused = true;
		this._playlist = null;
		this._currentSong = null;
		this._volume = Player.maxVolume;

		this.lastObjectURL = null;

		this.volume = (volume === undefined ? Player.maxVolume : volume);

		this.filterOutput = this.source;
		this.stereoPannerInput = this.audioContext.destination;

		this.filterChanged();
		this.stereoPannerChanged();

		// https://developers.google.com/web/updates/2017/02/media-session
		// https://w3c.github.io/mediasession
		const mediaSession = ((("mediaSession" in navigator) && ("MediaMetadata" in window)) ? (navigator as any).mediaSession : null);
		this.mediaSession = mediaSession;

		if (mediaSession && ("setActionHandler" in mediaSession)) {
			const boundPlayPause = this.playPause.bind(this);

			mediaSession.setActionHandler("previoustrack", this.previous.bind(this));
			mediaSession.setActionHandler("seekbackward", this.seekBackward.bind(this));
			mediaSession.setActionHandler("pause", boundPlayPause);
			mediaSession.setActionHandler("play", boundPlayPause);
			mediaSession.setActionHandler("seekforward", this.seekForward.bind(this));
			mediaSession.setActionHandler("nexttrack", this.next.bind(this));
		}
	}

	public destroy(partial?: boolean): Promise<void> | void {
		this.stop();

		if (!partial) {
			if (this._playlist)
				this._playlist.destroy();

			const mediaSession = this.mediaSession;
			if (mediaSession && ("setActionHandler" in mediaSession)) {
				mediaSession.setActionHandler("previoustrack", null);
				mediaSession.setActionHandler("seekbackward", null);
				mediaSession.setActionHandler("pause", null);
				mediaSession.setActionHandler("play", null);
				mediaSession.setActionHandler("seekforward", null);
				mediaSession.setActionHandler("nexttrack", null);
			}

			zeroObject(this);
		} else {
			this._alive = false;

			if (this.graphicalFilterControl)
				this.graphicalFilterControl.saveSettings();

			if (this.stereoPannerControl)
				this.stereoPannerControl.saveSettings();
		}
	}

	private filterChanged(): void {
		if (!this._alive)
			return;

		const source = this.source,
			destination = this.stereoPannerInput;

		this.filterOutput = source;

		if (!this.graphicalFilterControl.enabled ||
			!this.graphicalFilterControl.editor.filter.connectSourceAndDestination(source, destination)) {
			source.disconnect();
			this.graphicalFilterControl.editor.filter.disconnectSourceAndDestination();
			source.connect(destination, 0, 0);
		} else {
			this.filterOutput = this.graphicalFilterControl.editor.filter.outputNode as AudioNode;
		}
	}

	private stereoPannerChanged(): void {
		if (!this._alive)
			return;

		const source = this.filterOutput,
			destination = this.audioContext.destination;

		this.stereoPannerInput = destination;

		if (!this.stereoPannerControl.enabled ||
			!this.stereoPannerControl.connectSourceAndDestination(source, destination)) {
			source.disconnect();
			this.stereoPannerControl.disconnectSourceAndDestination();
			source.connect(destination, 0, 0);
		} else {
			this.stereoPannerInput = this.stereoPannerControl.inputNode as AudioNode;
		}
	}

	public get alive(): boolean {
		return this._alive;
	}

	public get loading(): boolean {
		return this._loading;
	}

	public get paused(): boolean {
		return this._paused;
	}

	public get volume(): number {
		return this._volume;
	}

	public set volume(volume: number) {
		volume |= 0;
		this._volume = (volume <= 0 ? 0 : (volume >= Player.maxVolume ? Player.maxVolume : volume));

		// Apparently, browsers assume volume is on a linear scale...
		// https://github.com/whatwg/html/issues/5501
		if (this.audio)
			this.audio.volume = (volume ? Math.pow(10, (this._volume - Player.maxVolume) / 20) : 0);
	}

	public get playlist(): Playlist | null {
		return this._playlist;
	}

	public set playlist(playlist: Playlist | null) {
		if (!this._alive)
			return;

		this.stop();
		this._playlist = playlist;
	}

	public get currentSong(): Song | null {
		return this._currentSong;
	}

	public get currentTimeMS(): number {
		return (this._currentSong ? ((this.audio.currentTime * 1000) | 0) : -1);
	}

	private audioContextStateChanged(): void {
		if (!this._alive)
			return;

		if (this.audioContext.state !== "running" && !this.audioContextSuspended) {
			this.audioContextSuspended = true;
			this.playbackPaused();
		}
	}

	private playbackLoadStarted(): void {
		if (!this._alive || this._loading)
			return;

		this._loading = true;
		//queueMicrotask(this.boundNotifyLoadingChanged);
		if (this.onloadingchanged)
			this.onloadingchanged(true);
	}

	private playbackLoadEnded(): void {
		if (!this._alive || !this._loading)
			return;

		this._loading = false;
		//queueMicrotask(this.boundNotifyLoadingChanged);
		if (this.onloadingchanged)
			this.onloadingchanged(false);
	}

	private playbackEnded(): void {
		if (!this._alive)
			return;

		this.next();
	}

	private playbackError(event: Event | string, source?: string, line?: number, col?: number, error?: Error): void {
		if (!this._alive)
			return;

		this.stop();

		if (this.onerror)
			this.onerror(error ?
				(error.message ? error.message : (((typeof event) === "string") ? (event as string) : error.toString())) :
				(((typeof event) === "string") ? (event as string) : Strings.UnknownError)
			);
	}

	private suspendAudioContext(delay: boolean): void {
		if (this.audioContextTimeout) {
			clearTimeout(this.audioContextTimeout);
			this.audioContextTimeout = 0;
		}

		if (!this.audioContextSuspended) {
			if (delay) {
				this.audioContextTimeout = window.setTimeout(this.boundCheckAudioContext, 5000);
			} else {
				this.audioContextSuspended = true;
				this.audioContext.suspend();
			}
		}
	}

	private resumeAudioContext(): void {
		if (this.audioContextTimeout) {
			clearTimeout(this.audioContextTimeout);
			this.audioContextTimeout = 0;
		}

		if (this.audioContextSuspended || this.audioContext.state !== "running") {
			this.audioContextSuspended = false;
			this.audioContext.resume();
		}
	}

	private checkAudioContext(): void {
		this.audioContextTimeout = 0;

		if (this._paused) {
			if (!this.audioContextSuspended) {
				this.audioContextSuspended = true;
				this.audioContext.suspend();
			}
		} else {
			if (this.audioContextSuspended) {
				this.audioContextSuspended = false;
				this.audioContext.resume();
			}
		}
	}

	private playbackPaused(): void {
		if (!this._alive || this._paused)
			return;

		this._paused = true;
		this.suspendAudioContext(true);
		//queueMicrotask(this.boundNotifyPausedChanged);
		if (this.onpausedchanged)
			this.onpausedchanged(true);
	}

	private playbackStarted(): void {
		if (!this._alive || !this._paused)
			return;

		this._paused = false;
		this.resumeAudioContext();
		//queueMicrotask(this.boundNotifyPausedChanged);
		if (this.onpausedchanged)
			this.onpausedchanged(false);
	}

	private playbackAborted(): void {
		if (!this._alive)
			return;

		if (this._loading) {
			this._loading = false;
			//queueMicrotask(this.boundNotifyLoadingChanged);
			if (this.onloadingchanged)
				this.onloadingchanged(false);
		}

		if (!this._paused) {
			this._paused = true;
			this.suspendAudioContext(true);
			//queueMicrotask(this.boundNotifyPausedChanged);
			if (this.onpausedchanged)
				this.onpausedchanged(true);
		}
	}

	private playbackLengthChanged(): void {
		if (!this._alive || !this.audio || !this._playlist || !this._currentSong)
			return;

		this._playlist.songLengthChanged(this._currentSong, this.audio.duration);
		if (this.mediaSession && this.audio.duration > 0 && ("setPositionState" in this.mediaSession))
			this.mediaSession.setPositionState({ duration: this.audio.duration });
	}

	private currentTimeChanged(): void {
		if (!this._alive || !this.audio || !this._currentSong)
			return;

		if (this.oncurrenttimeschanged)
			this.oncurrenttimeschanged(this.audio.currentTime);
	}

	private notifySongChanged(): void {
		if (this._alive) {
			const currentSong = this._currentSong,
				mediaSession = this.mediaSession;

			if (mediaSession) {
				if (currentSong) {
					mediaSession.metadata = new (window as any).MediaMetadata({
						title: currentSong.title,
						artist: currentSong.artist,
						album: currentSong.album,
						artwork: [
							{ src: "assets/images/albumArts/64x64.png", sizes: "64x64", type: "image/png" },
							{ src: "assets/images/albumArts/96x96.png", sizes: "96x96", type: "image/png" },
							{ src: "assets/images/albumArts/192x192.png", sizes: "192x192", type: "image/png" },
							{ src: "assets/images/albumArts/256x256.png", sizes: "256x256", type: "image/png" },
							{ src: "assets/images/albumArts/512x512.png", sizes: "512x512", type: "image/png" }
						]
					});
					if (currentSong.lengthMS > 0 && ("setPositionState" in mediaSession))
						mediaSession.setPositionState({ duration: (currentSong.lengthMS / 1000) });
				} else {
					mediaSession.playbackState = "none";
				}
			}

			if (this.onsongchanged)
				this.onsongchanged(currentSong);
		}
	}

	/*private notifyLoadingChanged(): void {
		if (this._alive && this.onloadingchanged)
			this.onloadingchanged(this._loading);
	}

	private notifyPausedChanged(): void {
		if (this._alive && this.onpausedchanged)
			this.onpausedchanged(this._paused);
	}*/

	public previous(): void {
		if (!this._alive || !this._playlist)
			return;

		this._playlist.moveCurrentToPrevious();
		this.play(-1);
	}

	public seekBackward(): void {
		if (!this._alive)
			return;

		this.seekTo(-10000, true);
	}

	public pause(): void {
		if (!this._alive)
			return;

		// Try to help solving issues on a few mobile devices that suspend
		// audio contexts, without notification, when the screen goes off or
		// when the browser goes to the background.
		this.suspendAudioContext(false);

		if (this._currentSong)
			this.audio.pause();
	}

	public play(index?: number): void {
		if (!this._alive)
			return;

		let playPromise: Promise<void> | undefined;

		if (this._currentSong && index === undefined) {
			this.resumeAudioContext();

			playPromise = this.audio.play();
		} else if (this._playlist) {
			if (index !== undefined && index >= 0)
				this._playlist.currentIndex = index;

			let currentSong = this._playlist.currentItem;

			if (!currentSong && this._playlist.length) {
				this._playlist.moveCurrentToNext();
				currentSong = this._playlist.currentItem;
			}

			if (!currentSong) {
				this.stop();
				return;
			}

			this._currentSong = currentSong;
			queueMicrotask(this.boundNotifySongChanged);

			this.resumeAudioContext();

			while (this.audio.firstChild)
				this.audio.removeChild(this.audio.firstChild);

			const source = document.createElement("source");
			if (currentSong.url) {
				source.src = currentSong.url;
			} else if (currentSong.file) {
				if (this.lastObjectURL)
					URL.revokeObjectURL(this.lastObjectURL);
				this.lastObjectURL = URL.createObjectURL(currentSong.file);
				source.src = this.lastObjectURL;
			}
			source.onerror = this.boundPlaybackError;

			this.audio.appendChild(source);
			this.audio.load();
			playPromise = this.audio.play();
		}

		// https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/load#usage_notes
		// The process of aborting any ongoing activities will cause any outstanding Promises
		// returned by play() being resolved or rejected as appropriate based on their status
		// before the loading of new media can begin. Pending play promises are aborted with
		// an "AbortError" DOMException.
		if (playPromise)
			playPromise.catch(Player.nop);
	}

	public playPause(): void {
		if (!this._alive)
			return;

		if (!this._currentSong || this.audio.paused)
			this.play();
		else
			this.pause();
	}

	public stop(): void {
		if (!this._alive)
			return;

		if (this._currentSong) {
			// Try to force a kWebMediaPlayerDestroyed event without causing onerror
			// and other undesirable events.
			//this.audio.removeAttribute("src");
			//this.audio.src = "";
			while (this.audio.firstChild)
				this.audio.removeChild(this.audio.firstChild);
			this.audio.load();

			if (this.lastObjectURL) {
				URL.revokeObjectURL(this.lastObjectURL);
				this.lastObjectURL = null;
			}

			if (this._loading) {
				this._loading = false;
				//queueMicrotask(this.boundNotifyLoadingChanged);
				if (this.onloadingchanged)
					this.onloadingchanged(false);	
			}

			if (!this._paused) {
				this._paused = true;
				//queueMicrotask(this.boundNotifyPausedChanged);
				if (this.onpausedchanged)
					this.onpausedchanged(true);
			}

			this._currentSong = null;
			//queueMicrotask(this.boundNotifySongChanged);
			this.notifySongChanged();
		}

		this.suspendAudioContext(false);
	}

	public seekForward(): void {
		if (!this._alive)
			return;

		this.seekTo(10000, true);
	}

	public next(): void {
		if (!this._alive || !this._playlist)
			return;

		this._playlist.moveCurrentToNext();
		this.play(-1);
	}

	public seekTo(timeMS: number, relative?: boolean): void {
		if (!this._alive || !this._currentSong || this._currentSong.lengthMS <= 0 || !this.audio.seekable || !this.audio.seekable.length)
			return;

		const timeS = (timeMS / 1000) + (relative ? this.audio.currentTime : 0);
		this.audio.currentTime = ((timeS > this.audio.duration) ? this.audio.duration : (timeS <= 0 ? 0 : timeS));
	}
}
