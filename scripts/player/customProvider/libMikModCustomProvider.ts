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

class LibMikModAudioElement extends AudioElement {
	private _alive: boolean;
	private _loaded: boolean;
	private _loading: boolean;
	private _playAfterLoading: boolean;
	private _volume: number;
	private _muted: boolean;
	private _audioContextStartTime: number;
	private _currentTime: number;
	private _currentTimeInterval: number;
	private _boundUpdateCurrentTime: any;
	private _duration: number;
	private _paused: boolean;
	private _audioContext: AudioContext;
	private _customProvider: CustomProvider;
	private _song: Song;
	private _sourceAudioNode: AudioWorkletNode | null;
	private _volumeAudioNode: GainNode;
	private _suspendAudioContext: () => void;
	private _resumeAudioContext: () => void;

	public constructor(audioContext: AudioContext, customProvider: CustomProvider, song: Song, suspendAudioContext: () => void, resumeAudioContext: () => void) {
		super();

		this._alive = true;
		this._loaded = false;
		this._loading = false;
		this._playAfterLoading = false;
		this._volume = 0;
		this._muted = false;
		this._audioContextStartTime = 0;
		this._currentTime = 0;
		this._currentTimeInterval = 0;
		this._boundUpdateCurrentTime = () => {
			if (!this._alive)
				return;

			this._currentTime = this._audioContext.currentTime - this._audioContextStartTime;

			if (this.ontimeupdate)
				this.ontimeupdate();
		};
		this._duration = 0;
		this._paused = true;
		this._audioContext = audioContext;
		this._customProvider = customProvider;
		this._song = song;
		this._sourceAudioNode = null;
		this._volumeAudioNode = new GainNode(audioContext, { gain: 0 });
		this._suspendAudioContext = suspendAudioContext;
		this._resumeAudioContext = resumeAudioContext;
	}

	public get volume(): number {
		return this._volume;
	}

	public set volume(volume: number) {
		this._volume = volume;
		this._volumeAudioNode.gain.value = (this._muted ? 0 : volume);
	}

	public get muted(): boolean {
		return this._muted;
	}

	public set muted(muted: boolean) {
		this._muted = muted;
		this._volumeAudioNode.gain.value = (muted ? 0 : this._volume);
	}

	public get currentTime(): number {
		return this._currentTime;
	}

	public set currentTime(time: number) {
		// Currently not seekable
	}

	public get duration(): number {
		return this._duration;
	}

	public get paused(): boolean {
		return this._paused;
	}

	public get seekable(): TimeRanges | null {
		// Currently not seekable
		return null;
	}

	public get customProvider(): CustomProvider {
		return this._customProvider;
	}

	public get audioNode(): AudioNode {
		return this._volumeAudioNode;
	}

	private updateInterval(): void {
		if (!this._alive || this._paused) {
			if (this._currentTimeInterval) {
				clearInterval(this._currentTimeInterval);
				this._currentTimeInterval = 0;
			}
			return;
		}

		if (!this._currentTimeInterval)
			this._currentTimeInterval = setInterval(this._boundUpdateCurrentTime, 200);
	}

	public load(): void {
		if (!this._alive || this._loaded || this._loading)
			return;

		this._loading = true;

		if (this.onloadstart)
			queueMicrotask(this.onloadstart);

		if (!LibMikMod.isSupported()) {
			queueMicrotask(() => {
				if (this._alive && this.onerror)
					this.onerror(Strings.LibMikModNotSupported);
			});
			return;
		}

		if (LibMikMod.initializing)
			return;

		if (LibMikMod.initializationError) {
			queueMicrotask(() => {
				if (this._alive && this.onerror)
					this.onerror(Strings.LibMikModFailedToInitialize);
			});
			return;
		}

		LibMikMod.init(this._audioContext, "assets/lib/libmikmod/").then(async () => {
			let arrayBuffer: ArrayBuffer | null;
			try {
				arrayBuffer = await this._song.readAsArrayBuffer();
				if (!arrayBuffer) {
					queueMicrotask(() => {
						if (this._alive && this.onerror)
							this.onerror(Strings.LibMikModErrorReadingModuleFile);
					});
					return;
				}
			} catch (error) {
				queueMicrotask(() => {
					if (this._alive && this.onerror)
						this.onerror(Strings.LibMikModErrorReadingModuleFile + ": " + error);
				});
				return;
			}

			if (!this._alive)
				return;

			LibMikMod.loadModule({
				audioContext: this._audioContext,
				source: arrayBuffer,
				reverb: 0,
				interpolation: true,
				noiseReduction: true,
				hqMixer: true,
				wrap: false,
				loop: false,
				fadeout: true,
				onload: (audioNode) => {
					if (!this._alive)
						return;

					this._loading = false;
					this._loaded = true;

					this._sourceAudioNode = audioNode;
					this._sourceAudioNode.connect(this._volumeAudioNode);

					this._audioContextStartTime = this._audioContext.currentTime;

					if (this.oncanplay)
						this.oncanplay();

					if (this._playAfterLoading)
						this.play();
				},
				onerror: (errorCode, reason) => {
					if (!this._alive)
						return;

					if (this.onerror)
						this.onerror(Strings.LibMikModErrorLoadingModule + ": " + (reason || Strings.UnknownError) + " (" + errorCode + ")");
				},
				onended: () => {
					if (!this._alive)
						return;

					this._loaded = false;
					this._paused = true;
					if (this._currentTimeInterval) {
						clearInterval(this._currentTimeInterval);
						this._currentTimeInterval = 0;
					}

					this._duration = this._currentTime;
					if (this._song.lengthMS < this.duration && this.ondurationchange)
						this.ondurationchange();

					if (this.onended)
						this.onended();
				}
			});
		}, (reason) => {
			queueMicrotask(() => {
				if (this._alive && this.onerror)
					this.onerror(Strings.LibMikModErrorInitializing + ": " + reason);
			});
		});
	}

	public play(): Promise<void> {
		if (!this._alive || !this._paused || !this._loaded) {
			this._playAfterLoading = true;
			return Promise.resolve();
		}

		this._resumeAudioContext();
		this._paused = false;

		this.updateInterval();

		if (this.onplaying)
			queueMicrotask(this.onplaying);

		return Promise.resolve();
	}

	public pause(): void {
		if (!this._alive || this._paused)
			return;

		this._suspendAudioContext();
		this._paused = true;

		this.updateInterval();

		if (this.onpause)
			queueMicrotask(this.onpause);
	}

	public destroy(): void {
		if (!this._alive)
			return;

		this._alive = false;
		this._loaded = false;
		this._playAfterLoading = false;
		this._paused = true;

		if (this._sourceAudioNode) {
			this._sourceAudioNode.disconnect();
			LibMikMod.stopModule();
		}

		this._volumeAudioNode.disconnect();

		this.updateInterval();

		zeroObject(this);

		this._paused = true;
	}
}

class LibMikModCustomProvider extends CustomProvider {
	public static init(): void {
		const supportedExtensions: string[] = [
			".669", ".amf", ".asy", ".dsm", ".far", ".gdm", ".gt2", ".imf", ".it", ".m15", ".med", ".mod", ".mtm", ".okt", ".s3m", ".stm", ".stx", ".ult", ".umx", ".uni", ".xm"
		];

		const instance = new LibMikModCustomProvider();

		for (let i = supportedExtensions.length - 1; i >= 0; i--)
			FileUtils.addSupportedExtension(supportedExtensions[i], "application/octet-stream", instance);
	}

	private constructor() {
		super(CustomProviderId.LibMikMod);
	}

	public async extractMetadata(metadata: Metadata, file: File, buffer: Uint8Array<ArrayBuffer>, tmpBuffer: ResizeableBuffer, fetchAlbumArt: boolean): Promise<Metadata | null> {
		metadata.flags &= ~MetadataFlags.Seekable;
		return metadata;
	}

	public createAudioElement(audioContext: AudioContext, song: Song, suspendAudioContext: () => void, resumeAudioContext: () => void): AudioElement {
		return new LibMikModAudioElement(audioContext, this, song, suspendAudioContext, resumeAudioContext);
	}
}
