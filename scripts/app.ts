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
}

class App {
	public static readonly electron = !!(window as any)["electronIpcRenderer"];
	public static readonly frameless = App.electron;
	private static readonly ipcRenderer = (window as any)["electronIpcRenderer"] as IpcRenderer;
	private static readonly closeHandlers: AppCloseHandler[] = [];

	private static readonly iconLoading = document.getElementById("icon-loading") as HTMLElement;

	private static titleBar: HTMLHeadingElement | null = null;
	private static iconRestore: HTMLElement | null = null;
	private static iconMaximize: HTMLElement | null = null;

	private static installPrompt: any | null = null;
	private static fileInput: HTMLInputElement;
	private static fileInputVersion = 0;
	private static fileInputPromiseResolve: ((value: File[] | PromiseLike<File[] | null> | null) => void) | null;

	private static _loading = true;
	private static _showingDialog = false;
	private static isMinimized = false;
	private static isMaximized = false;

	public static player: Player | null;

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
				graphicalFilterControlEnabled: App.player.graphicalFilterControl.enabled
			});

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

			if (!App.electron)
				return;

			if (playlist)
				promises.push(InternalStorage.savePlaylist(playlist));

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

	public static updateLoadingIcon() {
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
			if ((files[0] as any).webkitRelativePath)
				files.sort(function (a, b) { return (a as any).webkitRelativePath.localeCompare((b as any).webkitRelativePath); });
			else
				files.sort(function (a, b) { return a.name.localeCompare(b.name); });
		}

		return files;
	}

	public static preInit(): void {
		Strings.init();
		Icon.init();
		GraphicalFilterEditorStrings.init(Strings.language);
		Strings.toFixed = GraphicalFilterEditorStrings.toFixed;

		const appSettings = InternalStorage.loadAppSettings(),
			webFrame = (window as any)["electronWebFrame"] as WebFrame;

		delete (window as any)["electronIpcRenderer"];
		delete (window as any)["electronWebFrame"];

		if ("serviceWorker" in navigator) {
			window.addEventListener("beforeinstallprompt", App.beforeInstallPrompt);

			const promise = navigator.serviceWorker.register("sw.js");
			if (promise && ("then" in promise)) {
				promise.then(function (registration) {
					if (registration && ("onupdatefound" in registration) && registration.active) {
						registration.onupdatefound = function () {
							Modal.show({
								html: Strings.PleaseRefresh,
								title: Strings.UpdateAvailable,
								oktext: Strings.Refresh,
								okcancel: true,
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
		} else {
			window.addEventListener("beforeunload", App.mainWindowClosing);
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

		if (!App.electron) {
			const div = document.createElement("div");
			div.style.display = "none";
			App.fileInput = document.createElement("input");
			App.fileInput.setAttribute("type", "file");
			App.fileInput.setAttribute("multiple", "multiple");
			App.fileInput.setAttribute("aria-label", Strings.AddFiles);
			App.fileInput.onchange = function () {
				if (!App.fileInput || !App.fileInputPromiseResolve || parseInt(App.fileInput.getAttribute("data-version") as string) !== App.fileInputVersion)
					return;

				App.fileInputVersion++;

				const resolve = App.fileInputPromiseResolve;
				App.fileInputPromiseResolve = null;

				if (!App.fileInput.files || !App.fileInput.files.length) {
					resolve(null);
					return;
				}

				const files = new Array(App.fileInput.files.length) as File[];

				for (let i = files.length - 1; i >= 0; i--)
					files[i] = App.fileInput.files[i];

				App.fileInput.value = "";

				resolve(App.sortFiles(files));
			};
			div.appendChild(App.fileInput);
			(document.getElementById("top-panel") as HTMLDivElement).appendChild(div);
		}

		AppUI.preInit(webFrame, appSettings);
	}

	public static async init(): Promise<void> {
		if (App.player)
			return;

		const appSettings = InternalStorage.loadAppSettings();

		App.player = new Player(document.getElementById("graphical-filter-control") as HTMLDivElement, appSettings.playerVolume, appSettings.graphicalFilterControlEnabled);

		try {
			const playlist = await InternalStorage.loadPlaylist();

			if (!App.player || !App.player.alive)
				return;

			if (playlist)
				App.player.playlist = playlist;
		} catch (ex) {
			// Just ignore, for now...
		}

		if (!App.player || !App.player.alive)
			return;

		AppUI.init(appSettings);

		const cover = document.getElementById("cover");
		if (cover)
			cover.classList.remove("in");

		setTimeout(function () {
			window.removeEventListener("resize", App.adjustCover);
			const cover = document.getElementById("cover");
			if (cover)
				document.body.removeChild(cover);
		}, 320);

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

	public static async showOpenFileDialog(): Promise<string[] | null> {
		if (App.fileInput || App._showingDialog)
			return null;

		try {
			App._showingDialog = true;
			return await App.ipcRenderer.invoke("showOpenFileDialog");
		} finally {
			App._showingDialog = false;
		}
	}

	public static convertFilePathsToAppFiles(filePaths: string[]): Promise<AppFile[] | null> {
		return App.ipcRenderer.invoke("convertFilePathsToAppFiles", filePaths);
	}

	public static async showOpenDirectoryDialog(): Promise<string[] | null> {
		if (App._showingDialog)
			return null;

		try {
			App._showingDialog = true;
			return await App.ipcRenderer.invoke("showOpenDirectoryDialog");
		} finally {
			App._showingDialog = false;
		}
	}

	public static listDirectory(urlOrAbsolutePath: string): Promise<AppFile[] | null> {
		return App.ipcRenderer.invoke("listDirectory", urlOrAbsolutePath);
	}

	public static extractMetadata(urlOrAbsolutePath: string, fileSize?: number): Promise<Metadata | null> {
		return App.ipcRenderer.invoke("extractMetadata", urlOrAbsolutePath, fileSize);
	}

	/*
	private static async showOpenFilePicker(): Promise<File[] | null> {
		if (App._showingDialog)
			return null;

		try {
			App._showingDialog = true;

			const handles = (await (window as any).showOpenFilePicker({ multiple: true })) as any[];

			if (!handles || !handles.length)
				return null;

			const promises = new Array(handles.length) as Promise<File>[];

			for (let i = handles.length - 1; i >= 0; i--)
				promises[i] = handles[i].getFile();

			return App.sortFiles(await Promise.all(promises));
		} catch (ex) {
			// The user must have cancelled the request
			return null;
		} finally {
			App._showingDialog = false;
		}
	}

	private static async showDirectoryPicker(): Promise<File[] | null> {
		if (App._showingDialog)
			return null;

		try {
			App._showingDialog = true;

			const handles = (await (window as any).showDirectoryPicker({ multiple: true })) as any[];

			//if (!handles || !handles.length)
				return null;

			const promises = new Array(handles.length) as Promise<File>[];

			for (let i = handles.length - 1; i >= 0; i--)
				promises[i] = handles[i].getFile();

			return App.sortFiles(await Promise.all(promises));
		} catch (ex) {
			// The user must have cancelled the request
			return null;
		} finally {
			App._showingDialog = false;
		}
	}
	*/

	public static async showOpenDialogWeb(directory?: boolean): Promise<File[] | null> {
		if (!App.fileInput)
			return null;

		//if (directory) {
		//	if ("showDirectoryPicker" in window)
		//		return App.showDirectoryPicker();
		//} else {
		//	if ("showOpenFilePicker" in window)
		//		return App.showOpenFilePicker();
		//}

		if (App.fileInputPromiseResolve) {
			App.fileInputPromiseResolve(null);
			App.fileInputPromiseResolve = null;
		}

		App.fileInput.setAttribute("data-version", (++App.fileInputVersion).toString());

		if (directory) {
			App.fileInput.setAttribute("webkitdirectory", "webkitdirectory");
			App.fileInput.setAttribute("directory", "directory");
			App.fileInput.removeAttribute("accept");
		} else {
			App.fileInput.removeAttribute("webkitdirectory");
			App.fileInput.removeAttribute("directory");
			App.fileInput.setAttribute("accept", Playlist.concatenatedSupportedExtensions);
		}

		return new Promise((resolve) => {
			App.fileInputPromiseResolve = resolve;
			App.fileInput.click();
		});
	}
}

function main() {
	App.init();
}

App.preInit();
