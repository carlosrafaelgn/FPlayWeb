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

	private static readonly cover = document.getElementById("cover") as HTMLDivElement;
	private static readonly panelContainer = document.getElementById("panel-container") as HTMLDivElement;
	private static readonly fixedPanel = document.getElementById("fixed-panel") as HTMLDivElement;
	private static readonly middlePanel = document.getElementById("middle-panel") as HTMLDivElement;
	private static readonly optionalPanel = document.getElementById("optional-panel") as HTMLDivElement;

	private static readonly iconPlay = document.getElementById("i-play") as HTMLElement;
	private static readonly iconPause = document.getElementById("i-pause") as HTMLElement;
	private static readonly ruler = document.getElementById("ruler") as HTMLDivElement;
	private static readonly titleLabel = document.getElementById("title-label") as HTMLParagraphElement;
	private static readonly artistLabel = document.getElementById("artist-label") as HTMLParagraphElement;
	private static readonly assistiveSongLengthLabel = document.getElementById("assistive-song-length-label") as HTMLSpanElement;
	private static readonly topMessage = document.getElementById("top-message") as HTMLDivElement;
	private static readonly toggleViewButton = document.getElementById("toggle-view-button") as HTMLButtonElement;

	private static webFrame: WebFrame | null;

	private static currentTimeS: number;
	private static songLengthLabel: HTMLSpanElement;
	private static seekSlider: SliderControl;

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

		playlist.onsonglengthchange = AppUI.playlistSongLengthChange;

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
			const referenceLargeIconSizePX = Icon.baseSizePX / devicePixelRatio;
			let largeIconsInsideContents = (AppUI._contentsSizePX / referenceLargeIconSizePX) | 0;

			// We can try to increase button icons a little, by allowing them to overflow up to the limit
			// of 2px, because of the icons inside buttons with text, which have a 4px right margin
			const tempLargeIconsInsideContents = Math.ceil(AppUI._contentsSizePX / referenceLargeIconSizePX);
			if (((tempLargeIconsInsideContents * devicePixelRatio) - AppUI._contentsSizePX) <= 2)
				largeIconsInsideContents = tempLargeIconsInsideContents;

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
				--large-icon-margin: ${AppUI.adjustDecimal(Math.min(0, 0.5 * (AppUI._contentsSizePX - AppUI._largeIconSizePX)))}px;
				--large-icon-padding: ${AppUI.adjustDecimal(Math.max(0, 0.5 * (AppUI._contentsSizePX - AppUI._largeIconSizePX)))}px;
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
				default:
					if (e.target === document.body && !AppUI.panelContainerToggled && !Modal.visible) {
						switch (e.key) {
							case "ArrowDown":
							case "ArrowRight":
							case "ArrowUp":
							case "ArrowLeft":
							case "PageDown":
							case "PageUp":
							case "Home":
							case "End":
							case "Enter":
							case " ":
								cancelEvent(e);
								AppUI.playlistControl.element.focus();
								AppUI.playlistControl.elementKeyDown(e);
								return false;
						}
					}
					break;
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

		window.addEventListener("resize", AppUI.adjustCover);
		AppUI.adjustCover();

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

		AppUI.seekSlider = new SliderControl("seek-slider", Strings.Seek, null, SliderControlValueChild.None, false, false, 0, 1, 0, null, null, true);
		AppUI.seekSlider.disabled = true;
		AppUI.seekSlider.onvaluechange = AppUI.seekSliderValueChange;
		AppUI.seekSlider.ondragend = AppUI.seekSliderDragEnd;

		const currentTimeLabel = document.createElement("span");
		currentTimeLabel.className = "seek-label";
		AppUI.currentTimeS = 0;
		Strings.changeText(currentTimeLabel, Formatter.none);
		AppUI.seekSlider.leftChild = currentTimeLabel;

		AppUI.songLengthLabel = document.createElement("span");
		AppUI.songLengthLabel.className = "seek-label";
		Strings.changeText(AppUI.songLengthLabel, Formatter.none);
		Strings.changeText(AppUI.assistiveSongLengthLabel, Formatter.none);
		AppUI.seekSlider.rightChild = AppUI.songLengthLabel;

		AppUI.volumeSlider = new SliderControl("volume-slider", Strings.Volume, function (value) {
			return (value <= Player.minVolume ? GraphicalFilterEditorStrings.MinusInfinity : (value ? value : "-0")) + " dB";
		}, SliderControlValueChild.RightChild, true, false, Player.minVolume, 0, appSettings.playerVolume);
		AppUI.volumeSlider.leftChild = Icon.createLarge("icon-volume", "green small-right-margin");
		const volumeLabel = document.createElement("span");
		volumeLabel.className = "small-left-margin";
		volumeLabel.setAttribute("id", "volume-label");
		AppUI.volumeSlider.rightChild = volumeLabel;
		AppUI.volumeSlider.onvaluechange = AppUI.volumeSliderValueChange;

		AppUI.playlistControl = new ListControl("playlist-control", Strings.Playlist, true);
		AppUI.playlistControl.onitemclick = AppUI.playlistControlItemClick;
		AppUI.playlistControl.onitemcontextmenu = AppUI.playlistControlItemContextMenu;

		AppUI.graphicalFilterControlType = document.getElementById("graphical-filter-control-type") as HTMLButtonElement;
		ButtonControl.setText(AppUI.graphicalFilterControlType, appSettings.graphicalFilterControlSimpleMode ? Strings.TraditionalFilter : Strings.AdvancedFilter);
		AppUI.graphicalFilterControlType.onclick = AppUI.graphicalFilterControlTypeClick;

		AppUI.graphicalFilterControlEnabled = document.getElementById("graphical-filter-control-enabled") as HTMLInputElement;
		AppUI.graphicalFilterControlEnabled.checked = appSettings.graphicalFilterControlEnabled || false;
		AppUI.graphicalFilterControlEnabled.onclick = AppUI.graphicalFilterControlEnabledClick;

		AppUI.stereoPannerControlEnabled = document.getElementById("stereo-panner-control-enabled") as HTMLInputElement;
		AppUI.stereoPannerControlEnabled.checked = appSettings.stereoPannerControlEnabled || false;
		AppUI.stereoPannerControlEnabled.onclick = AppUI.stereoPannerControlEnabledClick;

		if (MonoDownMixerControl.isSupported()) {
			AppUI.monoDownMixerControlEnabled = document.getElementById("mono-down-mixer-control-enabled") as HTMLInputElement;
			AppUI.monoDownMixerControlEnabled.checked = appSettings.monoDownMixerControlEnabled || false;
			AppUI.monoDownMixerControlEnabled.onclick = AppUI.monoDownMixerControlEnabledClick;
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

			App.player.onsongchange = AppUI.playerSongChange;
			App.player.onloadingchange = AppUI.playerLoadingChange;
			App.player.onpausedchange = AppUI.playerPausedChange;
			App.player.oncurrenttimeschange = AppUI.playerCurrentTimeSChange;
			App.player.onerror = AppUI.playerError;

			AppUI.preparePlaylist();

			if (App.player.currentIndexResumeTimeS > 0 && App.player.playlist && App.player.playlist.currentItem) {
				AppUI.playerSongChange(App.player.playlist.currentItem);
				AppUI.playerCurrentTimeSChange(App.player.currentIndexResumeTimeS);
				App.player.refreshMediaSession(App.player.playlist.currentItem);
			} else {
				AppUI.playerSongChange(App.player.currentSong);
				App.player.refreshMediaSession(App.player.currentSong);
			}

			AppUI.centerCurrentSongIntoView();

			try {
				AppUI.playlistControl.element.focus();
			} catch (ex: any) {
				// Just ignore...
			}

			HistoryHandler.init(Menu.historyStatePopped, Modal.historyStatePopped, AppUI.historyStatePopped);

			AppUI.cover.classList.remove("in");
	
			DelayControl.delayShortCB(function () {
				AppUI.centerCurrentSongIntoView();
	
				DelayControl.delayFadeCB(function () {
					if (AppUI.cover)
						document.body.removeChild(AppUI.cover);
				});
			});
		}
	}

	private static adjustCover(): void {
		if (AppUI.cover) {
			const rect = document.body.getBoundingClientRect();
			AppUI.cover.style.transform = `scale(${Math.ceil(rect.right * 0.5)}, ${Math.ceil(rect.bottom * 0.5)})`;
		}
	}

	private static centerCurrentSongIntoView(): void {
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

	public static get playlistControlElement(): HTMLElement {
		return AppUI.playlistControl.element;
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

	private static playerSongChange(song: Song | null): void {
		if (!App.player || !AppUI.playlistControl)
			return;

		document.title = ((song && song.title) ? (song.title + " - FPlay") : "FPlay");

		Strings.changeText(AppUI.titleLabel, (song && song.title) || Formatter.none);

		Strings.changeText(AppUI.artistLabel, (song && song.artist) || Formatter.none);

		if (App.player.playlist && App.player.playlist.currentIndex >= 0 && !AppUI.playlistControl.deleteMode && song)
			AppUI.playlistControl.bringItemIntoView(App.player.playlist.currentIndex);

		AppUI.currentTimeS = 0;

		if (!song) {
			Strings.changeText(AppUI.songLengthLabel, Formatter.none);
			Strings.changeText(AppUI.assistiveSongLengthLabel, Formatter.none);

			if (AppUI.seekSlider) {
				AppUI.seekSlider.disabled = true;
				AppUI.seekSlider.manuallyChangeAll(0, Formatter.none, SliderControlValueChild.LeftChild);
			}
		} else {
			Strings.changeText(AppUI.songLengthLabel, song.length);
			Strings.changeText(AppUI.assistiveSongLengthLabel, song.length);

			if (AppUI.seekSlider) {
				AppUI.seekSlider.manuallyChangeAll(0, Formatter.zero, SliderControlValueChild.LeftChild);

				if (song.lengthMS > 0) {
					AppUI.seekSlider.disabled = false;
					AppUI.seekSlider.max = song.lengthMS;
				} else {
					AppUI.seekSlider.disabled = true;
				}
			}
		}
	}

	private static playerLoadingChange(loading: boolean): void {
		App.updateLoadingIcon();
	}

	private static playerPausedChange(paused: boolean): void {
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

	private static playerCurrentTimeSChange(currentTimeS: number): void {
		if (!AppUI.seekSlider || AppUI.seekSlider.dragging)
			return;

		const s = currentTimeS | 0;
		if (AppUI.currentTimeS !== s) {
			AppUI.currentTimeS = s;

			AppUI.seekSlider.manuallyChangeAll(currentTimeS * 1000, Formatter.formatTimeS(s), SliderControlValueChild.LeftChild);
		} else {
			AppUI.seekSlider.value = currentTimeS * 1000;
		}
	}

	private static playerError(message: string): void {
		Modal.show({
			text: message,
			returnFocusElement: AppUI.playlistControl.element
		});
	}

	private static playlistSongLengthChange(song: Song): void {
		if (!App.player)
			return;

		if (song === App.player.currentSong) {
			Strings.changeText(AppUI.songLengthLabel, song.length);
			Strings.changeText(AppUI.assistiveSongLengthLabel, song.length);

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

	private static seekSliderValueChange(value: number): void {
		if (!AppUI.seekSlider || !AppUI.seekSlider.dragging)
			return;

		const s = ((value / 1000) | 0);
		if (AppUI.currentTimeS !== s) {
			AppUI.currentTimeS = s;

			if (App.player && !App.player.currentSong)
				App.player.currentIndexResumeTimeS = s;

			AppUI.seekSlider.manuallyChangeAria(Formatter.formatTimeS(s), SliderControlValueChild.LeftChild);
		}
	}

	private static seekSliderDragEnd(value: number): void {
		if (!App.player || !App.player.currentSong)
			return;

		App.player.seekTo(value);
	}

	private static volumeSliderValueChange(value: number): void {
		if (App.player)
			App.player.volume = value;
	}

	private static playlistControlItemClick(item: Song, index: number, button: number): void {
		if (!App.player || button)
			return;

		App.player.play(index);
	}

	private static playlistControlItemContextMenu(item: Song, index: number): void {
		if (!App.player)
			return;

		//App.player.play(index);
	}

	private static graphicalFilterControlTypeClick(): void {
		if (!App.graphicalFilterControl)
			return;

		App.graphicalFilterControl.simpleMode = !App.graphicalFilterControl.simpleMode;
		ButtonControl.setText(AppUI.graphicalFilterControlType, App.graphicalFilterControl.simpleMode ? Strings.TraditionalFilter : Strings.AdvancedFilter);
	}

	private static graphicalFilterControlEnabledClick(): void {
		if (!App.graphicalFilterControl)
			return;

		App.graphicalFilterControl.enabled = AppUI.graphicalFilterControlEnabled.checked;
	}

	private static stereoPannerControlEnabledClick(): void {
		if (!App.stereoPannerControl)
			return;

		App.stereoPannerControl.enabled = AppUI.stereoPannerControlEnabled.checked;
	}

	private static monoDownMixerControlEnabledClick(): void {
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

		const electron = (App.hostType === App.hostTypeElectron);
		let filePaths: File[] | string[] | null,
			fileFetcher: (() => Promise<FilePickerQueueItem | null>) | null;

		if (FilePicker.isSupported()) {
			filePaths = null;
			fileFetcher = FilePicker.showAddPlay(AppUI.playlistControl.element);
		} else {
			filePaths = await App.showOpenDialogWeb(webDirectory);
			fileFetcher = null;
		}

		if ((!filePaths && !fileFetcher) || !App.player)
			return;

		try {
			if (!App.player.playlist) {
				App.player.playlist = new Playlist();
				AppUI.preparePlaylist();
			}

			const playlist = App.player.playlist,
				buffer = (electron ? null : new Uint8Array(BufferedFileHandle.minBufferLength << 1)),
				tempBuffer = (electron ? null : [new Uint8Array(256)]);

			let missingSongWasAdded = false;

			do {
				let playAfterAdding = false;

				if (fileFetcher) {
					const queueItem = await fileFetcher();
					if (!queueItem)
						break;

					playAfterAdding = queueItem.play;
					filePaths = queueItem.files;
				}

				if (!filePaths)
					break;

				AppUI._loading = true;
				App.updateLoadingIcon();

				for (let i = 0; i < filePaths.length && App.player; i++) {
					if (electron) {
						if (await playlist.addSong(filePaths[i] as string)) {
							if (playAfterAdding) {
								playAfterAdding = false;

								if (App.player)
									App.player.play(playlist.length - 1);
							}
						}
					} else {
						const oldLength = playlist.length;
						if (await playlist.addSongWeb(filePaths[i] as File, buffer, tempBuffer)) {
							if (oldLength == playlist.length) {
								missingSongWasAdded = true;
							} else if (playAfterAdding) {
								playAfterAdding = false;

								if (App.player)
									App.player.play(oldLength);
							}
						}
					}
				}

				AppUI._loading = false;
				App.updateLoadingIcon();
			} while (fileFetcher);

			if (missingSongWasAdded && AppUI.playlistControl)
				AppUI.playlistControl.refreshVisibleItems();
		} catch (ex: any) {
			Modal.show({
				text: "addFiles error: " + (ex.message || ex.toString()),
				returnFocusElement: AppUI.playlistControl.element
			});
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
		}

		try {
			AppUI.playlistControl.element.focus();
		} catch (ex: any) {
			// Just ignore...
		}
	}

	private static checkPanelContainerToggleState() {
		if (window.innerWidth <= 875 || !AppUI.fixedPanel || !AppUI.optionalPanel)
			return;

		if (AppUI.panelContainerToggling) {
			AppUI.panelContainerToggleVersion++;
			AppUI.panelContainerToggling = false;

			const parent = AppUI.cover.parentNode;
			if (parent)
				parent.removeChild(AppUI.cover);

			AppUI.cover.classList.remove("in");
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
				fadePanels = function (focusElement: HTMLElement, addToggledClass: boolean) {
					AppUI.panelContainerToggling = true;

					AppUI.cover.classList.remove("in");

					if (!AppUI.cover.parentNode)
						document.body.appendChild(AppUI.cover);

					DelayControl.delayShortCB(async function () {
						if (AppUI.panelContainerToggleVersion !== version)
							return;

						AppUI.cover.classList.add("in");

						await DelayControl.delayFade();

						if (AppUI.panelContainerToggleVersion !== version)
							return;

						if (addToggledClass)
							AppUI.panelContainer.classList.add("toggled");
						else
							AppUI.panelContainer.classList.remove("toggled");

						AppUI.cover.classList.remove("in");

						await DelayControl.delayFade();

						if (AppUI.panelContainerToggleVersion !== version)
							return;

						const parent = AppUI.cover.parentNode;
						if (parent)
							parent.removeChild(AppUI.cover);

						AppUI.panelContainerToggling = false;

						try {
							focusElement.focus();
						} catch (ex: any) {
							// Just ignore...
						}
					});
				};

			if (AppUI.panelContainerToggled) {
				AppUI.panelContainerToggled = false;

				fadePanels(AppUI.playlistControl.element, false);

				if (popStateIfLeaving)
					HistoryHandler.popState();
			} else {
				AppUI.panelContainerToggled = true;

				fadePanels(ButtonControl.getDefaultFocusElement(AppUI.toggleViewButton), true);

				HistoryHandler.pushState();
			}
		}
	}

	public static showAbout(): void {
		Modal.show({
			html: Strings.AboutHTML + ((App.player && App.player.audioContext) ? `
				<br/><br/>
				<small>
					Base latency: ${(App.player.audioContext.baseLatency || 0).toFixed(4)} s
					<br/>
					Output latency: ${(isNaN((App.player.audioContext as any).outputLatency) ? "-" : ((App.player.audioContext as any).outputLatency.toFixed(4) + ' s'))}
					<br/>
					Output sample rate: ${(isNaN(App.player.audioContext.sampleRate) ? "-" : App.player.audioContext.sampleRate)} Hz
					<br/>
					User agent: ${Strings.htmlEncode(navigator.userAgent)}
				</small>
			` : ''),
			title: Strings.About + " (v" + (window as any).CACHE_VERSION + ")",
			returnFocusElement: AppUI.playlistControl.element
		});
	}
}
