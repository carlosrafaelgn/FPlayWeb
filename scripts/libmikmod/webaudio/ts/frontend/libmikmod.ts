/*	MikMod Web Audio library
	(c) 2021 Carlos Rafael Gimenes das Neves.

	https://github.com/sezero/mikmod
	https://github.com/carlosrafaelgn/mikmod/tree/master/libmikmod/webaudio

	This library is free software; you can redistribute it and/or modify
	it under the terms of the GNU Library General Public License as
	published by the Free Software Foundation; either version 2 of
	the License, or (at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Library General Public License for more details.

	You should have received a copy of the GNU Library General Public
	License along with this library; if not, write to the Free Software
	Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA
	02111-1307, USA.
*/

class LibMikMod {
	// Due to both LibMikMod and AudioWorklet's nature we can
	// have only one module loaded at a time...

	public static readonly WEB_VERSION = 7;
	public static LIB_VERSION: string | null = null;

	public static readonly ERROR_FILE_READ = 1;
	public static readonly ERROR_MODULE_LOAD = 2;
	public static readonly ERROR_PLAYBACK = 3;

	public static initialized = false;
	public static initializing = false;
	public static initializationError = false;

	public static infoSongName: string | null = null;
	public static infoModType: string | null = null;
	public static infoComment: string | null = null;

	private static _currentId = 0;
	private static _audioNode: AudioWorkletNode | null = null;
	
	private static _onload: ((audioNode: AudioWorkletNode) => void) | null = null;
	private static _onerror: ((errorCode: number, reason?: any) => void) | null = null;
	private static _onended: (() => void) | null = null;

	public static isSupported(): boolean {
		// Should we also check for HTTPS? Because, apparently, the browser already undefines
		// AudioWorklet when not serving the files from a secure origin...
		return (("AudioWorklet" in window) && ("AudioWorkletNode" in window) && ("WebAssembly" in window));
	}

	private static createAudioWorkletNode(audioContext: AudioContext): AudioWorkletNode {
		// https://webaudio.github.io/web-audio-api/#AudioWorkletNodeOptions
		// https://www.w3.org/TR/webaudio/#computednumberofchannels
		return new AudioWorkletNode(audioContext, "libmikmodprocessor", {
			channelCount: 2,
			channelCountMode: "explicit",
			channelInterpretation: "speakers",
			numberOfInputs: 0,
			numberOfOutputs: 1,
			outputChannelCount: [2],
		});
	}

	public static async init(audioContext: AudioContext, libPath?: string | null): Promise<void> {
		if (LibMikMod.initialized || LibMikMod.initializing || LibMikMod.initializationError)
			return;

		if (!libPath)
			libPath = "";
		else if (!libPath.endsWith("/"))
			libPath += "/";

		LibMikMod.initializing = true;

		LibMikMod._currentId = 0;

		try {
			const response = await fetch(libPath + "libmikmodclib.wasm?" + LibMikMod.WEB_VERSION);

			const wasmBuffer = await response.arrayBuffer();

			await audioContext.audioWorklet.addModule(libPath + "libmikmodprocessor.min.js?" + LibMikMod.WEB_VERSION);

			await new Promise<void>(function (resolve, reject) {
				const audioNode = LibMikMod.createAudioWorkletNode(audioContext);

				audioNode.port.onmessage = function (ev) {
					const message = ev.data as LibMikModResponse;

					if (!message || message.messageId !== LibMikModMessageId.INIT || !LibMikMod.initializing || LibMikMod._currentId)
						return;

					if (message.errorStr) {
						reject(message.errorStr);
					} else {
						LibMikMod.LIB_VERSION = ((message.id >>> 16) & 0xFF) + "." + ((message.id >>> 8) & 0xFF) + "." + (message.id & 0xFF);
						resolve();
					}
				};

				audioNode.onprocessorerror = function (ev) {
					reject(ev);
				};

				LibMikMod._audioNode = audioNode;

				LibMikMod.postMessage({
					id: LibMikMod._currentId,
					messageId: LibMikModMessageId.INIT,
					buffer: wasmBuffer
				});
			});

			LibMikMod.initialized = true;
		} finally {
			if (!LibMikMod.initialized)
				LibMikMod.initializationError = true;

			LibMikMod.initializing = false;

			LibMikMod.stopModule();
		}
	}

	private static postMessage(message: LibMikModMessage): void {
		if (!LibMikMod._audioNode)
			return;

		if (message.buffer)
			LibMikMod._audioNode.port.postMessage(message, [message.buffer]);
		else
			LibMikMod._audioNode.port.postMessage(message);
	}

	public static loadModule(options: LibMikModLoadOptions): void {
		if (!LibMikMod.initialized)
			throw new Error("Library not initialized");

		if (!options)
			throw new Error("Null options");

		if (!options.audioContext)
			throw new Error("Null audioContext");

		const source = options.source;

		if (!source)
			throw new Error("Null source");

		LibMikMod.stopModule();

		const audioNode = LibMikMod.createAudioWorkletNode(options.audioContext);

		LibMikMod._currentId++;

		audioNode.port.onmessage = LibMikMod.handleResponse;
		audioNode.onprocessorerror = LibMikMod.notifyProcessorError;

		LibMikMod._audioNode = audioNode;

		LibMikMod.infoSongName = null;
		LibMikMod.infoModType = null;
		LibMikMod.infoComment = null;

		LibMikMod._onload = options.onload;
		LibMikMod._onerror = options.onerror;
		LibMikMod._onended = options.onended;

		const id = LibMikMod._currentId,
			initialOptions: LibMikModInitialOptions = {
				hqMixer: options.hqMixer,
				wrap: options.wrap,
				loop: options.loop,
				fadeout: options.fadeout,
				reverb: options.reverb,
				interpolation: options.interpolation,
				noiseReduction: options.noiseReduction
			};

		if ("lastModified" in source) {
			if ("arrayBuffer" in source) {
				source.arrayBuffer().then(function (arrayBuffer) {
					if (id !== LibMikMod._currentId)
						return;

					LibMikMod.postMessage({
						id: LibMikMod._currentId,
						messageId: LibMikModMessageId.LOAD_MODULE_BUFFER,
						buffer: arrayBuffer,
						options: initialOptions
					});
				}, function (reason) {
					if (id !== LibMikMod._currentId)
						return;

					LibMikMod.notifyReaderError(reason);
				});
			} else {
				const reader = new FileReader();
				reader.onerror = function (ev) {
					if (id !== LibMikMod._currentId)
						return;

					LibMikMod.notifyReaderError(ev);
				};
				reader.onload = function () {
					if (id !== LibMikMod._currentId)
						return;

					if (!reader.result)
						LibMikMod.notifyReaderError("Empty reader result");
					else
						LibMikMod.postMessage({
							id: LibMikMod._currentId,
							messageId: LibMikModMessageId.LOAD_MODULE_BUFFER,
							buffer: reader.result as ArrayBuffer,
							options: initialOptions
						});
				};
				reader.readAsArrayBuffer(source);
			}
		} else {
			LibMikMod.postMessage({
				id: LibMikMod._currentId,
				messageId: LibMikModMessageId.LOAD_MODULE_BUFFER,
				buffer: source,
				options: initialOptions
			});
		}
	}

	public static changeGeneralOptions(options?: LibMikModGeneralOptions): void {
		if (!LibMikMod.initialized)
			throw new Error("Library not initialized");

		LibMikMod.postMessage({
			id: LibMikMod._currentId,
			messageId: LibMikModMessageId.CHANGE_GENERAL_OPTIONS,
			options: options
		});
	}

	private static cleanUp(): void {
		LibMikMod._currentId++;

		LibMikMod.infoSongName = null;
		LibMikMod.infoModType = null;
		LibMikMod.infoComment = null;

		if (LibMikMod._audioNode && LibMikMod._audioNode.port)
			LibMikMod._audioNode.port.close();
		LibMikMod._audioNode = null;

		LibMikMod._onload = null;
		LibMikMod._onerror = null;
		LibMikMod._onended = null;
	}

	public static stopModule(): void {
		if (!LibMikMod._audioNode)
			return;

		LibMikMod.postMessage({
			id: LibMikMod._currentId,
			messageId: LibMikModMessageId.STOP_MODULE
		});

		LibMikMod.cleanUp();
	}

	private static notifyReaderError(reason?: any): void {
		LibMikMod.notifyError(LibMikMod.ERROR_FILE_READ, reason);
	}

	private static notifyProcessorError(reason?: any): void {
		LibMikMod.notifyError(LibMikMod.ERROR_PLAYBACK, reason);
	}

	private static notifyError(errorCode: number, reason?: any): void {
		if (!LibMikMod._audioNode)
			return;

		const onerror = LibMikMod._onerror;

		LibMikMod.stopModule();

		if (onerror)
			onerror(errorCode, reason);
	}

	private static notifyEnded(): void {
		if (!LibMikMod._audioNode)
			return;

		const onended = LibMikMod._onended;

		LibMikMod.cleanUp();

		if (onended)
			onended();
	}

	private static handleResponse(ev: MessageEvent): void {
		const message = ev.data as LibMikModResponse;

		if (!message)
			return;

		switch (message.messageId) {
			case LibMikModMessageId.LOAD_MODULE_BUFFER:
				if (message.id !== LibMikMod._currentId || !LibMikMod._audioNode)
					break;

				if (message.errorCode) {
					LibMikMod.notifyError(LibMikMod.ERROR_MODULE_LOAD, message.errorStr || message.errorCode.toString());
				} else {
					LibMikMod.infoSongName = (message.infoSongName || null);
					LibMikMod.infoModType = (message.infoModType || null);
					LibMikMod.infoComment = (message.infoComment || null);

					if (LibMikMod._onload)
						LibMikMod._onload(LibMikMod._audioNode);
				}
				break;

			case LibMikModMessageId.PLAYBACK_ERROR:
				if (message.id !== LibMikMod._currentId)
					break;

				LibMikMod.notifyProcessorError(message.errorStr || message.errorCode?.toString());
				break;

			case LibMikModMessageId.PLAYBACK_ENDED:
				if (message.id !== LibMikMod._currentId)
					break;

				LibMikMod.notifyEnded();
				break;
		}
	}
}
