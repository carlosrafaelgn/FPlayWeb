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
	audio: HTMLAudioElement;
	sourceNode: SourceNode;
	nextSong: Song | null;
	boundPlaybackError: (e: Event | string, source?: string, lineno?: number, colno?: number, error?: Error) => void,
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
	private currentPlaylistSong: Song | null;
	private loadedSong: Song | null;
	private songToResumeTime: Song | null;
	private lastObjectURL: string | null;
	private lastTimeS: number;
	private resumeTimeS: number;
	private songStartedAutomatically: boolean;
	private mutedByHeadsetRemoval: boolean;
	private firstFailedSongIndex: number;

	private nextSongVersion: number;
	private nextSongObjectURL: string | null;
	private nextSongLoading: boolean;
	private nextSongLoadedWithError: boolean;
	private nextSongToPlayAfterLoading: Song | null;
	private nextSongAlreadyChecked: Song | null;
	private nextAudioBundle: AudioBundle | null;

	private readonly mediaSession: HostMediaSession | null;

	private boundPlaybackError: any;
	private readonly boundNotifySongChange: any;
	private readonly boundCheckAudioContext: any;
	private readonly boundAutoNext: any;
	//private readonly boundNotifyLoadingChange: any;
	//private readonly boundNotifyPausedChange: any;

	public haltOnAllErrors: boolean;

	public onsongchange: ((song: Song | null, currentTimeS: number) => void) | null;
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
		this.currentPlaylistSong = null;
		this.loadedSong = null;
		this.songToResumeTime = null;
		this._volume = 0;
		this.mutedByHeadsetRemoval = false;
		this.firstFailedSongIndex = -1;

		this.lastObjectURL = null;
		this.lastTimeS = -1;
		this.resumeTimeS = -1;
		this.songStartedAutomatically = true;
		this.haltOnAllErrors = false;

		this.nextSongVersion = 0;
		this.nextSongObjectURL = null;
		this.nextSongLoading = false;
		this.nextSongLoadedWithError = false;
		this.nextSongToPlayAfterLoading = null;
		this.nextSongAlreadyChecked = null;
		this.nextAudioBundle = null;

		this.volume = volume || 0;

		this.audio = null;
		this.sourceNode = null;

		this.recreateAudioPath();

		this.mediaSession = mediaSession || null;

		if (playlist)
			this.playlist = playlist;
	}

	private createAudioBundle(nextSong: Song | null): AudioBundle {
		const audio = document.createElement("audio"), // new Audio(),
			source = this.audioContext.createMediaElementSource(audio),
			sourceNode = new SourceNode(source),
			boundPlaybackError = (nextSong ?
				(e: Event | string, source?: string, lineno?: number, colno?: number, error?: Error) => {
					if (this.audio === audio) {
						// The next song became the current one
						this.playbackError(e, source, lineno, colno, error);
						return;
					}

					// The next song has not become the current one yet, so, just mark the end of the loading process and the error
					if (this.nextAudioBundle && this.nextAudioBundle.audio && this.nextAudioBundle.audio === audio && this.nextAudioBundle.nextSong === nextSong) {
						this.nextSongLoading = false;
						this.nextSongLoadedWithError = true;
					}
				} :
				(e: Event | string, source?: string, lineno?: number, colno?: number, error?: Error) => { if (this.audio === audio) this.playbackError(e, source, lineno, colno, error); }
			),
			audioBundle: AudioBundle = {
				audio,
				sourceNode,
				nextSong,
				boundPlaybackError
			};

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

		const boundPlaybackLoadStart = () => { if (this.audio === audio) this.playbackLoadStart(); };
		audio.onwaiting = boundPlaybackLoadStart;
		audio.onloadstart = boundPlaybackLoadStart;

		audio.oncanplay = (nextSong ?
			() => {
				if (this.audio === audio) {
					// The next song became the current one
					this.playbackLoadEnd();

					if (this.nextSongToPlayAfterLoading) {
						if (this.nextSongToPlayAfterLoading === nextSong) {
							this.nextSongLoading = false;
							this.nextSongLoadedWithError = false;
							this.nextSongPerformFinalPlaybackSteps();
						}
						this.nextSongToPlayAfterLoading = null;
					}
					return;
				}

				// The next song has not become the current one yet, so, just mark the end of the loading process
				if (this._playlist && this.nextAudioBundle && this.nextAudioBundle.audio && this.nextAudioBundle.audio === audio && this.nextAudioBundle.nextSong === nextSong) {
					this.nextSongLoading = false;
					this.nextSongLoadedWithError = false;
				}
			} :
			() => { if (this.audio === audio) this.playbackLoadEnd(); }
		);

		audio.onended = () => { if (this.audio === audio) this.playbackEnd(); };
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

		return audioBundle;
	}

	private recreateAudioPath(): void {
		const intermediateNodes = this.intermediateNodes;

		if (this.sourceNode)
			this.sourceNode.disconnectFromDestination();

		for (let i = intermediateNodes.length - 1; i >= 0; i--)
			intermediateNodes[i].disconnectFromDestination();

		if (this.audio)
			document.body.removeChild(this.audio);

		const { audio, sourceNode, boundPlaybackError } = this.createAudioBundle(null);

		this.audio = audio;
		this.sourceNode = sourceNode;
		this.boundPlaybackError = boundPlaybackError;

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

		const oldPlaylistSong = this.currentPlaylistSong;

		this.stop();
		this._playlist = playlist;

		if (playlist) {
			this.currentPlaylistSong = playlist.currentItem;

			if (playlist.currentIndexResumeTimeS > 0 && this.currentPlaylistSong) {
				this.songToResumeTime = this.currentPlaylistSong;
				this.lastTimeS = playlist.currentIndexResumeTimeS;
			} else {
				this.lastTimeS = 0;
			}
		}

		if (oldPlaylistSong !== this.currentPlaylistSong)
			this.notifySongChange();
	}

	public get currentSong(): Song | null {
		return this.currentPlaylistSong;
	}

	public get currentTimeMS(): number {
		if (this.loadedSong && this.audio) {
			try {
				const t = this.audio.currentTime || 0;
				this.lastTimeS = t;
				return (t * 1000) | 0;
			} catch (ex: any) {
				// Just ignore...
			}
		}
		return (this.lastTimeS * 1000) | 0;
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

		if (!this._playlist || !this._playlist.length) {
			notifyError = true;
		} else if (lastTimeS < 0) {
			notifyError = !this.songStartedAutomatically;
			if (notifyError) {
				this.firstFailedSongIndex = -1;
			} else if (this.firstFailedSongIndex < 0 || this.firstFailedSongIndex >= this._playlist.length) {
				this.firstFailedSongIndex = this._playlist.currentIndex;
			} else if (this.firstFailedSongIndex === this._playlist.currentIndex) {
				this.firstFailedSongIndex = -1;
				notifyError = true;
			}
		}

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
			this.mediaSession.setLoading(true, this.currentPlaylistSong ? this.currentPlaylistSong.lengthMS : 0, this.lastTimeS);
	}

	private playbackLoadEnd(): void {
		if (!this._alive || !this._loading)
			return;

		this._loading = false;

		if (this.songToResumeTime) {
			if (this.audio && this.songToResumeTime === this.loadedSong && this.resumeTimeS > 0) {
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
		}

		//queueMicrotask(this.boundNotifyLoadingChange);
		if (this.onloadingchange)
			this.onloadingchange(false);
		if (this.mediaSession)
			this.mediaSession.setLoading(false, this.currentPlaylistSong ? this.currentPlaylistSong.lengthMS : 0, this.lastTimeS);
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
		if (this.audio) {
			try {
				this.lastTimeS = this.audio.currentTime || 0;
			} catch (ex: any) {
				// Just ignore...
			}
		}
		if (this.onpausedchange)
			this.onpausedchange(true);
		if (this.mediaSession)
			this.mediaSession.setPaused(true, this.currentPlaylistSong ? this.currentPlaylistSong.lengthMS : 0, this.lastTimeS);
	}

	private playbackStarted(): void {
		if (!this._alive || !this._paused)
			return;

		// Prevent resuming the playback in the case explained in headsetRemoved()
		if (this.mutedByHeadsetRemoval) {
			this.mutedByHeadsetRemoval = false;
			if (this.audio) {
				this.audio.pause();
				this.audio.muted = false;
				return;
			}
		}

		this.firstFailedSongIndex = -1;
		this._paused = false;
		this.resumeAudioContext();
		//queueMicrotask(this.boundNotifyPausedChange);
		if (this.audio) {
			try {
				this.lastTimeS = this.audio.currentTime || 0;
			} catch (ex: any) {
				// Just ignore...
			}
		}
		if (this.onpausedchange)
			this.onpausedchange(false);
		if (this.mediaSession)
			this.mediaSession.setPaused(false, this.currentPlaylistSong ? this.currentPlaylistSong.lengthMS : 0, this.lastTimeS);
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
				this.mediaSession.setLoading(false, this.currentPlaylistSong ? this.currentPlaylistSong.lengthMS : 0, 0);
		}

		if (!this._paused) {
			this._paused = true;
			this.suspendAudioContext(true);
			//queueMicrotask(this.boundNotifyPausedChange);
			if (this.onpausedchange)
				this.onpausedchange(true);
			if (this.mediaSession)
				this.mediaSession.setPaused(true, this.currentPlaylistSong ? this.currentPlaylistSong.lengthMS : 0, 0);
		}
	}

	private playbackLengthChange(): void {
		if (!this._alive || !this.audio || !this._playlist || !this.loadedSong)
			return;

		if (this._playlist.updateSongLength(this.loadedSong, this.audio.duration))
			this.notifySongChange();
	}

	private currentTimeChange(): void {
		if (!this._alive || !this.audio || !this.loadedSong)
			return;

		try {
			this.lastTimeS = this.audio.currentTime || 0;
		} catch (ex: any) {
			// Just ignore...
		}

		// Do not call notifyCurrentTimeSChange(), because this will
		// unnecessarily forward the notification to the media session.
		if (this.oncurrenttimeschange)
			this.oncurrenttimeschange(this.lastTimeS);
	}

	private notifyMediaSessionChange(): void {
		if (!this.mediaSession)
			return;

		const currentPlaylistSong = this.currentPlaylistSong;
		if (currentPlaylistSong)
			this.mediaSession.setMetadata(currentPlaylistSong.id, currentPlaylistSong.title, currentPlaylistSong.artist, currentPlaylistSong.album, currentPlaylistSong.track, currentPlaylistSong.year, currentPlaylistSong.lengthMS, this.lastTimeS);
		else
			this.mediaSession.setMetadata(0, null, null, null, 0, 0, 0, 0);
	}

	private notifyCurrentTimeSChange(): void {
		if (!this._alive)
			return;

		if (this.oncurrenttimeschange)
			this.oncurrenttimeschange(this.lastTimeS);

		this.notifyMediaSessionChange();
	}

	private notifySongChange(): void {
		if (!this._alive)
			return;

		if (this.onsongchange)
			this.onsongchange(this.currentPlaylistSong, this.lastTimeS);

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
		this.nextSongVersion++;

		if (this.nextSongObjectURL) {
			URL.revokeObjectURL(this.nextSongObjectURL);
			this.nextSongObjectURL = null;
		}

		if (this.nextAudioBundle) {
			const audioBundle = this.nextAudioBundle;
			this.nextAudioBundle = null;

			if (audioBundle.audio) {
				while (audioBundle.audio.firstChild)
					audioBundle.audio.removeChild(audioBundle.audio.firstChild);
				audioBundle.audio.load();

				if (audioBundle.audio.parentNode)
					audioBundle.audio.parentNode.removeChild(audioBundle.audio);
			}

			zeroObject(audioBundle, true);
		}

		this.nextSongLoading = false;
		this.nextSongLoadedWithError = false;
		this.nextSongToPlayAfterLoading = null;
		this.nextSongAlreadyChecked = null;
	}

	public preloadNextSong(): void {
		if (!this._alive || !this._playlist)
			return;

		const nextSong = this._playlist.nextItem;
		if (this.nextSongAlreadyChecked === nextSong)
			return;

		this.destroyNextAudioBundle();

		this.nextSongAlreadyChecked = nextSong;

		if (!nextSong || !nextSong.url || (!nextSong.url.startsWith(FileUtils.localURLPrefix) && !nextSong.url.startsWith(FileUtils.fileURLPrefix)))
			return;

		try {
			const currentVersion = this.nextSongVersion;
			const audioBundle = this.createAudioBundle(nextSong);
			const boundPlaybackError = audioBundle.boundPlaybackError;
			this.nextAudioBundle = audioBundle;

			this.nextSongLoading = true;
			this.nextSongToPlayAfterLoading = null;

			const finishSourceSetup = (src: string | null) => {
				if (currentVersion !== this.nextSongVersion)
					return;

				// If the process takes a long time, audioBundle.audio might be set to null inside play()
				if (!audioBundle.audio) {
					if (this.audio) {
						if (!src)
							this.lastObjectURL = URL.createObjectURL(nextSong.file as File);

						const source = document.createElement("source");
						source.src = (src || this.lastObjectURL as string);
						source.onerror = boundPlaybackError;

						this.audio.appendChild(source);
						this.audio.load();
					}
				} else {
					if (!src)
						this.nextSongObjectURL = URL.createObjectURL(nextSong.file as File);

					const source = document.createElement("source");
					source.src = (src || this.nextSongObjectURL as string);
					source.onerror = boundPlaybackError;

					audioBundle.audio.appendChild(source);
					audioBundle.audio.load();
				}
			};

			const fileURL = (nextSong.url.startsWith(FileUtils.fileURLPrefix) ? nextSong.url : null);

			if (nextSong.file || fileURL) {
				finishSourceSetup(nextSong.file ? null : fileURL);
			} else {
				FileSystemAPI.getFile(nextSong.url.substring(FileUtils.localURLPrefix.length)).then((file) => {
					if (!this._playlist || currentVersion !== this.nextSongVersion)
						return;

					if (!this.nextAudioBundle) {
						// If the process takes a long time, this.nextAudioBundle might be set to null inside play()
						if (!this.nextSongLoading || this.nextSongToPlayAfterLoading !== nextSong)
							return;
					} else if (this.nextAudioBundle !== audioBundle || this.nextAudioBundle.nextSong !== nextSong) {
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
		(this.audio as HTMLAudioElement).play().catch(Player.nop);
		// If this callback has actually been called, it was suppressed while the song was pre loading
		this.playbackLengthChange();
	}

	public setPlaylistData(): void {
		const playlist = this._playlist;

		if (!playlist)
			return;

		playlist.currentIndexResumeTimeS = this.lastTimeS;
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

		if (this.loadedSong && this.audio)
			this.audio.pause();
	}

	public play(index?: number, automaticCall?: boolean): void {
		if (!this._alive || !this.audio)
			return;

		if (this.mutedByHeadsetRemoval && this.audio) {
			this.mutedByHeadsetRemoval = false;
			this.audio.muted = false;
		}

		let playPromise: Promise<void> | undefined;

		if (this.loadedSong && index === undefined) {
			this.resumeAudioContext();

			playPromise = this.audio.play();
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

			this.loadedSong = currentPlaylistSong;
			this.resumeTimeS = this.lastTimeS;
			this.lastTimeS = -1;
			this.songStartedAutomatically = !!automaticCall;
			if (this.currentPlaylistSong !== currentPlaylistSong) {
				this.currentPlaylistSong = currentPlaylistSong;
				queueMicrotask(this.boundNotifySongChange);
			}

			this.nextSongToPlayAfterLoading = null;

			if (this.nextAudioBundle) {
				const audioBundle = this.nextAudioBundle;

				if (audioBundle.nextSong === currentPlaylistSong) {
					if (!this.nextSongLoadedWithError) {
						const oldAudio = this.audio;

						this.resumeTimeS = -1;
						this.songToResumeTime = null;

						if (this.lastObjectURL)
							URL.revokeObjectURL(this.lastObjectURL);
						this.lastObjectURL = this.nextSongObjectURL;
						this.nextSongObjectURL = null;
						this.nextAudioBundle = null;

						if (this.nextSongLoading) {
							// If the next song is still loading, just indicate it is now the current one and trigger onloadingchange
							// Call pause() to suspend the audio context
							this.pause();
							this.playbackLoadStart();
							this.nextSongToPlayAfterLoading = currentPlaylistSong;
						} else {
							// The next song has already been successfully loaded
							// Do not call this.pause() in order not to Simply pause current audio
							this.audio.pause();
						}

						if (this.sourceNode)
							this.sourceNode.disconnectFromDestination();

						this.sourceNode = audioBundle.sourceNode;
						this.sourceNode.connectToDestination(this.intermediateNodes.length ? this.intermediateNodes[0] : this.destinationNode);

						this.audio = audioBundle.audio;

						this.volume = this._volume;

						if (!this.nextSongLoading)
							this.nextSongPerformFinalPlaybackSteps();

						zeroObject(audioBundle, true);

						while (oldAudio.firstChild)
							oldAudio.removeChild(oldAudio.firstChild);
						oldAudio.load();

						if (oldAudio.parentNode)
							oldAudio.parentNode.removeChild(oldAudio);

						return;
					}
				}
			}

			this.destroyNextAudioBundle();

			this.resumeAudioContext();

			while (this.audio.firstChild)
				this.audio.removeChild(this.audio.firstChild);

			const source = document.createElement("source");
			if (currentPlaylistSong.url && !currentPlaylistSong.url.startsWith(FileUtils.localURLPrefix)) {
				source.src = currentPlaylistSong.url;
			} else if (currentPlaylistSong.file) {
				if (this.lastObjectURL)
					URL.revokeObjectURL(this.lastObjectURL);
				this.lastObjectURL = URL.createObjectURL(currentPlaylistSong.file);
				source.src = this.lastObjectURL;
			} else if (currentPlaylistSong.url) {
				this.pause();

				const lastCurrentIndex = this._playlist.currentIndex,
					lastCurrentPlaylistSong = this._playlist.currentItem;

				FileSystemAPI.getFile(currentPlaylistSong.url.substring(FileUtils.localURLPrefix.length)).then((file) => {
					if (lastCurrentPlaylistSong && !lastCurrentPlaylistSong.file && file)
						lastCurrentPlaylistSong.file = file;

					if (!this._playlist || lastCurrentIndex !== this._playlist.currentIndex || lastCurrentPlaylistSong !== this._playlist.currentItem)
						return;

					if (!file) {
						this.handleError(Strings.FileNotFoundOrNoPermissionError);
					} else {
						// Restore the value because play() is about to be called again, and this.lastTimeS is -1 now
						this.lastTimeS = this.resumeTimeS;
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
			source.onerror = this.boundPlaybackError;

			this.audio.appendChild(source);
			this.audio.load();

			if (this.songToResumeTime !== currentPlaylistSong || !this.resumeTimeS || this.resumeTimeS <= 0)
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

		if (!this.loadedSong || this.audio.paused)
			this.play();
		else
			this.pause();
	}

	public stop(): void {
		if (!this._alive || !this.audio)
			return;

		this.loadedSong = null;
		this.songToResumeTime = null;
		this.lastTimeS = -1;

		this.destroyNextAudioBundle();

		if (this.currentPlaylistSong) {
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
					this.mediaSession.setLoading(false, 0, 0);
			}

			if (!this._paused) {
				this._paused = true;
				//queueMicrotask(this.boundNotifyPausedChange);
				if (this.onpausedchange)
					this.onpausedchange(true);
				if (this.mediaSession)
					this.mediaSession.setPaused(true, 0, 0);
			}

			this.currentPlaylistSong = null;
			//queueMicrotask(this.boundNotifySongChange);
			this.notifySongChange();
		}

		this.loadedSong = null;
		this.songToResumeTime = null;
		this.lastTimeS = -1;

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
		if (!this._alive || !this.currentPlaylistSong || !this.currentPlaylistSong.isSeekable || this.currentPlaylistSong.lengthMS <= 0)
			return;

		if (!this.loadedSong) {
			if (!this.songToResumeTime)
				this.songToResumeTime = this.currentPlaylistSong;

			if (this.songToResumeTime === this.currentPlaylistSong) {
				this.lastTimeS = Math.min(
					Math.max(0, this.currentPlaylistSong.lengthMS),
					Math.max(0, timeMS + (relative ? ((Math.max(0, this.lastTimeS) * 1000) | 0) : 0))
				) / 1000;
				this.notifyCurrentTimeSChange();
			}
			return;
		}

		if (!this.audio || !this.audio.seekable || !this.audio.seekable.length)
			return;

		try {
			const timeS = Math.min(
				this.audio.duration || 0,
				Math.max(0, (timeMS / 1000) + (relative ? (this.audio.currentTime || 0) : 0))
			);
			this.lastTimeS = timeS;
			this.audio.currentTime = timeS;
		} catch (ex: any) {
			// Just ignore...
		}

		this.notifyCurrentTimeSChange();
	}

	public headsetRemoved(): void {
		if (!this._alive || !this.audio)
			return;

		if (this.audio.paused) {
			if (this.loadedSong) {
				// This is an unusual case where the playback was paused before
				// the removal of the headset. We must keep track of this in order
				// to try to prevent the song from restarting automatically in cases
				// like when the playback was happening through the headset, the user
				// starts/receives a call without pausing the song, removes the headset
				// and then ends the call.
				this.audio.muted = true;
				this.mutedByHeadsetRemoval = true;
			}
		} else {
			this.pause();
		}
	}
}
