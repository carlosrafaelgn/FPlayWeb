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

interface IpcRenderer {
	invoke(channel: string, ...args: any[]): Promise<any>;
	on(channel: string, listener: (e: any, ...args: any[]) => void): IpcRenderer;
	send(channel: string, ...args: any[]): void;
	sendSync(channel: string, ...args: any[]): any;
}

interface WebFrame {
	insertCSS(cssSourceCode: string): string;
	removeInsertedCSS(key: string): void;
	getZoomFactor(): number;
	setZoomFactor(factor: number): void;
	getZoomLevel(): number;
	setZoomLevel(level: number): void;
}

interface IpcListDirectoryFilesCallback {
	(error: string | null, files: string[] | null): void;
}

interface AppFile {
	fileURL: string;
	fileSize: number;
	isDirectory: boolean;
}

interface AppCloseHandler {
	(): void | Promise<void>;
}

interface AppSettings {
	devicePixelRatio?: number;
	playerVolume?: number;
	graphicalFilterControlEnabled?: boolean;
	graphicalFilterControlSimpleMode?: boolean;
	stereoPannerControlEnabled?: boolean;
	monoDownMixerControlEnabled?: boolean;
	filePickerLastPath?: string | null;
	filePickerRootLength?: number;
	rgbMode?: boolean;
	animatedRGBMode?: boolean;
	extraRGBMode?: boolean;
	neonMode?: boolean;
}

interface HostInterface extends HostMediaSession {
	getHostType(): string;
	getBrowserLanguage(): string;
	getFontScale(): number;
	checkFilePermission(): number;
	requestFilePermission(): void;
	setFileURLs(fileURLs: string[]): void;
	enumerateFiles(enumerationVersion: number, path: string | null): void;
	cancelFileEnumeration(enumerationVersion: number): void;
	exit(): void;
}

class App {
	public static readonly hostTypeElectron = "Electron";
	public static readonly hostTypeAndroid = "Android";

	private static readonly _ipcRenderer = ((window as any)["electronIpcRenderer"] as IpcRenderer || null);
	private static readonly _closeHandlers: AppCloseHandler[] = [];
	public static readonly frameless = !!(window as any)["electronIpcRenderer"];
	public static readonly hostInterface: HostInterface | null = ((window as any)["hostInterface"] as HostInterface || null);
	public static readonly hostType = ((App.hostInterface && App.hostInterface.getHostType()) || null);

	private static readonly _iconLoading = document.getElementById("icon-loading") as HTMLElement;

	private static _titleBar: HTMLHeadingElement | null = null;
	private static _iconRestore: HTMLElement | null = null;
	private static _iconMaximize: HTMLElement | null = null;

	private static _installPrompt: any | null = null;
	private static _fileInputPromiseResolve: ((value: File[] | PromiseLike<File[] | null> | null) => void) | null = null;

	private static _loading = true;
	private static _isMinimized = false;
	private static _isMaximized = false;
	private static _exitOnDestroy = false;

	public static player: Player | null;
	public static graphicalFilterControl: GraphicalFilterControl | null;
	public static stereoPannerControl: StereoPannerControl | null;
	public static monoDownMixerControl: MonoDownMixerControl | null;

	public static saveSettings(savePlaylist: boolean): void {
		if (!App.player || !App.player.alive)
			return;

		if (savePlaylist)
			App.player.setPlaylistData();

		InternalStorage.saveAppSettings({
			devicePixelRatio: devicePixelRatio,
			playerVolume: App.player.volume,
			graphicalFilterControlEnabled: (App.graphicalFilterControl ? App.graphicalFilterControl.enabled : false),
			graphicalFilterControlSimpleMode: (App.graphicalFilterControl ? App.graphicalFilterControl.simpleMode : true),
			stereoPannerControlEnabled: (App.stereoPannerControl ? App.stereoPannerControl.enabled : false),
			monoDownMixerControlEnabled: (App.monoDownMixerControl ? App.monoDownMixerControl.enabled : false),
			filePickerLastPath: FilePicker.lastPath,
			filePickerRootLength: FilePicker.lastRootLength,
			rgbMode: AppUI.rgbMode,
			animatedRGBMode: AppUI.animatedRGBMode,
			extraRGBMode: AppUI.extraRGBMode,
			neonMode: AppUI.neonMode
		});

		if (App.graphicalFilterControl)
			App.graphicalFilterControl.saveSettings();

		if (App.stereoPannerControl)
			App.stereoPannerControl.saveSettings();

		if (savePlaylist && App.player.playlist)
			InternalStorage.savePlaylistWeb(App.player.playlist);
	}

	private static mainWindowStateChanged(channel: string, isMinimized: boolean, isMaximized: boolean): void {
		if (App._isMinimized !== isMinimized || App._isMaximized !== isMaximized) {
			App._isMinimized = isMinimized;
			App._isMaximized = isMaximized;
			if (!isMinimized) {
				if (App._titleBar)
					App._titleBar.className = (isMaximized ? "maximized" : "");
				if (App._iconRestore)
					App._iconRestore.className = (isMaximized ? "" : "hidden");
				if (App._iconMaximize)
					App._iconMaximize.className = (isMaximized ? "hidden" : "");
			}
		}
	}

	private static mainWindowClosing(): void {
		if (App.player && App.player.alive) {
			const closeHandlers = App._closeHandlers,
				promises: Promise<void>[] = [];

			App.saveSettings(true);

			App.player.destroy(true);

			if (closeHandlers && closeHandlers.length) {
				for (let i = closeHandlers.length - 1; i >= 0; i--) {
					if (closeHandlers[i]) {
						const r = closeHandlers[i]();
						if (r)
							promises.push(r);
					}
				}
			}

			if (!App.hostInterface)
				return;

			if (promises.length)
				Promise.all(promises).then(App.destroy, App.destroy);
			else
				App.destroy();
		}
	}

	private static destroy(): void {
		if (App.player)
			App.player.destroy();

		AppUI.destroy();

		const ipcRenderer = App._ipcRenderer;
		const hostInterface = (App._exitOnDestroy ? App.hostInterface : null);

		zeroObject(App);

		if (ipcRenderer)
			ipcRenderer.invoke("mainWindowFinalClose");

		if (hostInterface)
			hostInterface.exit();
	}

	public static updateLoadingIcon(): void {
		if (App._iconLoading)
			App._iconLoading.style.display = (App.loading ? "" : "none");
	}

	public static get loading(): boolean {
		return ((App.player ? App.player.loading : false) || AppUI.loading || App._loading);
	}

	public static set loading(loading: boolean) {
		if (App._loading === loading)
			return;

		App._loading = loading;

		App.updateLoadingIcon();
	}

	public static get installPromptReady(): boolean {
		return !!App._installPrompt;
	}

	public static showInstallPrompt(): void {
		const p = App._installPrompt;
		if (p && p["prompt"]) {
			try {
				App._installPrompt = null;
				p["prompt"]();
			} catch (ex) {
				// Just ignore...
			}
		}
	}

	private static beforeInstallPrompt(e: Event): void {
		if ("preventDefault" in e)
			e.preventDefault();
		App._installPrompt = e;
	}

	private static sortFiles(files: File[]): File[] {
		if (files.length) {
			const comparer = Strings.comparer;

			if ((files[0] as any)["data-path"])
				files.sort(function (a, b) { return comparer((a as any)["data-path"], (b as any)["data-path"]); });
			else if ((files[0] as any).webkitRelativePath)
				files.sort(function (a, b) { return comparer((a as any).webkitRelativePath, (b as any).webkitRelativePath); });
			else
				files.sort(function (a, b) { return comparer(a.name, b.name); });
		}

		return files;
	}

	public static async preInit(): Promise<void> {
		Strings.init();
		GraphicalFilterEditorStrings.init(Strings.language);
		Strings.toFixed = GraphicalFilterEditorStrings.toFixed;
		if (!App.hostInterface && FileSystemAPI.isSupported()) {
			try {
				await FileSystemAPI.init();
			} catch (ex: any) {
				Alert.show(ex.message || ex.toString());
			}
		}

		const appSettings = InternalStorage.loadAppSettings(),
			webFrame = (window as any)["electronWebFrame"] as WebFrame;

		if (App._ipcRenderer)
			delete (window as any)["electronIpcRenderer"];
		if (webFrame)
			delete (window as any)["electronWebFrame"];

		if ("serviceWorker" in navigator && !location.href.startsWith("file://")) {
			window.addEventListener("beforeinstallprompt", App.beforeInstallPrompt);

			const promise = navigator.serviceWorker.register("sw.js");
			if (promise && ("then" in promise)) {
				promise.then(function (registration) {
					if (registration && ("onupdatefound" in registration) && registration.active) {
						registration.onupdatefound = function () {
							Modal.show({
								html: Strings.PleaseRefresh,
								title: Strings.UpdateAvailable,
								returnFocusElement: AppUI.playlistControlElement,
								okText: Strings.Refresh,
								okCancel: true,
								onok: function () {
									window.location.reload();
								}
							});
						};
					}
				});
			}
		}

		if (App._ipcRenderer) {
			App._ipcRenderer.on("mainWindowStateChanged", App.mainWindowStateChanged);
			App._ipcRenderer.on("mainWindowClosing", App.mainWindowClosing);

			App.triggerMainWindowStateChanged();
		} else if (!App.hostInterface) {
			// https://developers.google.com/web/updates/2018/07/page-lifecycle-api#the-unload-event
			// https://developer.chrome.com/blog/page-lifecycle-api/#advice-hidden
			// https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event#usage_notes
			// https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event#usage_notes
			// Although being recommended, onvisibilitychange is called whenever the page/tab becomes invisible
			// which happens several times on desktop environments... This must be thought over a little bit...
			window.addEventListener(("onpagehide" in window) ? "pagehide" : "unload", App.mainWindowClosing);
		}

		if (App.frameless) {
			App._titleBar = document.createElement("h1");
			App._titleBar.className = "title-bar";
			App._titleBar.innerHTML = `
				<div></div>
				<i id="icon-main"></i>
				FPlay
				<span><span role="button" onclick="App.mainWindowMinimize()">${Icon.createHTML("icon-minimize")}</span><span role="button" onclick="App.mainWindowRestoreOrMaximize()">${Icon.createHTML("icon-restore", null, false, "hidden", "icon-restore-i")}${Icon.createHTML("icon-maximize", null, false, null, "icon-maximize-i")}</span><span role="button" class="close" onclick="App.mainWindowClose()">${Icon.createHTML("icon-close")}</span></span>
			`;
			document.body.insertBefore(App._titleBar, document.body.firstChild);

			App._iconRestore = document.getElementById("icon-restore-i") as HTMLElement;
			App._iconMaximize = document.getElementById("icon-maximize-i") as HTMLElement;
		}

		AppUI.preInit(webFrame, appSettings);

		App.init(appSettings);
	}

	private static init(appSettings: AppSettings): void {
		if (App.player)
			return;

		App.player = new Player(
			appSettings.playerVolume,
			InternalStorage.loadPlaylistWeb(),
			HostMediaSession.getMediaSession(),

			function (audioContext) {
				App.graphicalFilterControl = new GraphicalFilterControl(document.getElementById("filter-container") as HTMLDivElement, document.getElementById("optional-panel-container") as HTMLDivElement, audioContext, appSettings.graphicalFilterControlSimpleMode);
				App.graphicalFilterControl.enabled = !!appSettings.graphicalFilterControlEnabled;
				return App.graphicalFilterControl;
			},

			function (audioContext) {
				App.stereoPannerControl = new StereoPannerControl(document.getElementById("stereo-panner-slider") as SliderControl, audioContext);
				App.stereoPannerControl.enabled = !!appSettings.stereoPannerControlEnabled;
				App.stereoPannerControl.onappliedgainchange = function (appliedGain) {
					if (App.monoDownMixerControl)
						App.monoDownMixerControl.multiplier = 1 / (1 + appliedGain);
				};
				return App.stereoPannerControl;
			},

			function (audioContext) {
				App.monoDownMixerControl = new MonoDownMixerControl(audioContext);
				App.monoDownMixerControl.enabled = (MonoDownMixerControl.isSupported() && !!appSettings.monoDownMixerControlEnabled);
				return App.monoDownMixerControl;
			}
		);

		AppUI.init(appSettings);

		App.loading = false;
	}

	private static triggerMainWindowStateChanged(): void {
		if (App._ipcRenderer)
			App._ipcRenderer.invoke("triggerMainWindowStateChanged");
	}

	public static mainWindowMinimize(): void {
		if (App._ipcRenderer)
			App._ipcRenderer.invoke("mainWindowMinimize");
	}

	public static mainWindowRestoreOrMaximize(): void {
		if (App._ipcRenderer)
			App._ipcRenderer.invoke(App._isMaximized ? "mainWindowRestore" : "mainWindowMaximize");
	}

	public static mainWindowClose(): void {
		if (App._ipcRenderer)
			App._ipcRenderer.invoke("mainWindowClose");
	}

	public static extractMetadata(urlOrAbsolutePath: string, fileSize?: number): Promise<Metadata | null> {
		return App._ipcRenderer.invoke("extractMetadata", urlOrAbsolutePath, fileSize);
	}

	public static showOpenDialogWeb(directory?: boolean, skipSort?: boolean): Promise<File[] | null> {
		const fileInput = document.createElement("input");
		fileInput.type = "file";
		fileInput.multiple = true;
		fileInput.ariaLabel = Strings.AddSongs;

		if (directory) {
			(fileInput as any).webkitdirectory = true;
			(fileInput as any).directory = true;
		// A few online browsers stopped allowing any kind of file selection after flac or ogg has been added...
		//} else {
		//	fileInput.accept = FileUtils.concatenatedSupportedExtensions;
		}

		fileInput.onchange = function () {
			if (!App._fileInputPromiseResolve)
				return;

			const resolve = App._fileInputPromiseResolve;
			App._fileInputPromiseResolve = null;

			if (!fileInput.files || !fileInput.files.length || (fileInput.files.length === 1 && !FileUtils.isTypeSupported(fileInput.files[0].name))) {
				resolve(null);
				return;
			}

			const files = new Array(fileInput.files.length) as File[];

			for (let i = files.length - 1; i >= 0; i--)
				files[i] = fileInput.files[i];

			fileInput.value = "";

			resolve(skipSort ? files : App.sortFiles(files));
		};

		const resolve = App._fileInputPromiseResolve;
		App._fileInputPromiseResolve = null;

		const promise = new Promise<File[] | null>(function (resolve) {
			App._fileInputPromiseResolve = resolve;
		});

		fileInput.click();

		if (resolve)
			resolve(null);

		return promise;
	}

	public static exit(): void {
		// Called only by the host interface
		App._exitOnDestroy = true;
		App.mainWindowClosing();
	}
}

function main() {
	App.preInit().catch(console.error);
}
