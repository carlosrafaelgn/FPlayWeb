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

	public static readonly baseSizePX = 4;
	public static readonly s1PX = AppUI.baseSizePX;
	public static readonly s2PX = AppUI.baseSizePX * 2;
	public static readonly s3PX = AppUI.baseSizePX * 3;
	public static readonly s4PX = AppUI.baseSizePX * 4;
	public static readonly s5PX = AppUI.baseSizePX * 5;
	public static readonly s6PX = AppUI.baseSizePX * 6;
	public static readonly s7PX = AppUI.baseSizePX * 7;
	public static readonly s8PX = AppUI.baseSizePX * 8;

	public static readonly smallFontSizeREM = 3;
	public static readonly smallContentsSizeREM = 4;

	public static readonly fontSizeREM = 3.5;
	public static readonly contentsSizeREM = 6;

	private static readonly baseThinBorderPX = 1;
	private static readonly baseThickBorderPX = 2;

	private static readonly zoomHandlers: AppUIZoomHandler[] = [];

	private static readonly rootVariables = document.getElementById("root-variables") as HTMLStyleElement;

	private static readonly panelContainer = document.getElementById("panel-container") as HTMLDivElement;
	private static readonly fixedPanel = document.getElementById("fixed-panel") as HTMLDivElement;
	private static readonly middlePanel = document.getElementById("middle-panel") as HTMLDivElement;
	private static readonly optionalPanel = document.getElementById("optional-panel") as HTMLDivElement;

	private static readonly iconPlay = document.getElementById("i-play") as HTMLElement;
	private static readonly iconPause = document.getElementById("i-pause") as HTMLElement;
	private static readonly ruler = document.getElementById("ruler") as HTMLDivElement;
	private static readonly titleLabel = document.getElementById("title-label") as HTMLDivElement;
	private static readonly artistLabel = document.getElementById("artist-label") as HTMLDivElement;
	private static readonly topMessage = document.getElementById("top-message") as HTMLDivElement;

	private static webFrame: WebFrame | null;

	private static currentTimeS: number;
	private static currentTimeLabel: HTMLSpanElement;
	private static songLengthLabel: HTMLSpanElement;
	private static seekSlider: SliderControl;

	private static volumeLabel: HTMLSpanElement;
	private static volumeSlider: SliderControl;

	private static playlistControl: ListControl<Song>;

	private static graphicalFilterControlType: HTMLButtonElement;
	private static graphicalFilterControlEnabled: HTMLInputElement;
	private static stereoPannerControlEnabled: HTMLInputElement;
	private static monoDownMixerControlEnabled: HTMLInputElement;

	private static _loading = false;

	private static devicePixelRatio = -1;
	private static _1remInPX = 1;
	private static _fontScale = 1;
	private static _smallIconSizePX = Icon.baseSizePX;
	private static _largeIconSizePX = Icon.baseSizePX << 1;
	private static _thinBorderPX = AppUI.baseThinBorderPX;
	private static _thickBorderPX = AppUI.baseThickBorderPX;
	private static _buttonSizePX = 1;
	private static _contentsSizePX = 1;
	private static _playlistItemSizePX = 1;

	private static directoryCancelled = false;

	private static topMessageFading = 0;
	private static topMessageTimeout = 0;

	private static focusBlocker: FocusBlocker | null = null;

	private static panelContainerToggled = false;
	private static panelContainerToggling = false;
	private static panelContainerToggleVersion = 0;

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

		n = n.substring(0, n.length - 1);

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
				let sub1 = n.substring(i + 1, i + 1 + 2),
					sub2 = n.substring(i + 3, i + 3 + 2);
				if (sub1 === sub2) {
					n = n.substring(0, i + 1);
					while (n.length < 24)
						n += sub1;
				} else {
					n = x.toFixed(7);
					i = n.lastIndexOf(".");
					sub1 = n.substring(i + 1, i + 1 + 3);
					sub2 = n.substring(i + 4, i + 4 + 3);
					if (sub1 === sub2) {
						n = n.substring(0, i + 1);
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
		const _1remInPx = (App.hostInterface ? (AppUI.baseSizePX * (AppUI._fontScale = App.hostInterface.getFontScale())) : (AppUI.ruler.getBoundingClientRect().height * 0.125));

		if (AppUI.devicePixelRatio !== devicePixelRatio || AppUI._1remInPX !== _1remInPx) {
			AppUI.devicePixelRatio = devicePixelRatio;
			AppUI._1remInPX = _1remInPx;

			if (App.hostInterface)
				document.documentElement.style.fontSize = ((_1remInPx !== AppUI.baseSizePX) ? (_1remInPx + "px") : "");
			else
				AppUI._fontScale = AppUI._1remInPX / AppUI.baseSizePX;

			const contentsSizePXStr = AppUI.adjustDecimal(AppUI.remToPX(AppUI.contentsSizeREM));
			AppUI._contentsSizePX = parseFloat(contentsSizePXStr);

			AppUI._buttonSizePX = AppUI._contentsSizePX + (AppUI.primaryInputIsTouch ? AppUI.s6PX : AppUI.s2PX);

			// New way to choose the size of the icons
			const referenceLargeIconSizePX = Icon.baseSizePX / devicePixelRatio,
				largeIconsInsideContents = (AppUI._contentsSizePX / referenceLargeIconSizePX) | 0;

			let smallIconSizePXStr: string,
				largeIconSizePXStr: string;

			if (largeIconsInsideContents <= 0) {
				// The user has probably zoomed out too much!
				smallIconSizePXStr = contentsSizePXStr;
				largeIconSizePXStr = contentsSizePXStr;
				AppUI._smallIconSizePX = AppUI._contentsSizePX;
				AppUI._largeIconSizePX = AppUI._contentsSizePX;
			} else if (largeIconsInsideContents === 1) {
				smallIconSizePXStr = AppUI.adjustDecimal(referenceLargeIconSizePX);
				largeIconSizePXStr = smallIconSizePXStr;
				AppUI._smallIconSizePX = parseFloat(smallIconSizePXStr);
				AppUI._largeIconSizePX = AppUI._smallIconSizePX;
			} else {
				// Try to use an even multiplier for the small icons
				smallIconSizePXStr = AppUI.adjustDecimal(Math.max((largeIconsInsideContents >> 1) & ~1, 1) * Icon.baseSizePX / devicePixelRatio);
				// Always use an even multiplier for the large icons
				largeIconSizePXStr = AppUI.adjustDecimal((largeIconsInsideContents & ~1) * Icon.baseSizePX / devicePixelRatio);
				AppUI._smallIconSizePX = parseFloat(smallIconSizePXStr);
				AppUI._largeIconSizePX = parseFloat(largeIconSizePXStr);
			}

			//const zoom = AppUI.factorToZoom(devicePixelRatio),
			//	factor = AppUI.zoomToFactor(zoom);

			//// Divide by four and truncate the result at once :)
			//const smallIconSizePXStr = AppUI.adjustDecimal((Icon.baseSizePX * (((zoom + 1) >> 2) + 1)) / devicePixelRatio);
			//AppUI._smallIconSizePX = parseFloat(smallIconSizePXStr);

			//// Truncate the factor and multiply by two at once :)
			//const largeIconSizePXStr = AppUI.adjustDecimal((Icon.baseSizePX * (factor << 1)) * (Math.max(1, AppUI._fontScale) | 0) / devicePixelRatio);
			//AppUI._largeIconSizePX = parseFloat(largeIconSizePXStr);

			let i = ((AppUI.baseThinBorderPX * devicePixelRatio) | 0) / devicePixelRatio;
			if (!i)
				i = 1;
			const thinBorderPXStr = AppUI.adjustDecimal(i);
			AppUI._thinBorderPX = parseFloat(thinBorderPXStr);

			i = ((AppUI.baseThickBorderPX * devicePixelRatio) | 0) / devicePixelRatio;
			if (!i)
				i = 1;
			const thickBorderPXStr = AppUI.adjustDecimal(i);
			AppUI._thickBorderPX = parseFloat(thickBorderPXStr);

			const playlistItemSizePXStr = AppUI.adjustDecimal((3 * AppUI.remToPX(AppUI.smallContentsSizeREM)) + AppUI.s2PX);
			AppUI._playlistItemSizePX = parseFloat(playlistItemSizePXStr);

			AppUI.rootVariables.textContent = `:root {
				--button-size: ${AppUI._buttonSizePX}px;
				--button-padding: ${AppUI.adjustDecimal(0.5 * (AppUI._buttonSizePX - AppUI._contentsSizePX))}px;
				--negative-button-padding: -${AppUI.adjustDecimal(0.5 * (AppUI._buttonSizePX - AppUI._contentsSizePX))}px;
				--icon-size: ${smallIconSizePXStr}px;
				--icon-padding: ${AppUI.adjustDecimal(0.5 * (AppUI._contentsSizePX - AppUI._smallIconSizePX))}px;
				--large-icon-size: ${largeIconSizePXStr}px;
				--large-icon-padding: ${AppUI.adjustDecimal(0.5 * (AppUI._contentsSizePX - AppUI._largeIconSizePX))}px;
				--thin-border: ${thinBorderPXStr}px;
				--thick-border: ${thickBorderPXStr}px;
				--scrollbar-size: ${(AppUI.primaryInputIsTouch ? 20 : 12)}px;
				--playlist-item-size: ${playlistItemSizePXStr}px;
			}`;

			//if (App.player)
			//	App.player.graphicalFilterControl.editor.scale = factor;

			for (let i = AppUI.zoomHandlers.length - 1; i >= 0; i--)
				AppUI.zoomHandlers[i]();
		}

		AppUI.checkPanelContainerToggleState();
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
							if (AppUI.playlistControl && AppUI.playlistControl.deleteMode)
								AppUI.toggleDeleteMode(true);
							else if (App.player)
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

	private static historyStatePopped(): boolean | null {
		if (!AppUI.playlistControl || !AppUI.playlistControl.deleteMode) {
			if (!AppUI.panelContainerToggled)
				return null;

			AppUI.toggleView(false);

			return true;
		}

		AppUI.toggleDeleteMode(false);

		return true;
	}

	public static preInit(webFrame: WebFrame | null, appSettings: AppSettings): void {
		// A few mobile devices wrongly report they support mouse and simply ignore the
		// (hover: none) media query. There are mobile devices with an even stranger
		// behavior: they ignore the (hover: none) media query, reporting mouse support,
		// during regular usage, but they *do* consider the (hover: none) media query
		// while the tab is being remotely inspected by a desktop DevTools session
		// (using chrome://inspect). Therefore, I decided to replace all (hover: none)
		// media queries with a (pointer: coarse) media query, which is the criteria
		// used by AppUI.primaryInputIsTouch to determine whether the device's primary
		// input device is mouse or touch. If that media query fails, another possible
		// solution is to uncomment these two lines below, comment out all (pointer: coarse)
		// media queries from the CSS, and prepend "body.hover-none " to all the rules
		// inside the (pointer: coarse) media queries.
		//if (AppUI.primaryInputIsTouch)
		//	document.body.classList.add("hover-none");

		AppUI.webFrame = webFrame;

		window.addEventListener("keydown", AppUI.globalKeyHandler, true);

		if (webFrame && appSettings.devicePixelRatio && appSettings.devicePixelRatio !== devicePixelRatio)
			webFrame.setZoomFactor(appSettings.devicePixelRatio);

		if (FilePicker.isSupported()) {
			FilePicker.lastPath = appSettings.filePickerLastPath || null;
			FilePicker.lastRootLength = appSettings.filePickerRootLength || 0;

			const addFolderButton = document.getElementById("add-folder-button") as HTMLElement;
			(addFolderButton.parentNode as HTMLElement).removeChild(addFolderButton);
		}

		ButtonControl.init();
		CheckboxControl.init();

		AppUI.seekSlider = new SliderControl("seek-slider", false, false, 0, 1);
		AppUI.seekSlider.disabled = true;
		AppUI.seekSlider.onvaluechanged = AppUI.seekSliderValueChanged;
		AppUI.seekSlider.ondragended = AppUI.seekSliderDragEnded;

		AppUI.currentTimeLabel = document.createElement("span");
		AppUI.currentTimeLabel.className = "seek-label";
		AppUI.currentTimeS = 0;
		Strings.changeText(AppUI.currentTimeLabel, Formatter.none);
		AppUI.seekSlider.leftChild = AppUI.currentTimeLabel;

		AppUI.songLengthLabel = document.createElement("span");
		AppUI.songLengthLabel.className = "seek-label";
		Strings.changeText(AppUI.songLengthLabel, Formatter.none);
		AppUI.seekSlider.rightChild = AppUI.songLengthLabel;

		AppUI.volumeSlider = new SliderControl("volume-slider", true, false, 0, Player.maxVolume, appSettings.playerVolume);
		AppUI.volumeSlider.leftChild = Icon.createLarge("icon-volume", "green small-right-margin");
		AppUI.volumeLabel = document.createElement("span");
		AppUI.volumeLabel.className = "small-left-margin";
		AppUI.volumeLabel.setAttribute("id", "volume-label");
		Strings.changeText(AppUI.volumeLabel, AppUI.volumeStr(AppUI.volumeSlider.value));
		AppUI.volumeSlider.rightChild = AppUI.volumeLabel;
		AppUI.volumeSlider.onvaluechanged = AppUI.volumeSliderValueChanged;

		AppUI.playlistControl = new ListControl("playlist-control", true);
		AppUI.playlistControl.onitemclicked = AppUI.playlistControlItemClicked;
		AppUI.playlistControl.onitemcontextmenu = AppUI.playlistControlItemContextMenu;

		AppUI.graphicalFilterControlType = document.getElementById("graphical-filter-control-type") as HTMLButtonElement;
		ButtonControl.setText(AppUI.graphicalFilterControlType, appSettings.graphicalFilterControlSimpleMode ? Strings.TraditionalFilter : Strings.AdvancedFilter);
		AppUI.graphicalFilterControlType.onclick = AppUI.graphicalFilterControlTypeClicked;

		AppUI.graphicalFilterControlEnabled = document.getElementById("graphical-filter-control-enabled") as HTMLInputElement;
		AppUI.graphicalFilterControlEnabled.checked = appSettings.graphicalFilterControlEnabled || false;
		AppUI.graphicalFilterControlEnabled.onclick = AppUI.graphicalFilterControlEnabledClicked;

		AppUI.stereoPannerControlEnabled = document.getElementById("stereo-panner-control-enabled") as HTMLInputElement;
		AppUI.stereoPannerControlEnabled.checked = appSettings.stereoPannerControlEnabled || false;
		AppUI.stereoPannerControlEnabled.onclick = AppUI.stereoPannerControlEnabledClicked;

		if (MonoDownMixerControl.isSupported()) {
			AppUI.monoDownMixerControlEnabled = document.getElementById("mono-down-mixer-control-enabled") as HTMLInputElement;
			AppUI.monoDownMixerControlEnabled.checked = appSettings.monoDownMixerControlEnabled || false;
			AppUI.monoDownMixerControlEnabled.onclick = AppUI.monoDownMixerControlEnabledClicked;
		} else {
			const monoDownMixerControlContainer = document.getElementById("mono-down-mixer-control-container") as HTMLDivElement;
			(monoDownMixerControlContainer.parentNode as HTMLDivElement).removeChild(monoDownMixerControlContainer);
		}

		if (App.frameless)
			AppUI.panelContainer.classList.remove("web");

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

			AppUI.centerCurrentSongIntoView();

			try {
				AppUI.playlistControl.element.focus();
			} catch (ex: any) {
				// Just ignore...
			}

			HistoryHandler.init(Menu.historyStatePopped, Modal.historyStatePopped, AppUI.historyStatePopped);
		}
	}

	public static centerCurrentSongIntoView(): void {
		if (App.player && App.player.playlist && App.player.playlist.currentIndex >= 0)
			AppUI.playlistControl.centerItemIntoView(App.player.playlist.currentIndex);
	}

	public static destroy(): void {
		zeroObject(AppUI);
	}

	public static get loading(): boolean {
		return AppUI._loading;
	}

	public static get fontScale(): number {
		return AppUI._fontScale;
	}

	public static get smallIconSizePX(): number {
		return AppUI._smallIconSizePX;
	}

	public static get largeIconSizePX(): number {
		return AppUI._largeIconSizePX;
	}

	public static get thinBorderPX(): number {
		return AppUI._thinBorderPX;
	}

	public static get thickBorderPX(): number {
		return AppUI._thickBorderPX;
	}

	public static get buttonSizePX(): number {
		return AppUI._buttonSizePX;
	}

	public static get contentsSizePX(): number {
		return AppUI._contentsSizePX;
	}

	public static get playlistItemSizePX(): number {
		return AppUI._playlistItemSizePX;
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
		return rem * AppUI._1remInPX;
	}

	public static pxToREM(px: number): number {
		return px / AppUI._1remInPX;
	}

	private static playerSongChanged(song: Song | null): void {
		if (!App.player || !AppUI.playlistControl)
			return;

		Strings.changeText(AppUI.titleLabel, (song && song.title) || Formatter.none);

		Strings.changeText(AppUI.artistLabel, (song && song.artist) || Formatter.none);

		if (App.player.playlist && App.player.playlist.currentIndex >= 0 && !AppUI.playlistControl.deleteMode && song)
			AppUI.playlistControl.bringItemIntoView(App.player.playlist.currentIndex);

		AppUI.currentTimeS = 0;

		if (!song) {
			Strings.changeText(AppUI.currentTimeLabel, Formatter.none);

			Strings.changeText(AppUI.songLengthLabel, Formatter.none);

			if (AppUI.seekSlider) {
				AppUI.seekSlider.disabled = true;
				AppUI.seekSlider.value = 0;
			}
		} else {
			Strings.changeText(AppUI.currentTimeLabel, Formatter.zero);

			Strings.changeText(AppUI.songLengthLabel, song.length);

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

			Strings.changeText(AppUI.currentTimeLabel, Formatter.formatTimeS(s));
		}

		AppUI.seekSlider.value = currentTimeS * 1000;
	}

	private static playerError(message: string): void {
		Modal.show({ text: message });
	}

	private static playlistSongLengthChanged(song: Song): void {
		if (!App.player)
			return;

		if (song === App.player.currentSong) {
			Strings.changeText(AppUI.songLengthLabel, song.length);

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

			Strings.changeText(AppUI.currentTimeLabel, Formatter.formatTimeS(s));
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
			Strings.changeText(AppUI.volumeLabel, AppUI.volumeStr(value));
	}

	private static playlistControlItemClicked(item: Song, index: number, button: number): void {
		if (!App.player || button)
			return;

		App.player.play(index);
	}

	private static playlistControlItemContextMenu(item: Song, index: number): void {
		if (!App.player)
			return;

		//App.player.play(index);
	}

	private static graphicalFilterControlTypeClicked(): void {
		if (!App.graphicalFilterControl)
			return;

		App.graphicalFilterControl.simpleMode = !App.graphicalFilterControl.simpleMode;
		ButtonControl.setText(AppUI.graphicalFilterControlType, App.graphicalFilterControl.simpleMode ? Strings.TraditionalFilter : Strings.AdvancedFilter);
	}

	private static graphicalFilterControlEnabledClicked(): void {
		if (!App.graphicalFilterControl)
			return;

		App.graphicalFilterControl.enabled = AppUI.graphicalFilterControlEnabled.checked;
	}

	private static stereoPannerControlEnabledClicked(): void {
		if (!App.stereoPannerControl)
			return;

		App.stereoPannerControl.enabled = AppUI.stereoPannerControlEnabled.checked;
	}

	private static monoDownMixerControlEnabledClicked(): void {
		if (!App.monoDownMixerControl)
			return;

		App.monoDownMixerControl.enabled = AppUI.monoDownMixerControlEnabled.checked;
	}

	public static hideTopMessage(): void {
		if (AppUI.topMessageFading < 0 || !AppUI.topMessage)
			return;

		if (AppUI.topMessageTimeout)
			clearTimeout(AppUI.topMessageTimeout);

		AppUI.topMessageFading = -1;

		AppUI.topMessage.classList.remove("in");

		AppUI.topMessageTimeout = DelayControl.delayFadeCB(function () {
			if (AppUI.topMessageFading >= 0)
				return;

			AppUI.topMessageFading = 0;
			AppUI.topMessageTimeout = 0;

			AppUI.topMessage.style.visibility = "";

			AppUI.topMessage.innerHTML = "";

			if (AppUI.titleLabel)
				AppUI.titleLabel.classList.remove("behind");

			if (AppUI.artistLabel)
				AppUI.artistLabel.classList.remove("behind");
		});
	}

	public static showTopMessage(html: string, createHandler?: (parent: HTMLDivElement) => void): void {
		if (!AppUI.topMessage)
			return;

		if (AppUI.topMessageTimeout)
			clearTimeout(AppUI.topMessageTimeout);

		AppUI.topMessageFading = 1;

		if (AppUI.titleLabel)
			AppUI.titleLabel.classList.add("behind");

		if (AppUI.artistLabel)
			AppUI.artistLabel.classList.add("behind");

		AppUI.topMessage.innerHTML = html;

		if (createHandler)
			createHandler(AppUI.topMessage);

		AppUI.topMessage.style.visibility = "visible";

		AppUI.topMessageTimeout = DelayControl.delayShortCB(function () {
			if (AppUI.topMessageFading <= 0 || AppUI.topMessageFading !== 1)
				return;

			AppUI.topMessageFading = 2;

			AppUI.topMessage.classList.add("in");

			AppUI.topMessageTimeout = DelayControl.delayFadeCB(function () {
				if (AppUI.topMessageFading !== 2)
					return;

				AppUI.topMessageFading = 0;
				AppUI.topMessageTimeout = 0;
			});
		});
	}

	public static async addFiles(webDirectory?: boolean): Promise<void> {
		if (!App.player || AppUI._loading || Modal.visible || FilePicker.visible)
			return;

		const electron = (App.hostType === App.hostTypeElectron),
			filePaths = (FilePicker.isSupported() ? await FilePicker.show() : await App.showOpenDialogWeb(webDirectory));

		if (!filePaths || !App.player)
			return;

		try {
			AppUI._loading = true;
			App.updateLoadingIcon();

			if (!App.player.playlist) {
				App.player.playlist = new Playlist();
				AppUI.preparePlaylist();
			}

			const playlist = App.player.playlist,
				buffer = (electron ? null : new Uint8Array(BufferedFileHandle.minBufferLength << 1)),
				tempBuffer = (electron ? null : [new Uint8Array(256)]);

			let missingSongWasAdded = false;

			for (let i = 0; i < filePaths.length && App.player; i++) {
				if (electron) {
					await playlist.addSong(filePaths[i] as string);
				} else {
					const oldLength = playlist.length;
					if (await playlist.addSongWeb(filePaths[i] as File, buffer, tempBuffer) && oldLength === playlist.length)
						missingSongWasAdded = true;
				}
			}

			if (missingSongWasAdded && AppUI.playlistControl)
				AppUI.playlistControl.refreshVisibleItems();
		} catch (ex: any) {
			Modal.show({ text: "addFiles error: " + (ex.message || ex.toString()) });
		} finally {
			AppUI._loading = false;
			App.updateLoadingIcon();
		}
	}

	public static toggleDeleteMode(popStateIfLeaving: boolean): void {
		if (!AppUI.playlistControl)
			return;

		if (AppUI.focusBlocker) {
			AppUI.focusBlocker.unblock();
			AppUI.focusBlocker = null;
		}

		if (AppUI.playlistControl.deleteMode) {
			AppUI.playlistControl.deleteMode = false;

			AppUI.hideTopMessage();

			if (popStateIfLeaving)
				HistoryHandler.popState();
		} else {
			AppUI.playlistControl.deleteMode = true;

			AppUI.focusBlocker = new FocusBlocker();
			AppUI.focusBlocker.block(AppUI.middlePanel);

			AppUI.showTopMessage(Strings.DeleteModeHTML, function (parent) {
				const div = document.createElement("div");

				ButtonControl.create({
					color: "red",
					icon: "icon-delete-all",
					text: Strings.DeleteAllSongs,
					parent: div,
					onclick: function () {
						if (App.player && App.player.playlist)
							App.player.playlist.clear();

						if (AppUI.playlistControl && AppUI.playlistControl.deleteMode)
							AppUI.toggleDeleteMode(true);
					}
				});

				ButtonControl.create({
					color: "green",
					icon: "icon-check",
					text: Strings.Done,
					parent: div,
					onclick: function () {
						if (AppUI.playlistControl && AppUI.playlistControl.deleteMode)
							AppUI.toggleDeleteMode(true);
					}
				});

				parent.appendChild(div);
			});

			HistoryHandler.pushState();

			try {
				AppUI.playlistControl.element.focus();
			} catch (ex: any) {
				// Just ignore...
			}
		}
	}

	private static checkPanelContainerToggleState() {
		if (window.innerWidth <= 875 || !AppUI.fixedPanel || !AppUI.optionalPanel)
			return;

		if (AppUI.panelContainerToggling) {
			AppUI.panelContainerToggleVersion++;
			AppUI.panelContainerToggling = false;

			AppUI.fixedPanel.classList.remove("fade");
			AppUI.fixedPanel.classList.remove("in");

			AppUI.optionalPanel.classList.remove("fade");
			AppUI.optionalPanel.classList.remove("in");
		}

		if (AppUI.panelContainerToggled) {
			AppUI.panelContainerToggled = false;

			AppUI.panelContainer.classList.remove("toggled");

			HistoryHandler.popState();
		}
	}

	public static toggleView(popStateIfLeaving: boolean): void {
		if (AppUI.panelContainer) {
			AppUI.panelContainerToggleVersion++;

			const version = AppUI.panelContainerToggleVersion,
				fadePanels = function (fadeOutPanel: HTMLDivElement, fadeInPanel: HTMLDivElement, addToggledClass: boolean) {
					AppUI.panelContainerToggling = true;

					fadeInPanel.classList.remove("in");
					fadeInPanel.classList.add("fade");

					fadeOutPanel.classList.add("in");
					fadeOutPanel.classList.add("fade");

					DelayControl.delayShortCB(async function () {
						if (AppUI.panelContainerToggleVersion !== version)
							return;

						fadeOutPanel.classList.remove("in");

						await DelayControl.delayFade();

						if (AppUI.panelContainerToggleVersion !== version)
							return;

						if (addToggledClass)
							AppUI.panelContainer.classList.add("toggled");
						else
							AppUI.panelContainer.classList.remove("toggled");

						fadeOutPanel.classList.remove("fade");

						await DelayControl.delayShort();

						if (AppUI.panelContainerToggleVersion !== version)
							return;

						fadeInPanel.classList.add("in");

						await DelayControl.delayFade();

						if (AppUI.panelContainerToggleVersion !== version)
							return;

						fadeInPanel.classList.remove("fade");
						fadeInPanel.classList.remove("in");

						AppUI.panelContainerToggling = false;
					});
				};

			if (AppUI.panelContainerToggled) {
				AppUI.panelContainerToggled = false;

				fadePanels(AppUI.optionalPanel, AppUI.fixedPanel, false);

				if (popStateIfLeaving)
					HistoryHandler.popState();
			} else {
				AppUI.panelContainerToggled = true;

				fadePanels(AppUI.fixedPanel, AppUI.optionalPanel, true);

				HistoryHandler.pushState();
			}
		}
	}

	public static showAbout(): void {
		Modal.show({
			html: Strings.AboutHTML + ((App.player && App.player.audioContext) ? ('<br/><br/><small>Base latency: ' + (App.player.audioContext.baseLatency || 0).toFixed(4) + ' s<br/>Output latency: ' + (isNaN((App.player.audioContext as any).outputLatency) ? "-" : ((App.player.audioContext as any).outputLatency.toFixed(4) + ' s')) +  '</small>') : ''),
			title: Strings.About + " (v" + (window as any).CACHE_VERSION + ")"
		});
	}
}
