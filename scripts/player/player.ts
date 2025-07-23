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

interface AudioBundle {
	audio: AudioElement | HTMLAudioElement;
	sourceNode: SourceNode;
	nextSong: Song | null;
	boundPlaybackError: (e: Event | string, source?: string, lineno?: number, colno?: number, error?: Error) => void,
}

class Player {
	public static readonly minVolume = -40;

	private static readonly _nop = function () { };

	public readonly audioContext: AudioContext;
	private readonly _intermediateNodes: ConnectableNode[];
	private readonly _destinationNode: DestinationNode;

	private _audio: AudioElement | HTMLAudioElement | null;
	private _sourceNode: SourceNode | null;
	private _audioContextTimeout: number;
	private _audioContextSuspended: boolean;

	private _alive: boolean;
	private _loading: boolean;
	private _paused: boolean;
	private _volume: number;
	private _playlist: Playlist | null;
	private _currentPlaylistSong: Song | null;
	private _loadedSong: Song | null;
	private _songToResumeTime: Song | null;
	private _lastObjectURL: string | null;
	private _lastTimeS: number;
	private _resumeTimeS: number;
	private _songStartedAutomatically: boolean;
	private _mutedByHeadsetRemoval: boolean;
	private _firstFailedSongIndex: number;

	private _nextSongVersion: number;
	private _nextSongObjectURL: string | null;
	private _nextSongLoading: boolean;
	private _nextSongLoadedWithError: boolean;
	private _nextSongToPlayAfterLoading: Song | null;
	private _nextSongAlreadyChecked: Song | null;
	private _nextAudioBundle: AudioBundle | null;

	private readonly _mediaSession: HostMediaSession | null;

	private _boundPlaybackError: any;
	private readonly _boundNotifySongChange: any;
	private readonly _boundCheckAudioContext: any;
	private readonly _boundAutoNext: any;
	//private readonly _boundNotifyLoadingChange: any;
	//private readonly _boundNotifyPausedChange: any;

	public haltOnAllErrors: boolean;

	public onsongchange: ((song: Song | null, currentTimeS: number) => void) | null;
	public onloadingchange: ((loading: boolean) => void) | null;
	public onpausedchange: ((paused: boolean) => void) | null;
	public oncurrenttimeschange: ((currentTimeS: number) => void) | null;
	public onerror: ((message: string) => void) | null;

	public constructor(volume?: number, playlist?: Playlist | null, mediaSession?: HostMediaSession | null, ...intermediateNodesFactory: IntermediateNodeFactory[]) {
		this._audioContextTimeout = 0;
		this._audioContextSuspended = true;
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

		this._intermediateNodes = intermediateNodes;

		this._destinationNode = new DestinationNode(this.audioContext.destination);
		this._destinationNode.enabled = true;

		this.onsongchange = null;
		this.onloadingchange = null;
		this.onpausedchange = null;
		this.oncurrenttimeschange = null;
		this.onerror = null;

		this._boundPlaybackError = null;
		this._boundNotifySongChange = this.notifySongChange.bind(this);
		this._boundCheckAudioContext = this.checkAudioContext.bind(this);
		this._boundAutoNext = this.next.bind(this, true);
		//this._boundNotifyLoadingChange = this.notifyLoadingChange.bind(this);
		//this._boundNotifyPausedChange = this.notifyPausedChange.bind(this);

		this._alive = true;
		this._loading = false;
		this._paused = true;
		this._playlist = null;
		this._currentPlaylistSong = null;
		this._loadedSong = null;
		this._songToResumeTime = null;
		this._volume = 0;
		this._mutedByHeadsetRemoval = false;
		this._firstFailedSongIndex = -1;

		this._lastObjectURL = null;
		this._lastTimeS = -1;
		this._resumeTimeS = -1;
		this._songStartedAutomatically = true;
		this.haltOnAllErrors = false;

		this._nextSongVersion = 0;
		this._nextSongObjectURL = null;
		this._nextSongLoading = false;
		this._nextSongLoadedWithError = false;
		this._nextSongToPlayAfterLoading = null;
		this._nextSongAlreadyChecked = null;
		this._nextAudioBundle = null;

		this.volume = volume || 0;

		this._audio = null;
		this._sourceNode = null;

		this.recreateAudioPath();

		this._mediaSession = mediaSession || null;

		if (playlist)
			this.playlist = playlist;
	}

	private createAudioBundle(nextSong: Song | null, audioElement?: AudioElement | null): AudioBundle {
		const audio = (audioElement || document.createElement("audio")), // new Audio(),
			source = (("customProvider" in audio) ? audio.audioNode : this.audioContext.createMediaElementSource(audio)),
			sourceNode = new SourceNode(source),
			boundPlaybackError = (nextSong ?
				(e: Event | string, source?: string, lineno?: number, colno?: number, error?: Error) => {
					if (this._audio === audio) {
						// The next song became the current one
						this.playbackError(e, source, lineno, colno, error);
						return;
					}

					// The next song has not become the current one yet, so, just mark the end of the loading process and the error
					if (this._nextAudioBundle && this._nextAudioBundle.audio && this._nextAudioBundle.audio === audio && this._nextAudioBundle.nextSong === nextSong) {
						this._nextSongLoading = false;
						this._nextSongLoadedWithError = true;
					}
				} :
				(e: Event | string, source?: string, lineno?: number, colno?: number, error?: Error) => { if (this._audio === audio) this.playbackError(e, source, lineno, colno, error); }
			),
			audioBundle: AudioBundle = {
				audio,
				sourceNode,
				nextSong,
				boundPlaybackError
			};

		if (!("customProvider" in audio)) {
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
		}

		const boundPlaybackLoadStart = () => { if (this._audio === audio) this.playbackLoadStart(); };
		audio.onwaiting = boundPlaybackLoadStart;
		audio.onloadstart = boundPlaybackLoadStart;

		audio.oncanplay = (nextSong ?
			() => {
				if (this._audio === audio) {
					// The next song became the current one
					this.playbackLoadEnd();

					if (this._nextSongToPlayAfterLoading) {
						if (this._nextSongToPlayAfterLoading === nextSong) {
							this._nextSongLoading = false;
							this._nextSongLoadedWithError = false;
							this.nextSongPerformFinalPlaybackSteps();
						}
						this._nextSongToPlayAfterLoading = null;
					}
					return;
				}

				// The next song has not become the current one yet, so, just mark the end of the loading process
				if (this._playlist && this._nextAudioBundle && this._nextAudioBundle.audio && this._nextAudioBundle.audio === audio && this._nextAudioBundle.nextSong === nextSong) {
					this._nextSongLoading = false;
					this._nextSongLoadedWithError = false;
				}
			} :
			() => { if (this._audio === audio) this.playbackLoadEnd(); }
		);

		audio.onended = () => { if (this._audio === audio) this.playbackEnd(); };
		audio.onerror = boundPlaybackError;

		audio.onpause = () => { if (this._audio === audio) this.playbackPaused(); };

		const boundPlaybackStarted = () => { if (this._audio === audio) this.playbackStarted(); };
		//audio.onplay = boundPlaybackStarted;
		audio.onplaying = boundPlaybackStarted;

		const boundPlaybackAborted = () => { if (this._audio === audio) this.playbackAborted(); };
		audio.onabort = boundPlaybackAborted;
		audio.onemptied = boundPlaybackAborted;

		audio.ondurationchange = () => { if (this._audio === audio) this.playbackLengthChange(); };

		audio.ontimeupdate = () => { if (this._audio === audio) this.currentTimeChange(); };

		sourceNode.enabled = true;

		return audioBundle;
	}

	private destroyAudioElement(audio: AudioElement | HTMLAudioElement | null, reload: boolean, removeFromParent: boolean): void {
		if (!audio)
			return;

		if ("customProvider" in audio) {
			audio.destroy();
		} else {
			if (reload) {
				while (audio.firstChild)
					audio.removeChild(audio.firstChild);
				audio.load();
			}

			if (removeFromParent && audio.parentNode)
				audio.parentNode.removeChild(audio);
		}
	}

	private recreateAudioPath(audioElement?: AudioElement | null): void {
		const intermediateNodes = this._intermediateNodes;

		if (this._sourceNode)
			this._sourceNode.disconnectFromDestination();

		for (let i = intermediateNodes.length - 1; i >= 0; i--)
			intermediateNodes[i].disconnectFromDestination();

		this.destroyAudioElement(this._audio, false, true);

		const { audio, sourceNode, boundPlaybackError } = this.createAudioBundle(null, audioElement);

		this._audio = audio;
		this._sourceNode = sourceNode;
		this._boundPlaybackError = boundPlaybackError;

		if (intermediateNodes.length) {
			sourceNode.connectToDestination(intermediateNodes[0]);

			for (let i = 0; i < intermediateNodes.length - 1; i++)
				intermediateNodes[i].connectToDestination(intermediateNodes[i + 1]);

			intermediateNodes[intermediateNodes.length - 1].connectToDestination(this._destinationNode);
		} else {
			sourceNode.connectToDestination(this._destinationNode);
		}

		this.volume = this._volume;
	}

	public destroy(partial?: boolean): Promise<void> | void {
		this.stop();

		if (!partial) {
			if (this._playlist)
				this._playlist.destroy();

			const mediaSession = this._mediaSession;
			if (mediaSession && mediaSession.cleanUpMediaSession)
				mediaSession.cleanUpMediaSession();

			zeroObject(this);
		} else {
			this._alive = false;

			if (this._sourceNode)
				this._sourceNode.disconnectFromDestination();

			const intermediateNodes = this._intermediateNodes;
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
		if (this._audio)
			this._audio.volume = ((volume <= Player.minVolume) ? 0 : Math.pow(10, this._volume / 20));
	}

	public get playlist(): Playlist | null {
		return this._playlist;
	}

	public set playlist(playlist: Playlist | null) {
		if (!this._alive)
			return;

		const oldPlaylistSong = this._currentPlaylistSong;

		this.stop();
		this._playlist = playlist;

		if (playlist) {
			this._currentPlaylistSong = playlist.currentItem;

			if (playlist.currentIndexResumeTimeS > 0 && this._currentPlaylistSong) {
				this._songToResumeTime = this._currentPlaylistSong;
				this._lastTimeS = playlist.currentIndexResumeTimeS;
			} else {
				this._lastTimeS = 0;
			}
		}

		if (oldPlaylistSong !== this._currentPlaylistSong)
			this.notifySongChange();
	}

	public get currentSong(): Song | null {
		return this._currentPlaylistSong;
	}

	public get currentTimeMS(): number {
		if (this._loadedSong && this._audio) {
			try {
				const t = this._audio.currentTime || 0;
				this._lastTimeS = t;
				return (t * 1000) | 0;
			} catch (ex: any) {
				// Just ignore...
			}
		}
		return (this._lastTimeS * 1000) | 0;
	}

	private handleError(message: string): void {
		const lastTimeS = this._lastTimeS;

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

		if (!this._playlist || !this._playlist.length) {
			notifyError = true;
		} else if (lastTimeS < 0) {
			notifyError = !this._songStartedAutomatically;
			if (notifyError) {
				this._firstFailedSongIndex = -1;
			} else if (this._firstFailedSongIndex < 0 || this._firstFailedSongIndex >= this._playlist.length) {
				this._firstFailedSongIndex = this._playlist.currentIndex;
			} else if (this._firstFailedSongIndex === this._playlist.currentIndex) {
				this._firstFailedSongIndex = -1;
				notifyError = true;
			}
		}

		if (notifyError && this.onerror)
			this.onerror(message);
		else
			queueMicrotask(this._boundAutoNext);
	}

	private audioContextStateChange(): void {
		if (!this._alive)
			return;

		if (this.audioContext.state !== "running" && !this._audioContextSuspended) {
			this._audioContextSuspended = true;
			this.playbackPaused();
		}
	}

	private playbackLoadStart(): void {
		if (!this._alive || this._loading)
			return;

		this._loading = true;
		//queueMicrotask(this._boundNotifyLoadingChange);
		if (this.onloadingchange)
			this.onloadingchange(true);
		if (this._mediaSession)
			this._mediaSession.setLoading(true, this._currentPlaylistSong ? this._currentPlaylistSong.lengthMS : 0, this._lastTimeS);
	}

	private playbackLoadEnd(): void {
		if (!this._alive || !this._loading)
			return;

		this._loading = false;

		if (this._songToResumeTime) {
			if (this._audio && this._songToResumeTime === this._loadedSong && this._resumeTimeS > 0) {
				try {
					this._audio.currentTime = this._resumeTimeS;
				} catch (ex: any) {
					// Just ignore...
				}
				const playPromise = this._audio.play();
				if (playPromise)
					playPromise.catch(Player._nop);
			}
			this._songToResumeTime = null;
		}

		//queueMicrotask(this._boundNotifyLoadingChange);
		if (this.onloadingchange)
			this.onloadingchange(false);
		if (this._mediaSession)
			this._mediaSession.setLoading(false, this._currentPlaylistSong ? this._currentPlaylistSong.lengthMS : 0, this._lastTimeS);
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
		if (this._audioContextTimeout) {
			clearTimeout(this._audioContextTimeout);
			this._audioContextTimeout = 0;
		}

		if (!this._audioContextSuspended) {
			if (delay) {
				this._audioContextTimeout = window.setTimeout(this._boundCheckAudioContext, 5000);
			} else {
				this._audioContextSuspended = true;
				this.audioContext.suspend();
			}
		}
	}

	private resumeAudioContext(): void {
		if (this._audioContextTimeout) {
			clearTimeout(this._audioContextTimeout);
			this._audioContextTimeout = 0;
		}

		if (this._audioContextSuspended || this.audioContext.state !== "running") {
			this._audioContextSuspended = false;
			this.audioContext.resume();
		}
	}

	private checkAudioContext(): void {
		this._audioContextTimeout = 0;

		if (this._paused) {
			if (!this._audioContextSuspended) {
				this._audioContextSuspended = true;
				this.audioContext.suspend();
			}
		} else {
			if (this._audioContextSuspended) {
				this._audioContextSuspended = false;
				this.audioContext.resume();
			}
		}
	}

	private playbackPaused(): void {
		if (!this._alive || this._paused)
			return;

		this._paused = true;
		this.suspendAudioContext(true);
		//queueMicrotask(this._boundNotifyPausedChange);
		if (this._audio) {
			try {
				this._lastTimeS = this._audio.currentTime || 0;
			} catch (ex: any) {
				// Just ignore...
			}
		}
		if (this.onpausedchange)
			this.onpausedchange(true);
		if (this._mediaSession)
			this._mediaSession.setPaused(true, this._currentPlaylistSong ? this._currentPlaylistSong.lengthMS : 0, this._lastTimeS);
	}

	private playbackStarted(): void {
		if (!this._alive || !this._paused)
			return;

		// Prevent resuming the playback in the case explained in headsetRemoved()
		if (this._mutedByHeadsetRemoval) {
			this._mutedByHeadsetRemoval = false;
			if (this._audio) {
				this._audio.pause();
				this._audio.muted = false;
				return;
			}
		}

		this._firstFailedSongIndex = -1;
		this._paused = false;
		this.resumeAudioContext();
		//queueMicrotask(this._boundNotifyPausedChange);
		if (this._audio) {
			try {
				this._lastTimeS = this._audio.currentTime || 0;
			} catch (ex: any) {
				// Just ignore...
			}
		}
		if (this.onpausedchange)
			this.onpausedchange(false);
		if (this._mediaSession)
			this._mediaSession.setPaused(false, this._currentPlaylistSong ? this._currentPlaylistSong.lengthMS : 0, this._lastTimeS);
	}

	private playbackAborted(): void {
		if (!this._alive)
			return;

		if (this._loading) {
			this._loading = false;
			//queueMicrotask(this._boundNotifyLoadingChange);
			if (this.onloadingchange)
				this.onloadingchange(false);
			if (this._mediaSession)
				this._mediaSession.setLoading(false, this._currentPlaylistSong ? this._currentPlaylistSong.lengthMS : 0, 0);
		}

		if (!this._paused) {
			this._paused = true;
			this.suspendAudioContext(true);
			//queueMicrotask(this._boundNotifyPausedChange);
			if (this.onpausedchange)
				this.onpausedchange(true);
			if (this._mediaSession)
				this._mediaSession.setPaused(true, this._currentPlaylistSong ? this._currentPlaylistSong.lengthMS : 0, 0);
		}
	}

	private playbackLengthChange(): void {
		if (!this._alive || !this._audio || !this._playlist || !this._loadedSong)
			return;

		if (this._playlist.updateSongLength(this._loadedSong, this._audio.duration))
			this.notifySongChange();
	}

	private currentTimeChange(): void {
		if (!this._alive || !this._audio || !this._loadedSong)
			return;

		try {
			this._lastTimeS = this._audio.currentTime || 0;
		} catch (ex: any) {
			// Just ignore...
		}

		// Do not call notifyCurrentTimeSChange(), because this will
		// unnecessarily forward the notification to the media session.
		if (this.oncurrenttimeschange)
			this.oncurrenttimeschange(this._lastTimeS);
	}

	private notifyMediaSessionChange(): void {
		if (!this._mediaSession)
			return;

		const currentPlaylistSong = this._currentPlaylistSong;
		if (currentPlaylistSong)
			this._mediaSession.setMetadata(currentPlaylistSong.id, currentPlaylistSong.title, currentPlaylistSong.artist, currentPlaylistSong.album, currentPlaylistSong.track, currentPlaylistSong.year, currentPlaylistSong.lengthMS, this._lastTimeS);
		else
			this._mediaSession.setMetadata(0, null, null, null, 0, 0, 0, 0);
	}

	private notifyCurrentTimeSChange(): void {
		if (!this._alive)
			return;

		if (this.oncurrenttimeschange)
			this.oncurrenttimeschange(this._lastTimeS);

		this.notifyMediaSessionChange();
	}

	private notifySongChange(): void {
		if (!this._alive)
			return;

		if (this.onsongchange)
			this.onsongchange(this._currentPlaylistSong, this._lastTimeS);

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

	private destroyNextAudioBundle(): void {
		this._nextSongVersion++;

		if (this._nextSongObjectURL) {
			URL.revokeObjectURL(this._nextSongObjectURL);
			this._nextSongObjectURL = null;
		}

		if (this._nextAudioBundle) {
			const audioBundle = this._nextAudioBundle;
			this._nextAudioBundle = null;

			this.destroyAudioElement(audioBundle.audio, true, true);

			zeroObject(audioBundle, true);
		}

		this._nextSongLoading = false;
		this._nextSongLoadedWithError = false;
		this._nextSongToPlayAfterLoading = null;
		this._nextSongAlreadyChecked = null;
	}

	public preloadNextSong(): void {
		if (!this._alive || !this._playlist)
			return;

		const nextSong = this._playlist.nextItem;
		if (this._nextSongAlreadyChecked === nextSong)
			return;

		this.destroyNextAudioBundle();

		this._nextSongAlreadyChecked = nextSong;

		if (!nextSong || nextSong.customProvider || (!nextSong.isLocalURL && !nextSong.isFileURL))
			return;

		try {
			const currentVersion = this._nextSongVersion;
			const audioBundle = this.createAudioBundle(nextSong);
			const boundPlaybackError = audioBundle.boundPlaybackError;
			this._nextAudioBundle = audioBundle;

			this._nextSongLoading = true;
			this._nextSongToPlayAfterLoading = null;

			const finishSourceSetup = (src: string | null) => {
				if (currentVersion !== this._nextSongVersion)
					return;

				// If the process takes a long time, audioBundle.audio might be set to null inside play()
				if (!audioBundle.audio) {
					if (this._audio) {
						if (!src)
							this._lastObjectURL = URL.createObjectURL(nextSong.file as File);

						const source = document.createElement("source");
						source.src = (src || this._lastObjectURL as string);
						source.onerror = boundPlaybackError;

						(this._audio as HTMLAudioElement).appendChild(source);
						this._audio.load();
					}
				} else {
					if (!src)
						this._nextSongObjectURL = URL.createObjectURL(nextSong.file as File);

					const source = document.createElement("source");
					source.src = (src || this._nextSongObjectURL as string);
					source.onerror = boundPlaybackError;

					(audioBundle.audio as HTMLAudioElement).appendChild(source);
					audioBundle.audio.load();
				}
			};

			if (nextSong.file || nextSong.isFileURL) {
				finishSourceSetup(nextSong.file ? null : nextSong.url);
			} else {
				FileSystemAPI.getFile(nextSong.absolutePath).then((file) => {
					if (!this._playlist || currentVersion !== this._nextSongVersion)
						return;

					if (!this._nextAudioBundle) {
						// If the process takes a long time, this.nextAudioBundle might be set to null inside play()
						if (!this._nextSongLoading || this._nextSongToPlayAfterLoading !== nextSong)
							return;
					} else if (this._nextAudioBundle !== audioBundle || this._nextAudioBundle.nextSong !== nextSong) {
						return;
					}

					if (!file) {
						boundPlaybackError(Strings.FileNotFoundOrNoPermissionError);
					} else {
						nextSong.file = file;
						finishSourceSetup(null);
					}
				}, (reason) => {
					boundPlaybackError(Strings.UnknownError, undefined, undefined, undefined, reason);
				});
			}
		} catch (ex: any) {
			this.destroyNextAudioBundle();
		}
	}

	private nextSongPerformFinalPlaybackSteps(): void {
		this.resumeAudioContext();
		(this._audio as AudioElement).play().catch(Player._nop);
		// If this callback has actually been called, it was suppressed while the song was pre loading
		this.playbackLengthChange();
	}

	public setPlaylistData(): void {
		const playlist = this._playlist;

		if (!playlist)
			return;

		playlist.currentIndexResumeTimeS = this._lastTimeS;
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

		if (this._loadedSong && this._audio)
			this._audio.pause();
	}

	private playCustomProvider(song: Song): void {
		if (!song.customProvider)
			return;

		const audioElement = song.customProvider.createAudioElement(this.audioContext, song, () => this.suspendAudioContext(false), () => this.resumeAudioContext());

		this.recreateAudioPath(audioElement);

		audioElement.load();

		audioElement.play().catch(Player._nop);
	}

	public play(index?: number, automaticCall?: boolean): void {
		if (!this._alive || !this._audio)
			return;

		if (this._mutedByHeadsetRemoval && this._audio) {
			this._mutedByHeadsetRemoval = false;
			this._audio.muted = false;
		}

		let playPromise: Promise<void> | undefined;

		if (this._loadedSong && index === undefined) {
			this.resumeAudioContext();

			playPromise = this._audio.play();
		} else if (this._playlist) {
			if (index !== undefined && index >= 0)
				this._playlist.currentIndex = index;

			let currentPlaylistSong = this._playlist.currentItem;

			if (!currentPlaylistSong && this._playlist.length) {
				this._playlist.moveCurrentToNext();
				currentPlaylistSong = this._playlist.currentItem;
			}

			if (!currentPlaylistSong) {
				this.stop();
				return;
			}

			this._loadedSong = currentPlaylistSong;
			this._resumeTimeS = this._lastTimeS;
			this._lastTimeS = -1;
			this._songStartedAutomatically = !!automaticCall;
			if (this._currentPlaylistSong !== currentPlaylistSong) {
				this._currentPlaylistSong = currentPlaylistSong;
				queueMicrotask(this._boundNotifySongChange);
			}

			this._nextSongToPlayAfterLoading = null;

			if (this._nextAudioBundle) {
				const audioBundle = this._nextAudioBundle;

				if (audioBundle.nextSong === currentPlaylistSong) {
					if (!this._nextSongLoadedWithError) {
						const oldAudio = this._audio;

						this._resumeTimeS = -1;
						this._songToResumeTime = null;

						if (this._lastObjectURL)
							URL.revokeObjectURL(this._lastObjectURL);
						this._lastObjectURL = this._nextSongObjectURL;
						this._nextSongObjectURL = null;
						this._nextAudioBundle = null;

						if (this._nextSongLoading) {
							// If the next song is still loading, just indicate it is now the current one and trigger onloadingchange
							// Call pause() to suspend the audio context
							this.pause();
							this.playbackLoadStart();
							this._nextSongToPlayAfterLoading = currentPlaylistSong;
						} else {
							// The next song has already been successfully loaded
							// Do not call this.pause() in order not to pause current audio
							this._audio.pause();
						}

						if (this._sourceNode)
							this._sourceNode.disconnectFromDestination();

						this._sourceNode = audioBundle.sourceNode;
						this._sourceNode.connectToDestination(this._intermediateNodes.length ? this._intermediateNodes[0] : this._destinationNode);

						this._audio = audioBundle.audio;

						this.volume = this._volume;

						if (!this._nextSongLoading)
							this.nextSongPerformFinalPlaybackSteps();

						zeroObject(audioBundle, true);

						this.destroyAudioElement(oldAudio, true, true);

						return;
					}
				}
			}

			this.destroyNextAudioBundle();

			if ("customProvider" in this._audio) {
				this._audio.destroy();

				// Previous song used a custom provider, but the new one does not, so we need to recreate the audio path
				if (!currentPlaylistSong.customProvider)
					this.recreateAudioPath();
			} else {
				while (this._audio.firstChild)
					this._audio.removeChild(this._audio.firstChild);
			}

			if (currentPlaylistSong.customProvider) {
				// Use the custom provider to load and play the song
				this.playCustomProvider(currentPlaylistSong);
				return;
			}

			this.resumeAudioContext();

			const source = document.createElement("source");
			if (currentPlaylistSong.url && !currentPlaylistSong.isLocalURL) {
				source.src = currentPlaylistSong.url;
			} else if (currentPlaylistSong.file) {
				if (this._lastObjectURL)
					URL.revokeObjectURL(this._lastObjectURL);
				this._lastObjectURL = URL.createObjectURL(currentPlaylistSong.file);
				source.src = this._lastObjectURL;
			} else if (currentPlaylistSong.url) {
				this.pause();

				const lastCurrentIndex = this._playlist.currentIndex,
					lastCurrentPlaylistSong = this._playlist.currentItem;

				FileSystemAPI.getFile(currentPlaylistSong.absolutePath).then((file) => {
					if (lastCurrentPlaylistSong && !lastCurrentPlaylistSong.file && file)
						lastCurrentPlaylistSong.file = file;

					if (!this._playlist || lastCurrentIndex !== this._playlist.currentIndex || lastCurrentPlaylistSong !== this._playlist.currentItem)
						return;

					if (!file) {
						this.handleError(Strings.FileNotFoundOrNoPermissionError);
					} else {
						// Restore the value because play() is about to be called again, and this.lastTimeS is -1 now
						this._lastTimeS = this._resumeTimeS;
						this.play(lastCurrentIndex, automaticCall);
					}
				}, () => {
					if (!this._playlist || lastCurrentIndex !== this._playlist.currentIndex || lastCurrentPlaylistSong !== this._playlist.currentItem)
						return;

					this.handleError(Strings.FileNotFoundOrNoPermissionError);
				});

				return;
			} else {
				this.handleError(Strings.MissingSongError);
				return;
			}
			source.onerror = this._boundPlaybackError;

			(this._audio as HTMLAudioElement).appendChild(source);
			this._audio.load();

			if (this._songToResumeTime !== currentPlaylistSong || !this._resumeTimeS || this._resumeTimeS <= 0)
				playPromise = this._audio.play();
		}

		// https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/load#usage_notes
		// The process of aborting any ongoing activities will cause any outstanding Promises
		// returned by play() being resolved or rejected as appropriate based on their status
		// before the loading of new media can begin. Pending play promises are aborted with
		// an "AbortError" DOMException.
		if (playPromise)
			playPromise.catch(Player._nop);
	}

	public playSongId(id: number, automaticCall?: boolean): boolean {
		if (!this._alive || !this._audio || !this._playlist)
			return false;

		const i = this._playlist.findIndexById(id);
		if (i >= 0) {
			this.play(i, automaticCall);
			return true;
		}

		return false;
	}

	public playPause(): void {
		if (!this._alive || !this._audio)
			return;

		if (!this._loadedSong || this._audio.paused)
			this.play();
		else
			this.pause();
	}

	public stop(): void {
		if (!this._alive || !this._audio)
			return;

		this._loadedSong = null;
		this._songToResumeTime = null;
		this._lastTimeS = -1;

		this.destroyNextAudioBundle();

		if (this._currentPlaylistSong) {
			// Try to force a kWebMediaPlayerDestroyed event without causing onerror
			// and other undesirable events.
			//this.audio.removeAttribute("src");
			//this.audio.src = "";
			this.destroyAudioElement(this._audio, true, false);

			if (this._lastObjectURL) {
				URL.revokeObjectURL(this._lastObjectURL);
				this._lastObjectURL = null;
			}

			if (this._loading) {
				this._loading = false;
				//queueMicrotask(this._boundNotifyLoadingChange);
				if (this.onloadingchange)
					this.onloadingchange(false);
				if (this._mediaSession)
					this._mediaSession.setLoading(false, 0, 0);
			}

			if (!this._paused) {
				this._paused = true;
				//queueMicrotask(this._boundNotifyPausedChange);
				if (this.onpausedchange)
					this.onpausedchange(true);
				if (this._mediaSession)
					this._mediaSession.setPaused(true, 0, 0);
			}

			this._currentPlaylistSong = null;
			//queueMicrotask(this._boundNotifySongChange);
			this.notifySongChange();
		}

		this._loadedSong = null;
		this._songToResumeTime = null;
		this._lastTimeS = -1;

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
		if (!this._alive || !this._currentPlaylistSong || !this._currentPlaylistSong.isSeekable || this._currentPlaylistSong.lengthMS <= 0)
			return;

		if (!this._loadedSong) {
			if (!this._songToResumeTime)
				this._songToResumeTime = this._currentPlaylistSong;

			if (this._songToResumeTime === this._currentPlaylistSong) {
				this._lastTimeS = Math.min(
					Math.max(0, this._currentPlaylistSong.lengthMS),
					Math.max(0, timeMS + (relative ? ((Math.max(0, this._lastTimeS) * 1000) | 0) : 0))
				) / 1000;
				this.notifyCurrentTimeSChange();
			}
			return;
		}

		if (!this._audio || !this._audio.seekable || !this._audio.seekable.length)
			return;

		try {
			const timeS = Math.min(
				this._audio.duration || 0,
				Math.max(0, (timeMS / 1000) + (relative ? (this._audio.currentTime || 0) : 0))
			);
			this._lastTimeS = timeS;
			this._audio.currentTime = timeS;
		} catch (ex: any) {
			// Just ignore...
		}

		this.notifyCurrentTimeSChange();
	}

	public headsetRemoved(): void {
		if (!this._alive || !this._audio)
			return;

		if (this._audio.paused) {
			if (this._loadedSong) {
				// This is an unusual case where the playback was paused before
				// the removal of the headset. We must keep track of this in order
				// to try to prevent the song from restarting automatically in cases
				// like when the playback was happening through the headset, the user
				// starts/receives a call without pausing the song, removes the headset
				// and then ends the call.
				this._audio.muted = true;
				this._mutedByHeadsetRemoval = true;
			}
		} else {
			this.pause();
		}
	}
}
