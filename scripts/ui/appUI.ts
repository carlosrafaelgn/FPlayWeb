//
// MIT License
//
// Copyright (c) 2021 Carlos Rafael Gimenes das Neves
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of AppUI software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and AppUI permission notice shall be included in all
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

interface AppUIZoomHandler {
	(): void;
}

class AppUI {
	// https://stackoverflow.com/a/52855084/3569421
	// https://stackoverflow.com/a/52854585/3569421
	// https://stackoverflow.com/a/4819886/3569421
	public static readonly primaryInputIsTouch = (("matchMedia" in window) ? window.matchMedia("(pointer: coarse)").matches : (navigator.maxTouchPoints > 0 || (navigator as any).msMaxTouchPoints > 0));

	private static readonly rem = 4;
	private static readonly buttonRegularSizeREM = 8;
	private static readonly buttonRegularSizePX = AppUI.remToPX(AppUI.buttonRegularSizeREM);
	private static readonly buttonSizeREM = AppUI.buttonRegularSizeREM * (AppUI.primaryInputIsTouch ? 1.5 : 1);
	private static readonly buttonSizePX = AppUI.remToPX(AppUI.buttonSizeREM);
	private static readonly optionalPanelClientWidthREM = 128;
	private static readonly optionalPanelClientWidthPX = AppUI.remToPX(AppUI.optionalPanelClientWidthREM);
	private static readonly scrollbarSizeREM = (AppUI.primaryInputIsTouch ? 5 : 3);
	private static readonly minWidthREM = 216;
	private static readonly minWidthPX = AppUI.remToPX(AppUI.minWidthREM);
	private static readonly baseThinBorderPX = 1;
	private static readonly baseThickBorderPX = 2;

	private static readonly zoomHandlers: AppUIZoomHandler[] = [];

	private static readonly rootVariables = document.getElementById("root-variables") as HTMLStyleElement;

	private static readonly panelContainer = document.getElementById("panel-container") as HTMLDivElement;
	private static readonly fixedPanel = document.getElementById("fixed-panel") as HTMLDivElement;
	private static readonly optionalPanel = document.getElementById("optional-panel") as HTMLDivElement;

	private static readonly iconPlay = document.getElementById("icon-play") as HTMLElement;
	private static readonly iconPause = document.getElementById("icon-pause") as HTMLElement;
	private static readonly artistLabel = document.getElementById("artist-label") as HTMLDivElement;
	private static readonly titleLabel = document.getElementById("title-label") as HTMLDivElement;

	private static webFrame: WebFrame | null;

	private static currentTimeS: number;
	private static currentTimeLabel: HTMLSpanElement;
	private static songLengthLabel: HTMLSpanElement;
	private static seekSlider: SliderControl;

	private static volumeLabel: HTMLSpanElement;
	private static volumeSlider: SliderControl;

	private static playlistControl: ListControl<Song>;

	private static graphicalFilterControlEnabled: HTMLInputElement;

	private static _loading = false;

	private static devicePixelRatio = -1;
	private static _smallIconSizePX = Icon.baseSizePX;
	private static _largeIconSizePX = Icon.baseSizePX << 1;
	private static _thinBorderPX = AppUI.baseThinBorderPX;
	private static _thickBorderPX = AppUI.baseThickBorderPX;

	private static directoryCancelled = false;

	private static preparePlaylist(): void {
		if (!App.player || !AppUI.playlistControl)
			return;

		const playlist = App.player.playlist;
		if (!playlist) {
			AppUI.playlistControl.adapter = null;
			return;
		}

		playlist.onsonglengthchanged = AppUI.playlistSongLengthChanged;

		AppUI.playlistControl.adapter = new PlaylistAdapter(playlist);
	}

	private static adjustDecimal(x: number): string {
		let firstTime = true,
			n = x.toFixed(5);

		n = n.substr(0, n.length - 1);

		for (; ; ) {
			const lastChar1 = n.charAt(n.length - 1),
				lastChar2 = n.charAt(n.length - 2);

			if (lastChar1 === lastChar2) {
				if (lastChar1 !== "0") {
					n = n.padEnd(24, lastChar1);
					if (lastChar1 === "9" && firstTime) {
						n = parseFloat(n).toFixed(5);
						firstTime = false;
						continue;
					}
				}
			} else {
				let i = n.lastIndexOf(".");
				let sub1 = n.substr(i + 1, 2),
					sub2 = n.substr(i + 3, 2);
				if (sub1 === sub2) {
					n = n.substr(0, i + 1);
					while (n.length < 24)
						n += sub1;
				} else {
					n = x.toFixed(7);
					i = n.lastIndexOf(".");
					sub1 = n.substr(i + 1, 3);
					sub2 = n.substr(i + 4, 3);
					if (sub1 === sub2) {
						n = n.substr(0, i + 1);
						while (n.length < 24)
							n += sub1;
					} else {
						n = x.toFixed(18);
					}
				}
			}

			break;
		}

		const trailingDecimal = /[,\.]$/,
			trailingZeroes = /0+$/;

		return n.replace(trailingZeroes, "").replace(trailingDecimal, "");
	}

	private static adjustWindow(): void {
		if (AppUI.devicePixelRatio !== devicePixelRatio && AppUI.rootVariables) {
			AppUI.devicePixelRatio = devicePixelRatio;

			const zoom = AppUI.factorToZoom(devicePixelRatio),
				factor = AppUI.zoomToFactor(zoom),
				iconOuterSizePX = AppUI.remToPX(Icon.outerSizeREM);

			// Divide by four and truncate the result at once :)
			const _smallIconSizePX = AppUI.adjustDecimal((Icon.baseSizePX * (((zoom + 1) >> 2) + 1)) / devicePixelRatio);
			AppUI._smallIconSizePX = parseFloat(_smallIconSizePX);

			// Truncate the factor and multiply by two at once :)
			const _largeIconSizePX = AppUI.adjustDecimal((Icon.baseSizePX * (factor << 1)) / devicePixelRatio);
			AppUI._largeIconSizePX = parseFloat(_largeIconSizePX);

			let i = ((AppUI.baseThinBorderPX * devicePixelRatio) | 0) / devicePixelRatio;
			if (!i)
				i = 1;
			const _thinBorderPX = AppUI.adjustDecimal(i);
			AppUI._thinBorderPX = parseFloat(_thinBorderPX);

			i = ((AppUI.baseThickBorderPX * devicePixelRatio) | 0) / devicePixelRatio;
			if (!i)
				i = 1;
			const _thickBorderPX = AppUI.adjustDecimal(i);
			AppUI._thickBorderPX = parseFloat(_thickBorderPX);

			AppUI.rootVariables.textContent = `:root {
				--button-size: ${AppUI.buttonSizePX}px;
				--button-padding-top: ${AppUI.adjustDecimal(0.5 * (AppUI.buttonSizePX - iconOuterSizePX))}px;
				--extra-touch-padding-top: ${AppUI.adjustDecimal(0.5 * (AppUI.buttonSizePX - AppUI.buttonRegularSizePX))}px;
				--icon-size: ${_smallIconSizePX}px;
				--icon-padding: ${AppUI.adjustDecimal(0.5 * (iconOuterSizePX - AppUI._smallIconSizePX))}px;
				--large-icon-size: ${_largeIconSizePX}px;
				--large-icon-padding: ${AppUI.adjustDecimal(0.5 * (iconOuterSizePX - AppUI._largeIconSizePX))}px;
				--thin-border: ${_thinBorderPX}px;
				--thick-border: ${_thickBorderPX}px;
				--scrollbar-size: ${AppUI.scrollbarSizeREM}rem;
				--optional-panel-container-height: ${(348 + AppUI.buttonSizePX)}px;
			}`;

			//if (App.player)
			//	App.player.graphicalFilterControl.editor.scale = factor;

			for (let i = AppUI.zoomHandlers.length - 1; i >= 0; i--)
				AppUI.zoomHandlers[i]();
		}
	}

	public static changeText(element: HTMLElement | null, text: string | null): void {
		if (!element)
			return;

		if (text === null)
			text = "";

		const node = element.lastChild;
		if (!node)
			element.appendChild(document.createTextNode(text));
		else
			node.nodeValue = text;
	}

	private static changeZoom(delta: number): void {
		if (!AppUI.webFrame)
			return;

		const factor = ((devicePixelRatio >= 1) ? (1 + Math.ceil(devicePixelRatio * 4)) :
			((devicePixelRatio <= 0.51) ? 0 :
				((devicePixelRatio <= 0.67) ? 1 :
					((devicePixelRatio <= 0.76) ? 2 :
						((devicePixelRatio <= 0.81) ? 3 :
							4))))) + delta;

		if (factor <= 0) {
			AppUI.webFrame.setZoomFactor(0.5);
		} else if (factor >= 21) {
			AppUI.webFrame.setZoomFactor(5);
		} else {
			switch (factor) {
				case 1:
					AppUI.webFrame.setZoomFactor(2 / 3);
					break;
				case 2:
					AppUI.webFrame.setZoomFactor(3 / 4);
					break;
				case 3:
					AppUI.webFrame.setZoomFactor(4 / 5);
					break;
				case 4:
					AppUI.webFrame.setZoomFactor(9 / 10);
					break;
				default:
					AppUI.webFrame.setZoomFactor((factor - 1) / 4);
					break;
			}
		}
	}

	private static globalKeyHandler(e: KeyboardEvent): any {
		if ((e.ctrlKey || e.metaKey)) {
			if (AppUI.webFrame) {
				// Change default zoom behavior
				switch (e.key) {
					case "-":
						if (!e.repeat)
							AppUI.changeZoom(-1);
						return cancelEvent(e);
					case "+":
					case "=":
						if (!e.repeat)
							AppUI.changeZoom(1);
						return cancelEvent(e);
					case "0":
						return cancelEvent(e);
				}
			}
		} else {
			switch (e.key) {
				case "Escape":
					if (!e.repeat) {
						if (!Modal.visible) {
							if (App.player)
								App.player.playPause();
						} else {
							Modal.hide();
						}
					}
					return cancelEvent(e);
				case "F1":
					if (!e.repeat && App.player)
						App.player.previous();
					return cancelEvent(e);
				case "F2":
					if (!e.repeat && App.player)
						App.player.playPause();
					return cancelEvent(e);
				case "F3":
					if (!e.repeat && App.player)
						App.player.stop();
					return cancelEvent(e);
				case "F4":
					if (!e.repeat && App.player)
						App.player.next();
					return cancelEvent(e);
			}
		}
	}

	public static preInit(webFrame: WebFrame | null, appSettings: AppSettings): void {
		AppUI.webFrame = webFrame;

		window.addEventListener("keydown", AppUI.globalKeyHandler, true);

		if (webFrame && appSettings.devicePixelRatio && appSettings.devicePixelRatio !== devicePixelRatio)
			webFrame.setZoomFactor(appSettings.devicePixelRatio);

		ButtonControl.init();
		CheckboxControl.init();

		AppUI.seekSlider = new SliderControl("seek-slider", false, 0, 1);
		AppUI.seekSlider.disabled = true;
		AppUI.seekSlider.onvaluechanged = AppUI.seekSliderValueChanged;
		AppUI.seekSlider.ondragended = AppUI.seekSliderDragEnded;

		AppUI.currentTimeLabel = document.createElement("span");
		AppUI.currentTimeLabel.className = "seek-label";
		AppUI.currentTimeS = 0;
		AppUI.changeText(AppUI.currentTimeLabel, Formatter.none);
		AppUI.seekSlider.leftChild = AppUI.currentTimeLabel;

		AppUI.songLengthLabel = document.createElement("span");
		AppUI.songLengthLabel.className = "seek-label";
		AppUI.changeText(AppUI.songLengthLabel, Formatter.none);
		AppUI.seekSlider.rightChild = AppUI.songLengthLabel;

		AppUI.volumeSlider = new SliderControl("volume-slider", true, 0, Player.maxVolume, appSettings.playerVolume);
		AppUI.volumeSlider.leftChild = Icon.createLarge("icon-volume", "green small-right-margin");
		AppUI.volumeLabel = document.createElement("span");
		AppUI.volumeLabel.className = "volume-label small-left-margin";
		AppUI.changeText(AppUI.volumeLabel, AppUI.volumeStr(AppUI.volumeSlider.value));
		AppUI.volumeSlider.rightChild = AppUI.volumeLabel;
		AppUI.volumeSlider.onvaluechanged = AppUI.volumeSliderValueChanged;

		AppUI.playlistControl = new ListControl("playlist-control");
		AppUI.playlistControl.onitemclicked = AppUI.playlistControlItemClicked;
		AppUI.playlistControl.onitemcontextmenu = AppUI.playlistControlItemContextMenu;

		AppUI.graphicalFilterControlEnabled = document.getElementById("graphical-filter-control-enabled") as HTMLInputElement;
		AppUI.graphicalFilterControlEnabled.checked = appSettings.graphicalFilterControlEnabled || false;
		AppUI.graphicalFilterControlEnabled.onclick = AppUI.graphicalFilterControlEnabledClicked;

		if (!App.frameless)
			AppUI.panelContainer.classList.add("web");

		window.addEventListener("resize", AppUI.adjustWindow, { passive: true });

		AppUI.adjustWindow();
	}

	public static init(appSettings: AppSettings): void {
		if (App.player) {
			AppUI.volumeSlider.value = App.player.volume;

			App.player.onsongchanged = AppUI.playerSongChanged;
			App.player.onloadingchanged = AppUI.playerLoadingChanged;
			App.player.onpausedchanged = AppUI.playerPausedChanged;
			App.player.oncurrenttimeschanged = AppUI.playerCurrentTimeSChanged;
			App.player.onerror = AppUI.playerError;

			AppUI.preparePlaylist();

			AppUI.playerSongChanged(App.player.currentSong);

			if (App.player.playlist && App.player.playlist.currentIndex >= 0)
				AppUI.playlistControl.centerItemIntoView(App.player.playlist.currentIndex);
		}
	}

	public static destroy(): void {
		zeroObject(AppUI);
	}

	public static get loading(): boolean {
		return AppUI._loading;
	}

	public static get thinBorderPX(): number {
		return AppUI._thinBorderPX;
	}

	public static get thickBorderPX(): number {
		return AppUI._thickBorderPX;
	}

	public static addZoomHandler(zoomHandler: AppUIZoomHandler | null): void {
		if (zoomHandler)
			AppUI.zoomHandlers.push(zoomHandler);
	}

	public static removeZoomHandler(zoomHandler: AppUIZoomHandler | null): void {
		if (!zoomHandler)
			return;

		for (let i = AppUI.zoomHandlers.length - 1; i >= 0; i--) {
			if (AppUI.zoomHandlers[i] === zoomHandler) {
				AppUI.zoomHandlers.splice(i, 1);
				return;
			}
		}
	}

	public static factorToZoom(factor: number): number {
		return (factor <= 1 ? 0 : (Math.round(factor * 4) - 4));
	}

	public static zoomToFactor(zoom: number): number {
		return (zoom <= 0 ? 1 : ((zoom + 4) * 0.25));
	}

	public static remToPX(rem: number): number {
		return rem * AppUI.rem;
	}

	public static pxToREM(px: number): number {
		return px / AppUI.rem;
	}

	private static playerSongChanged(song: Song | null): void {
		if (!App.player || !AppUI.playlistControl)
			return;

		AppUI.changeText(AppUI.artistLabel, (song && song.artist) || Formatter.none);

		AppUI.changeText(AppUI.titleLabel, (song && song.title) || Formatter.none);

		if (App.player.playlist && App.player.playlist.currentIndex >= 0)
			AppUI.playlistControl.bringItemIntoView(App.player.playlist.currentIndex);

		AppUI.currentTimeS = 0;

		if (!song) {
			AppUI.changeText(AppUI.currentTimeLabel, Formatter.none);

			AppUI.changeText(AppUI.songLengthLabel, Formatter.none);

			if (AppUI.seekSlider) {
				AppUI.seekSlider.disabled = true;
				AppUI.seekSlider.value = 0;
			}
		} else {
			AppUI.changeText(AppUI.currentTimeLabel, Formatter.zero);

			AppUI.changeText(AppUI.songLengthLabel, song.length);

			if (AppUI.seekSlider) {
				AppUI.seekSlider.value = 0;

				if (song.lengthMS > 0) {
					AppUI.seekSlider.disabled = false;
					AppUI.seekSlider.max = song.lengthMS;
				} else {
					AppUI.seekSlider.disabled = true;
				}
			}
		}
	}

	private static playerLoadingChanged(loading: boolean): void {
		App.updateLoadingIcon();
	}

	private static playerPausedChanged(paused: boolean): void {
		if (AppUI.iconPlay && AppUI.iconPause) {
			if (paused) {
				AppUI.iconPause.classList.add("hidden");
				AppUI.iconPlay.classList.remove("hidden");
			} else {
				AppUI.iconPlay.classList.add("hidden");
				AppUI.iconPause.classList.remove("hidden");
			}
		}
	}

	private static playerCurrentTimeSChanged(currentTimeS: number): void {
		if (!AppUI.seekSlider || AppUI.seekSlider.dragging)
			return;

		const s = currentTimeS | 0;
		if (AppUI.currentTimeS !== s) {
			AppUI.currentTimeS = s;

			AppUI.changeText(AppUI.currentTimeLabel, Formatter.formatTimeS(s));
		}

		AppUI.seekSlider.value = currentTimeS * 1000;
	}

	private static playerError(message: string): void {
		alert(message);
	}

	private static playlistSongLengthChanged(song: Song): void {
		if (!App.player)
			return;

		if (song === App.player.currentSong) {
			AppUI.changeText(AppUI.songLengthLabel, song.length);

			if (AppUI.seekSlider) {
				if (song.lengthMS > 0) {
					AppUI.seekSlider.disabled = false;
					AppUI.seekSlider.max = song.lengthMS;
				} else {
					AppUI.seekSlider.value = 0;
					AppUI.seekSlider.disabled = true;
				}
			}
		}

		if (AppUI.playlistControl)
			AppUI.playlistControl.refreshVisibleItems();
	}

	private static seekSliderValueChanged(value: number): void {
		if (!AppUI.seekSlider || !AppUI.seekSlider.dragging)
			return;

		const s = ((value / 1000) | 0);
		if (AppUI.currentTimeS !== s) {
			AppUI.currentTimeS = s;

			AppUI.changeText(AppUI.currentTimeLabel, Formatter.formatTimeS(s));
		}
	}

	private static seekSliderDragEnded(value: number): void {
		if (!App.player || !App.player.currentSong)
			return;

		App.player.seekTo(value);
	}

	private static volumeStr(value: number): string {
		return (value >= Player.maxVolume ? "-0" : (value ? (value - Player.maxVolume) : GraphicalFilterEditorStrings.MinusInfinity)) + " dB";
	}

	private static volumeSliderValueChanged(value: number): void {
		if (App.player)
			App.player.volume = value;

		if (AppUI.volumeLabel)
			AppUI.changeText(AppUI.volumeLabel, AppUI.volumeStr(value));
	}

	private static playlistControlItemClicked(item: Song, index: number): void {
		if (!App.player)
			return;

		App.player.play(index);
	}

	private static playlistControlItemContextMenu(item: Song, index: number): void {
		if (!App.player)
			return;

		App.player.play(index);
	}

	private static graphicalFilterControlEnabledClicked(): void {
		if (!App.player)
			return;

		App.player.graphicalFilterControl.enabled = AppUI.graphicalFilterControlEnabled.checked;
	}

	public static async addFiles(webDirectory?: boolean): Promise<void> {
		if (!App.player || AppUI._loading)
			return;

		const filePaths = (App.electron ? await App.showOpenFileDialog() : await App.showOpenDialogWeb(webDirectory));
		if (!filePaths || !App.player)
			return;

		try {
			AppUI._loading = true;
			App.updateLoadingIcon();

			if (!App.player.playlist) {
				App.player.playlist = new Playlist();
				AppUI.preparePlaylist();
			}

			const buffer = (App.electron ? null : new Uint8Array(BufferedFileHandle.minBufferLength << 1)),
				tempBuffer = (App.electron ? null : [new Uint8Array(256)]);

			for (let i = 0; i < filePaths.length; i++) {
				if (!App.player || !App.player.playlist)
					break;

				if (App.electron)
					await App.player.playlist.addSong(filePaths[i] as string);
				else
					await App.player.playlist.addSongWeb(filePaths[i] as File, buffer, tempBuffer);
			}
		} catch (ex: any) {
			// @@@
			alert("addFiles error: " + (ex.message || ex.toString()));
		} finally {
			AppUI._loading = false;
			App.updateLoadingIcon();
		}
	}

	private static async addDirectory(urlOrAbsolutePath: string): Promise<boolean> {
		const appFiles = await App.listDirectory(urlOrAbsolutePath);

		if (!App.player || !App.player.playlist || AppUI.directoryCancelled)
			return false;

		if (!appFiles)
			return true;

		for (let i = 0; i < appFiles.length; i++) {
			if (appFiles[i].isDirectory) {
				if (!await AppUI.addDirectory(appFiles[i].fileURL))
					return false;

				continue;
			}

			if (!App.player || !App.player.playlist || AppUI.directoryCancelled)
				return false;

			await App.player.playlist.addSong(appFiles[i]);
		}

		return true;
	}

	public static async addDirectories(): Promise<void> {
		if (!App.player || AppUI._loading)
			return;

		if (!App.electron)
			return AppUI.addFiles(true);

		const directoryPaths = await App.showOpenDirectoryDialog();
		if (!directoryPaths || !App.player)
			return;

		try {
			AppUI._loading = true;
			AppUI.directoryCancelled = false;
			App.updateLoadingIcon();

			if (!App.player.playlist) {
				App.player.playlist = new Playlist();
				AppUI.preparePlaylist();
			}

			for (let i = 0; i < directoryPaths.length; i++) {
				if (!await AppUI.addDirectory(directoryPaths[i]))
					break;
			}
		} catch (ex: any) {
			// @@@
			alert("addDirectories error: " + (ex.message || ex.toString()));
		} finally {
			AppUI._loading = false;
			AppUI.directoryCancelled = false;
			App.updateLoadingIcon();
		}
	}

	public static switchView(): void {
		if (AppUI.panelContainer)
			AppUI.panelContainer.classList.toggle("toggled");
	}

	public static showAbout(): void {
		Modal.show({
			html: Strings.AboutHTML,
			title: Strings.About
		});
	}
}
