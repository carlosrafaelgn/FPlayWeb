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

interface IntermediateNodeFactory {
	(audioContext: AudioContext): ConnectableNode;
}

class Player {
	public static readonly minVolume = -40;

	private static readonly nop = function () { };

	public readonly audioContext: AudioContext;
	private readonly intermediateNodes: ConnectableNode[];
	private readonly destinationNode: DestinationNode;

	private audio: HTMLAudioElement | null;
	private sourceNode: SourceNode | null;
	private audioContextTimeout: number;
	private audioContextSuspended: boolean;

	private _alive: boolean;
	private _loading: boolean;
	private _paused: boolean;
	private _volume: number;
	private _playlist: Playlist | null;
	private _currentSong: Song | null;
	private lastObjectURL: string | null;
	private lastTimeS: number;
	private songStartedAutomatically: boolean;
	private songToResumeTime: Song | null;
	private resumeTimeS: number;

	private readonly mediaSession: HostMediaSession | null;

	private boundPlaybackError: any;
	private readonly boundNotifySongChange: any;
	private readonly boundCheckAudioContext: any;
	private readonly boundAutoNext: any;
	//private readonly boundNotifyLoadingChange: any;
	//private readonly boundNotifyPausedChange: any;

	public haltOnAllErrors: boolean;

	public onsongchange: ((song: Song | null) => void) | null;
	public onloadingchange: ((loading: boolean) => void) | null;
	public onpausedchange: ((paused: boolean) => void) | null;
	public oncurrenttimeschange: ((currentTimeS: number) => void) | null;
	public onerror: ((message: string) => void) | null;

	public constructor(volume?: number, playlist?: Playlist | null, mediaSession?: HostMediaSession | null, ...intermediateNodesFactory: IntermediateNodeFactory[]) {
		this.audioContextTimeout = 0;
		this.audioContextSuspended = true;
		// https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/AudioContext#options
		// https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/baseLatency
		// https://bugs.chromium.org/p/chromium/issues/detail?id=1231090
		const latencyHint: AudioContextLatencyCategory | number = ((navigator.userAgent && navigator.userAgent.indexOf("Firefox") >= 0) ? 1.0 : "playback");
		this.audioContext = (window.AudioContext ? new window.AudioContext({
			latencyHint
		}) : new (window as any)["webkitAudioContext"]({
			latencyHint
		})) as AudioContext;
		this.audioContext.suspend();
		this.audioContext.onstatechange = this.audioContextStateChange.bind(this);

		let intermediateNodes: ConnectableNode[];

		if (intermediateNodesFactory && intermediateNodesFactory.length) {
			intermediateNodes = new Array(intermediateNodesFactory.length);
			for (let i = 0; i < intermediateNodesFactory.length; i++)
				intermediateNodes[i] = intermediateNodesFactory[i](this.audioContext);
		} else {
			intermediateNodes = [];
		}

		this.intermediateNodes = intermediateNodes;

		this.destinationNode = new DestinationNode(this.audioContext.destination);
		this.destinationNode.enabled = true;

		this.onsongchange = null;
		this.onloadingchange = null;
		this.onpausedchange = null;
		this.oncurrenttimeschange = null;
		this.onerror = null;

		this.boundPlaybackError = null;
		this.boundNotifySongChange = this.notifySongChange.bind(this);
		this.boundCheckAudioContext = this.checkAudioContext.bind(this);
		this.boundAutoNext = this.next.bind(this, true);
		//this.boundNotifyLoadingChange = this.notifyLoadingChange.bind(this);
		//this.boundNotifyPausedChange = this.notifyPausedChange.bind(this);

		this._alive = true;
		this._loading = false;
		this._paused = true;
		this._playlist = null;
		this._currentSong = null;
		this._volume = 0;

		this.lastObjectURL = null;
		this.lastTimeS = -1;
		this.songStartedAutomatically = true;
		this.songToResumeTime = null;
		this.resumeTimeS = 0;
		this.haltOnAllErrors = false;

		this.volume = volume || 0;

		this.audio = null;
		this.sourceNode = null;

		this.recreateAudioPath();

		this.mediaSession = mediaSession || null;

		if (playlist)
			this.playlist = playlist;
	}

	private recreateAudioPath(): void {
		const intermediateNodes = this.intermediateNodes;

		if (this.sourceNode)
			this.sourceNode.disconnectFromDestination();

		for (let i = intermediateNodes.length - 1; i >= 0; i--)
			intermediateNodes[i].disconnectFromDestination();

		if (this.audio)
			document.body.removeChild(this.audio);

		const audio = document.createElement("audio"), // new Audio(),
			source = this.audioContext.createMediaElementSource(audio),
			sourceNode = new SourceNode(source);

		// The audio element is being added to the document now to try to fix the
		// integration between web audio and media session API's in a few browsers
		audio.style.pointerEvents = "none";
		audio.style.position = "absolute";
		audio.style.left = "0";
		audio.style.top = "0";
		audio.style.zIndex = "-1";
		audio.loop = false;
		audio.controls = false;
		audio.autoplay = false;
		document.body.appendChild(audio);

		this.audio = audio;
		this.sourceNode = sourceNode;

		const boundPlaybackLoadStart = () => { if (this.audio === audio) this.playbackLoadStart(); };
		audio.onwaiting = boundPlaybackLoadStart;
		audio.onloadstart = boundPlaybackLoadStart;

		audio.oncanplay = () => { if (this.audio === audio) this.playbackLoadEnd(); };

		audio.onended = () => { if (this.audio === audio) this.playbackEnd(); };
		const boundPlaybackError = (e: Event | string, source?: string, lineno?: number, colno?: number, error?: Error) => { if (this.audio === audio) this.playbackError(e, source, lineno, colno, error); };
		this.boundPlaybackError = boundPlaybackError;
		audio.onerror = boundPlaybackError;

		audio.onpause = () => { if (this.audio === audio) this.playbackPaused(); };

		const boundPlaybackStarted = () => { if (this.audio === audio) this.playbackStarted(); };
		//audio.onplay = boundPlaybackStarted;
		audio.onplaying = boundPlaybackStarted;

		const boundPlaybackAborted = () => { if (this.audio === audio) this.playbackAborted(); };
		audio.onabort = boundPlaybackAborted;
		audio.onemptied = boundPlaybackAborted;

		audio.ondurationchange = () => { if (this.audio === audio) this.playbackLengthChange(); };

		audio.ontimeupdate = () => { if (this.audio === audio) this.currentTimeChange(); };

		sourceNode.enabled = true;

		if (intermediateNodes.length) {
			sourceNode.connectToDestination(intermediateNodes[0]);

			for (let i = 0; i < intermediateNodes.length - 1; i++)
				intermediateNodes[i].connectToDestination(intermediateNodes[i + 1]);

			intermediateNodes[intermediateNodes.length - 1].connectToDestination(this.destinationNode);
		} else {
			sourceNode.connectToDestination(this.destinationNode);
		}

		this.volume = this._volume;
	}

	public destroy(partial?: boolean): Promise<void> | void {
		this.stop();

		if (!partial) {
			if (this._playlist)
				this._playlist.destroy();

			const mediaSession = this.mediaSession;
			if (mediaSession && mediaSession.cleanUpMediaSession)
				mediaSession.cleanUpMediaSession();

			zeroObject(this);
		} else {
			this._alive = false;

			if (this.sourceNode)
				this.sourceNode.disconnectFromDestination();

			const intermediateNodes = this.intermediateNodes;
			if (intermediateNodes && intermediateNodes.length) {
				for (let i = intermediateNodes.length - 1; i >= 0; i--)
					intermediateNodes[i].disconnectFromDestination();
			}
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
		this._volume = Math.max(Player.minVolume, Math.min(0, volume | 0));

		// Apparently, browsers assume volume is on a linear scale...
		// https://github.com/whatwg/html/issues/5501
		if (this.audio)
			this.audio.volume = ((volume <= Player.minVolume) ? 0 : Math.pow(10, this._volume / 20));
	}

	public get playlist(): Playlist | null {
		return this._playlist;
	}

	public set playlist(playlist: Playlist | null) {
		if (!this._alive)
			return;

		this.stop();
		this._playlist = playlist;

		// stop() only resets these when _currentSong is not null
		this.songToResumeTime = null;
		this.resumeTimeS = 0;

		if (playlist && playlist.currentIndexResumeTimeS > 0 && (this.songToResumeTime = playlist.currentItem))
			this.resumeTimeS = playlist.currentIndexResumeTimeS;
	}

	public get currentSong(): Song | null {
		return this._currentSong;
	}

	public get currentTimeMS(): number {
		if (this._currentSong && this.audio) {
			const t = this.audio.currentTime;
			this.lastTimeS = t;
			return (t * 1000) | 0;
		}
		return -1;
	}

	public get currentIndexResumeTimeS(): number {
		if (this.songToResumeTime)
			return this.resumeTimeS;

		let t = 0;

		if (this._currentSong && this._currentSong.isSeekable && this._playlist && this._playlist.currentItem === this._currentSong) {
			try {
				if (this.audio)
					t = this.audio.currentTime || 0;
			} catch (ex: any) {
				// Just ignore...
			}
			if (t <= 0)
				t = this.lastTimeS;
		}

		return t;
	}

	public set currentIndexResumeTimeS(currentIndexResumeTimeS: number) {
		if (this.songToResumeTime)
			this.resumeTimeS = currentIndexResumeTimeS;
	}

	private handleError(message: string): void {
		const lastTimeS = this.lastTimeS;

		this.stop();

		// It's rare, but after several successive errors, the playback can halt on a few browsers.
		// In order to try to tackle this, we recreate the audio node when an error happens.
		this.recreateAudioPath();

		if (this.haltOnAllErrors) {
			if (this.onerror)
				this.onerror(message);

			return;
		}

		let notifyError = false;

		if (!this._playlist || !this._playlist.length)
			notifyError = true;
		else if (lastTimeS < 0)
			notifyError = !this.songStartedAutomatically;

		if (notifyError && this.onerror)
			this.onerror(message);
		else
			queueMicrotask(this.boundAutoNext);
	}

	private audioContextStateChange(): void {
		if (!this._alive)
			return;

		if (this.audioContext.state !== "running" && !this.audioContextSuspended) {
			this.audioContextSuspended = true;
			this.playbackPaused();
		}
	}

	private playbackLoadStart(): void {
		if (!this._alive || this._loading)
			return;

		this._loading = true;
		//queueMicrotask(this.boundNotifyLoadingChange);
		if (this.onloadingchange)
			this.onloadingchange(true);
		if (this.mediaSession)
			this.mediaSession.setLoading(true);
	}

	private playbackLoadEnd(): void {
		if (!this._alive || !this._loading)
			return;

		this._loading = false;

		if (this.songToResumeTime) {
			if (this.audio && this.songToResumeTime === this._currentSong && this.resumeTimeS > 0) {
				this.lastTimeS = this.resumeTimeS;
				try {
					this.audio.currentTime = this.resumeTimeS;
				} catch (ex: any) {
					// Just ignore...
				}
				const playPromise = this.audio.play();
				if (playPromise)
					playPromise.catch(Player.nop);
			}
			this.songToResumeTime = null;
			this.resumeTimeS = 0;
		}

		//queueMicrotask(this.boundNotifyLoadingChange);
		if (this.onloadingchange)
			this.onloadingchange(false);
		if (this.mediaSession)
			this.mediaSession.setLoading(false);
	}

	private playbackEnd(): void {
		if (!this._alive)
			return;

		this.next(true);
	}

	private playbackError(e: Event | string, source?: string, line?: number, col?: number, error?: Error): void {
		if (!this._alive)
			return;

		this.handleError(error ?
			(error.message ? error.message : (((typeof error) === "string") ? (error as any) : error.toString())) :
			(((typeof e) === "string") ? (e as string) : Strings.UnknownError)
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
		//queueMicrotask(this.boundNotifyPausedChange);
		if (this.onpausedchange)
			this.onpausedchange(true);
		if (this.mediaSession)
			this.mediaSession.setPaused(true);
	}

	private playbackStarted(): void {
		if (!this._alive || !this._paused)
			return;

		this._paused = false;
		this.resumeAudioContext();
		//queueMicrotask(this.boundNotifyPausedChange);
		if (this.onpausedchange)
			this.onpausedchange(false);
		if (this.mediaSession)
			this.mediaSession.setPaused(false);
	}

	private playbackAborted(): void {
		if (!this._alive)
			return;

		if (this._loading) {
			this._loading = false;
			//queueMicrotask(this.boundNotifyLoadingChange);
			if (this.onloadingchange)
				this.onloadingchange(false);
			if (this.mediaSession)
				this.mediaSession.setLoading(false);
		}

		if (!this._paused) {
			this._paused = true;
			this.suspendAudioContext(true);
			//queueMicrotask(this.boundNotifyPausedChange);
			if (this.onpausedchange)
				this.onpausedchange(true);
			if (this.mediaSession)
				this.mediaSession.setPaused(true);
		}
	}

	private playbackLengthChange(): void {
		if (!this._alive || !this.audio || !this._playlist || !this._currentSong)
			return;

		if (this._playlist.updateSongLength(this._currentSong, this.audio.duration))
			this.notifyMediaSessionChange();
	}

	private currentTimeChange(): void {
		if (!this._alive || !this.audio || !this._currentSong)
			return;

		const t = this.audio.currentTime;
		this.lastTimeS = t;

		if (this.oncurrenttimeschange)
			this.oncurrenttimeschange(t);
	}

	private notifyMediaSessionChange(): void {
		if (!this._alive || !this.mediaSession)
			return;

		const currentSong = this._currentSong;

		if (currentSong)
			this.mediaSession.setMetadata(currentSong.id, currentSong.title, currentSong.artist, currentSong.album, currentSong.track, currentSong.lengthMS, currentSong.year);
		else
			this.mediaSession.setMetadata(0, null, null, null, 0, 0, 0);
	}

	private notifySongChange(): void {
		if (!this._alive)
			return;

		if (this.onsongchange)
			this.onsongchange(this._currentSong);

		this.notifyMediaSessionChange();
	}

	/*private notifyLoadingChange(): void {
		if (this._alive && this.onloadingchange)
			this.onloadingchange(this._loading);
	}

	private notifyPausedChange(): void {
		if (this._alive && this.onpausedchange)
			this.onpausedchange(this._paused);
	}*/

	public setPlaylistData(): void {
		const playlist = this._playlist;

		if (!playlist)
			return;

		playlist.currentIndexResumeTimeS = this.currentIndexResumeTimeS;
	}

	public previous(automaticCall?: boolean): void {
		if (!this._alive || !this._playlist)
			return;

		this._playlist.moveCurrentToPrevious();
		this.play(-1, automaticCall);
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

		if (this._currentSong && this.audio)
			this.audio.pause();
	}

	public play(index?: number, automaticCall?: boolean): void {
		if (!this._alive || !this.audio)
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

			this.lastTimeS = -1;
			this.songStartedAutomatically = !!automaticCall;
			if (this._currentSong !== currentSong) {
				this._currentSong = currentSong;
				queueMicrotask(this.boundNotifySongChange);
			}

			this.resumeAudioContext();

			while (this.audio.firstChild)
				this.audio.removeChild(this.audio.firstChild);

			const source = document.createElement("source");
			if (currentSong.url && !currentSong.url.startsWith(FileUtils.localURLPrefix)) {
				source.src = currentSong.url;
			} else if (currentSong.file) {
				if (this.lastObjectURL)
					URL.revokeObjectURL(this.lastObjectURL);
				this.lastObjectURL = URL.createObjectURL(currentSong.file);
				source.src = this.lastObjectURL;
			} else if (currentSong.url) {
				this.pause();

				const lastCurrentIndex = this._playlist.currentIndex,
					lastCurrentSong = this._playlist.currentItem;

				FileSystemAPI.getFile(currentSong.url.substring(FileUtils.localURLPrefix.length)).then((file) => {
					if (lastCurrentSong && !lastCurrentSong.file && file)
						lastCurrentSong.file = file;

					if (!this._playlist || lastCurrentIndex !== this._playlist.currentIndex || lastCurrentSong !== this._playlist.currentItem)
						return;

					if (!file)
						this.handleError(Strings.FileNotFoundOrNoPermissionError);
					else
						this.play(lastCurrentIndex, automaticCall);
				}, () => {
					if (!this._playlist || lastCurrentIndex !== this._playlist.currentIndex || lastCurrentSong !== this._playlist.currentItem)
						return;

					this.handleError(Strings.FileNotFoundOrNoPermissionError);
				});

				return;
			} else {
				this.handleError(Strings.MissingSongError);
				return;
			}
			source.onerror = this.boundPlaybackError;

			this.audio.appendChild(source);
			this.audio.load();

			if (this.songToResumeTime !== currentSong)
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

	public playSongId(id: number, automaticCall?: boolean): boolean {
		if (!this._alive || !this.audio || !this._playlist)
			return false;

		const i = this._playlist.findIndexById(id);
		if (i >= 0) {
			this.play(i, automaticCall);
			return true;
		}

		return false;
	}

	public playPause(): void {
		if (!this._alive || !this.audio)
			return;

		if (!this._currentSong || this.audio.paused)
			this.play();
		else
			this.pause();
	}

	public stop(): void {
		if (!this._alive || !this.audio)
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
				//queueMicrotask(this.boundNotifyLoadingChange);
				if (this.onloadingchange)
					this.onloadingchange(false);
				if (this.mediaSession)
					this.mediaSession.setLoading(false);
			}

			if (!this._paused) {
				this._paused = true;
				//queueMicrotask(this.boundNotifyPausedChange);
				if (this.onpausedchange)
					this.onpausedchange(true);
				if (this.mediaSession)
					this.mediaSession.setPaused(true);
			}

			this._currentSong = null;
			this.lastTimeS = -1;
			this.songToResumeTime = null;
			this.resumeTimeS = 0;
			//queueMicrotask(this.boundNotifySongChange);
			this.notifySongChange();
		}

		this.suspendAudioContext(false);
	}

	public seekForward(): void {
		if (!this._alive)
			return;

		this.seekTo(10000, true);
	}

	public next(automaticCall?: boolean): void {
		if (!this._alive || !this._playlist)
			return;

		this._playlist.moveCurrentToNext();
		this.play(-1, automaticCall);
	}

	public seekTo(timeMS: number, relative?: boolean): void {
		if (!this._alive || !this.audio || !this._currentSong || !this._currentSong.isSeekable || this._currentSong.lengthMS <= 0 || !this.audio.seekable || !this.audio.seekable.length)
			return;

		const timeS = Math.min(this.audio.duration || 0, Math.max(0, (timeMS / 1000) + (relative ? this.audio.currentTime : 0)));
		this.lastTimeS = timeS;
		this.audio.currentTime = timeS;
	}
}
