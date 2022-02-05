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
	on(channel: string, listener: (event: any, ...args: any[]) => void): IpcRenderer;
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
}

interface HostInterface {
	getHostType(): string;
	getBrowserLanguage(): string;
	setPaused(paused: boolean): void;
	checkFilePermission(): number;
	requestFilePermission(): void;
	setFileURLs(fileURLs: string[]): void;
	enumerateFiles(enumerationVersion: number, path: string | null): void;
	cancelFileEnumeration(enumerationVersion: number): void;
}

class App {
	public static readonly hostTypeElectron = "Electron";
	public static readonly hostTypeAndroid = "Android";

	private static readonly ipcRenderer = ((window as any)["electronIpcRenderer"] as IpcRenderer || null);
	private static readonly closeHandlers: AppCloseHandler[] = [];
	public static readonly frameless = !!(window as any)["electronIpcRenderer"];
	public static readonly hostInterface: HostInterface | null = ((window as any)["hostInterface"] as HostInterface || null);
	public static readonly hostType = ((App.hostInterface && App.hostInterface.getHostType()) || null);

	private static readonly iconLoading = document.getElementById("icon-loading") as HTMLElement;

	private static titleBar: HTMLHeadingElement | null = null;
	private static iconRestore: HTMLElement | null = null;
	private static iconMaximize: HTMLElement | null = null;

	private static installPrompt: any | null = null;
	private static fileInput: HTMLInputElement;
	private static fileInputVersion = 0;
	private static fileInputSkipSortResults = true;
	private static fileInputPromiseResolve: ((value: File[] | PromiseLike<File[] | null> | null) => void) | null;

	private static _loading = true;
	private static isMinimized = false;
	private static isMaximized = false;

	public static player: Player | null;
	public static graphicalFilterControl: GraphicalFilterControl | null;
	public static stereoPannerControl: StereoPannerControl | null;
	public static monoDownMixerControl: MonoDownMixerControl | null;

	private static mainWindowStateChanged(channel: string, isMinimized: boolean, isMaximized: boolean): void {
		if (App.isMinimized !== isMinimized || App.isMaximized !== isMaximized) {
			App.isMinimized = isMinimized;
			App.isMaximized = isMaximized;
			if (!isMinimized) {
				if (App.titleBar)
					App.titleBar.className = (isMaximized ? "maximized" : "");
				if (App.iconRestore)
					App.iconRestore.className = (isMaximized ? "" : "hidden");
				if (App.iconMaximize)
					App.iconMaximize.className = (isMaximized ? "hidden" : "");
			}
		}
	}

	private static mainWindowClosing(): void {
		if (App.player && App.player.alive) {
			const closeHandlers = App.closeHandlers,
				promises: Promise<void>[] = [],
				playlist = App.player.playlist;

			InternalStorage.saveAppSettings({
				devicePixelRatio: devicePixelRatio,
				playerVolume: App.player.volume,
				graphicalFilterControlEnabled: (App.graphicalFilterControl ? App.graphicalFilterControl.enabled : false),
				graphicalFilterControlSimpleMode: (App.graphicalFilterControl ? App.graphicalFilterControl.simpleMode : true),
				stereoPannerControlEnabled: (App.stereoPannerControl ? App.stereoPannerControl.enabled : false),
				monoDownMixerControlEnabled: (App.monoDownMixerControl ? App.monoDownMixerControl.enabled : false),
				filePickerLastPath: FilePicker.lastPath,
				filePickerRootLength: FilePicker.lastRootLength
			});

			App.player.destroy(true);

			if (App.graphicalFilterControl)
				App.graphicalFilterControl.saveSettings();

			if (App.stereoPannerControl)
				App.stereoPannerControl.saveSettings();

			if (closeHandlers && closeHandlers.length) {
				for (let i = closeHandlers.length - 1; i >= 0; i--) {
					if (closeHandlers[i]) {
						const r = closeHandlers[i]();
						if (r)
							promises.push(r);
					}
				}
			}

			if (playlist)
				InternalStorage.savePlaylistWeb(playlist);

			if (!App.ipcRenderer)
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

		const ipcRenderer = App.ipcRenderer;

		zeroObject(App);

		if (ipcRenderer)
			ipcRenderer.invoke("mainWindowFinalClose");
	}

	public static updateLoadingIcon(): void {
		if (App.iconLoading)
			App.iconLoading.style.display = (App.loading ? "" : "none");
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
		return !!App.installPrompt;
	}

	public static showInstallPrompt(): void {
		const p = App.installPrompt;
		if (p && p["prompt"]) {
			try {
				App.installPrompt = null;
				p["prompt"]();
			} catch (ex) {
				// Just ignore...
			}
		}
	}

	private static beforeInstallPrompt(e: Event): void {
		if ("preventDefault" in e)
			e.preventDefault();
		App.installPrompt = e;
	}

	private static adjustCover(): void {
		const cover = document.getElementById("cover");
		if (cover) {
			const rect = document.body.getBoundingClientRect();
			cover.style.transform = `scale(${Math.ceil(rect.right * 0.5)}, ${Math.ceil(rect.bottom * 0.5)})`;
		}
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
		Icon.init();
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

		if (App.ipcRenderer)
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

		window.addEventListener("resize", App.adjustCover);
		App.adjustCover();

		if (App.ipcRenderer) {
			App.ipcRenderer.on("mainWindowStateChanged", App.mainWindowStateChanged);
			App.ipcRenderer.on("mainWindowClosing", App.mainWindowClosing);

			App.triggerMainWindowStateChanged();
		} else if (!App.hostInterface) {
			// https://developers.google.com/web/updates/2018/07/page-lifecycle-api#the-unload-event
			window.addEventListener(("onpagehide" in window) ? "pagehide" : "unload", App.mainWindowClosing);
		}

		if (App.frameless) {
			App.titleBar = document.createElement("h1");
			App.titleBar.innerHTML = `
				<div></div>
				<i id="icon-main"></i>
				FPlay
				<span><span role="button" onclick="App.mainWindowMinimize()">${Icon.createHTML("icon-minimize", false)}</span><span role="button" onclick="App.mainWindowRestoreOrMaximize()">${Icon.createHTML("icon-restore", false, "hidden", "icon-restore")}${Icon.createHTML("icon-maximize", false, null, "icon-maximize")}</span><span role="button" class="close" onclick="App.mainWindowClose()">${Icon.createHTML("icon-close", false)}</span></span>
			`;
			document.body.insertBefore(App.titleBar, document.body.firstChild);

			App.iconRestore = document.getElementById("icon-restore") as HTMLElement;
			App.iconMaximize = document.getElementById("icon-maximize") as HTMLElement;

			document.body.removeChild(App.iconLoading);
			App.iconLoading.className = "";
			App.titleBar.insertBefore(App.iconLoading, (document.getElementById("icon-main") as HTMLElement).nextSibling);
		}

		if (App.hostType === App.hostTypeAndroid || !FilePicker.isSupported()) {
			const div = document.createElement("div");
			div.style.display = "none";
			App.fileInput = document.createElement("input");
			App.fileInput.setAttribute("type", "file");
			App.fileInput.setAttribute("multiple", "multiple");
			App.fileInput.setAttribute("aria-label", Strings.AddSongs);
			App.fileInput.onchange = function () {
				if (!App.fileInput || !App.fileInputPromiseResolve || parseInt(App.fileInput.getAttribute("data-version") as string) !== App.fileInputVersion)
					return;

				App.fileInputVersion++;

				const resolve = App.fileInputPromiseResolve;
				App.fileInputPromiseResolve = null;

				if (!App.fileInput.files || !App.fileInput.files.length || (App.fileInput.files.length === 1 && !FileUtils.isTypeSupported(App.fileInput.files[0].name))) {
					resolve(null);
					return;
				}

				const files = new Array(App.fileInput.files.length) as File[];

				for (let i = files.length - 1; i >= 0; i--)
					files[i] = App.fileInput.files[i];

				App.fileInput.value = "";

				resolve(App.fileInputSkipSortResults ? files : App.sortFiles(files));
			};
			div.appendChild(App.fileInput);
			(document.getElementById("top-panel") as HTMLDivElement).appendChild(div);
		}

		AppUI.preInit(webFrame, appSettings);

		App.init(appSettings);
	}

	private static init(appSettings: AppSettings): void {
		if (App.player)
			return;

		App.player = new Player(
			appSettings.playerVolume,

			function (audioContext) {
				App.graphicalFilterControl = new GraphicalFilterControl(document.getElementById("filter-container") as HTMLDivElement, document.getElementById("optional-panel-container") as HTMLDivElement, audioContext, appSettings.graphicalFilterControlSimpleMode);
				App.graphicalFilterControl.enabled = !!appSettings.graphicalFilterControlEnabled;
				return App.graphicalFilterControl;
			},

			function (audioContext) {
				App.stereoPannerControl = new StereoPannerControl(document.getElementById("stereo-panner-slider") as HTMLSpanElement, audioContext);
				App.stereoPannerControl.enabled = !!appSettings.stereoPannerControlEnabled;
				App.stereoPannerControl.onappliedgainchanged = function (appliedGain) {
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

		const playlist = InternalStorage.loadPlaylistWeb();

		if (playlist)
			App.player.playlist = playlist;

		AppUI.init(appSettings);

		const cover = document.getElementById("cover");
		if (cover)
			cover.classList.remove("in");

		DelayControl.delayShortCB(function () {
			AppUI.centerCurrentSongIntoView();

			DelayControl.delayUICB(function () {
				window.removeEventListener("resize", App.adjustCover);
				const cover = document.getElementById("cover");
				if (cover)
					document.body.removeChild(cover);
			});
		});

		App.loading = false;
	}

	private static triggerMainWindowStateChanged(): void {
		if (App.ipcRenderer)
			App.ipcRenderer.invoke("triggerMainWindowStateChanged");
	}

	public static mainWindowMinimize(): void {
		if (App.ipcRenderer)
			App.ipcRenderer.invoke("mainWindowMinimize");
	}

	public static mainWindowRestoreOrMaximize(): void {
		if (App.ipcRenderer)
			App.ipcRenderer.invoke(App.isMaximized ? "mainWindowRestore" : "mainWindowMaximize");
	}

	public static mainWindowClose(): void {
		if (App.ipcRenderer)
			App.ipcRenderer.invoke("mainWindowClose");
	}

	public static extractMetadata(urlOrAbsolutePath: string, fileSize?: number): Promise<Metadata | null> {
		return App.ipcRenderer.invoke("extractMetadata", urlOrAbsolutePath, fileSize);
	}

	public static showOpenDialogWeb(directory?: boolean, skipSort?: boolean): Promise<File[] | null> {
		if (!App.fileInput)
			return Promise.resolve(null);

		if (App.fileInputPromiseResolve) {
			App.fileInputPromiseResolve(null);
			App.fileInputPromiseResolve = null;
		}

		App.fileInputSkipSortResults = !!skipSort;

		App.fileInput.setAttribute("data-version", (++App.fileInputVersion).toString());

		if (directory) {
			App.fileInput.setAttribute("webkitdirectory", "webkitdirectory");
			App.fileInput.setAttribute("directory", "directory");
			App.fileInput.removeAttribute("accept");
		} else {
			App.fileInput.removeAttribute("webkitdirectory");
			App.fileInput.removeAttribute("directory");
			App.fileInput.setAttribute("accept", FileUtils.concatenatedSupportedExtensions);
		}

		const promise = new Promise<File[] | null>(function (resolve) {
			App.fileInputPromiseResolve = resolve;
		});

		App.fileInput.click();

		return promise;
	}
}

function main() {
	App.preInit().catch(console.error);
}
