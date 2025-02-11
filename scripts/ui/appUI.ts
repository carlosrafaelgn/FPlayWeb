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

	private static readonly _baseThinBorderPX = 1;
	private static readonly _baseThickBorderPX = 2;

	private static readonly _zoomHandlers: AppUIZoomHandler[] = [];

	private static readonly _rootVariables = document.getElementById("root-variables") as HTMLStyleElement;

	private static readonly _cover = document.getElementById("cover") as HTMLDivElement;
	private static readonly _panelContainer = document.getElementById("panel-container") as HTMLDivElement;
	private static _fixedPanel: HTMLDivElement;
	private static _middlePanel: HTMLDivElement;
	private static _optionalPanel: HTMLDivElement;

	private static _playButton: ButtonControl;
	private static _ruler: HTMLDivElement;
	private static _titleLabel: HTMLParagraphElement;
	private static _artistLabel: HTMLParagraphElement;
	private static _assistiveSongLengthLabel: HTMLSpanElement;
	private static _topMessage: HTMLDivElement;
	private static _toggleViewButton: ButtonControl;

	private static _webFrame: WebFrame | null;

	private static _currentTimeS: number;
	private static _songLengthLabel: HTMLSpanElement;
	private static _seekSlider: SliderControl;

	private static _volumeSlider: SliderControl;

	private static _playlistControl: ListControl<Song>;

	private static _graphicalFilterControlType: ButtonControl;
	private static _graphicalFilterControlEnabled: ButtonControl;
	private static _stereoPannerControlEnabled: ButtonControl;
	private static _monoDownMixerControlEnabled: ButtonControl;

	private static _loading = false;

	private static _devicePixelRatio = -1;
	private static _1remInPX = 1;
	private static _fontScale = 1;
	private static _smallIconSizePX = Icon.baseSizePX;
	private static _largeIconSizePX = Icon.baseSizePX << 1;
	private static _thinBorderPX = AppUI._baseThinBorderPX;
	private static _thickBorderPX = AppUI._baseThickBorderPX;
	private static _buttonSizePX = 1;
	private static _contentsSizePX = 1;
	private static _playlistItemSizePX = 1;
	private static _rgbMode = false;
	private static _animatedRGBMode = false;
	private static _extraRGBMode = false;
	private static _neonMode = false;

	private static _directoryCancelled = false;

	private static _topMessageFading = 0;
	private static _topMessageTimeout = 0;

	private static _focusBlocker: FocusBlocker | null = null;

	private static _panelContainerToggled = false;
	private static _panelContainerToggling = false;
	private static _panelContainerToggleVersion = 0;

	private static preparePlaylist(): void {
		if (!App.player || !AppUI._playlistControl)
			return;

		const playlist = App.player.playlist;
		if (!playlist) {
			AppUI._playlistControl.adapter = null;
			return;
		}

		playlist.onsonglengthchange = AppUI.playlistSongLengthChange;

		AppUI._playlistControl.adapter = new PlaylistAdapter(playlist);
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
		const _1remInPx = (App.hostInterface ? (AppUI.baseSizePX * (AppUI._fontScale = App.hostInterface.getFontScale())) : (AppUI._ruler.getBoundingClientRect().height * 0.125));

		if (AppUI._devicePixelRatio !== devicePixelRatio || AppUI._1remInPX !== _1remInPx) {
			AppUI._devicePixelRatio = devicePixelRatio;
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

			let i = ((AppUI._baseThinBorderPX * devicePixelRatio) | 0) / devicePixelRatio;
			if (!i)
				i = 1;
			const thinBorderPXStr = AppUI.adjustDecimal(i);
			AppUI._thinBorderPX = parseFloat(thinBorderPXStr);

			i = ((AppUI._baseThickBorderPX * devicePixelRatio) | 0) / devicePixelRatio;
			if (!i)
				i = 1;
			const thickBorderPXStr = AppUI.adjustDecimal(i);
			AppUI._thickBorderPX = parseFloat(thickBorderPXStr);

			const playlistItemSizePXStr = AppUI.adjustDecimal((3 * AppUI.remToPX(AppUI.smallContentsSizeREM)) + AppUI.s2PX);
			AppUI._playlistItemSizePX = parseFloat(playlistItemSizePXStr);

			AppUI._rootVariables.textContent = `:root {
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

			for (let i = AppUI._zoomHandlers.length - 1; i >= 0; i--)
				AppUI._zoomHandlers[i]();
		}

		AppUI.checkPanelContainerToggleState();
	}

	private static changeZoom(delta: number): void {
		if (!AppUI._webFrame)
			return;

		const factor = ((devicePixelRatio >= 1) ? (1 + Math.ceil(devicePixelRatio * 4)) :
			((devicePixelRatio <= 0.51) ? 0 :
				((devicePixelRatio <= 0.67) ? 1 :
					((devicePixelRatio <= 0.76) ? 2 :
						((devicePixelRatio <= 0.81) ? 3 :
							4))))) + delta;

		if (factor <= 0) {
			AppUI._webFrame.setZoomFactor(0.5);
		} else if (factor >= 21) {
			AppUI._webFrame.setZoomFactor(5);
		} else {
			switch (factor) {
				case 1:
					AppUI._webFrame.setZoomFactor(2 / 3);
					break;
				case 2:
					AppUI._webFrame.setZoomFactor(3 / 4);
					break;
				case 3:
					AppUI._webFrame.setZoomFactor(4 / 5);
					break;
				case 4:
					AppUI._webFrame.setZoomFactor(9 / 10);
					break;
				default:
					AppUI._webFrame.setZoomFactor((factor - 1) / 4);
					break;
			}
		}
	}

	private static globalKeyHandler(e: KeyboardEvent): any {
		if ((e.ctrlKey || e.metaKey)) {
			if (AppUI._webFrame) {
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
							if (AppUI._playlistControl && AppUI._playlistControl.deleteMode)
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
					if (e.target === document.body && !AppUI._panelContainerToggled && !Modal.visible) {
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
								AppUI._playlistControl.focus();
								AppUI._playlistControl.elementKeyDown(e);
								return false;
						}
					}
					break;
			}
		}
	}

	private static historyStatePopped(): boolean | null {
		if (!AppUI._playlistControl || !AppUI._playlistControl.deleteMode) {
			if (!AppUI._panelContainerToggled)
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

		AppUI._panelContainer.innerHTML = `
		<main id="fixed-panel">
			<header id="top-panel" class="toolbar bottom-border">
				<div aria-atomic="true" aria-live="polite">
					<p id="title-label">
						<f-icon color="pink" name="icon-title" large class="margin" sr-title="${Strings.TitleLabel}"></f-icon>-
					</p>
					<p id="artist-label">
						<f-icon color="orange" name="icon-artist" large class="margin" sr-title="${Strings.ArtistLabel}"></f-icon>-
					</p>
					<p class="sr-only">
						<span>${Strings.DurationLabel}</span><span id="assistive-song-length-label"></span>
					</p>
				</div>
				<div id="top-message" class="fade" aria-atomic="true" aria-live="assertive"></div>
			</header>

			<f-list id="playlist-control" aria-label="${Strings.Playlist}"></f-list>

			<div id="middle-panel" class="toolbar top-border">
				<f-button square class="toolbar-left hidden-normal" onclick="AppUI.toggleView(true)" text="${Strings.ShowEffects}" icon-name="icon-filter">
				</f-button><f-button square color="green" class="no-left-margin" onclick="AppUI.addFiles()" text="${Strings.AddSongs}" icon-name="icon-add-title">
				</f-button><f-button id="add-folder-button" square color="orange" onclick="AppUI.addFiles(true)" text="${Strings.AddFolders}" icon-name="icon-add-folder">
				</f-button><f-button id="info-button" square color="gray" onclick="AppUI.showSongInfo()" text="${Strings.ShowInfo}" icon-name="icon-info">
				</f-button><f-button square color="red" onclick="AppUI.toggleDeleteMode(true)" text="${Strings.DeleteSongs}" icon-name="icon-clear">
				</f-button><f-button square class="toolbar-right" onclick="AppUI.showAbout()" text="${Strings.Menu}" icon-name="icon-menu">
				</f-button>
			</div>

			<div id="bottom-panel" class="toolbar top-border">
				<f-slider id="seek-slider" aria-label="${Strings.Seek}" unfocusable manual-aria></f-slider>
				<div>
					<f-button square onclick="App.player && App.player.previous()" text="${Strings.Previous}" icon-name="icon-previous">
					</f-button><f-button id="play-button" square onclick="App.player && App.player.playPause()" text="${Strings.PlayPause}" icon-name="icon-play">
					</f-button><f-button square onclick="App.player && App.player.stop()" text="${Strings.Stop}" icon-name="icon-stop" id="button-stop">
					</f-button><f-button square onclick="App.player && App.player.next()" text="${Strings.Next}" icon-name="icon-next">
					</f-button><f-slider id="volume-slider" aria-label="${Strings.Volume}" min="${Player.minVolume}" max="0" value="${appSettings.playerVolume}" value-child="${SliderControlValueChild.RightChild}" class="left-margin"></f-slider>
				</div>
			</div>
		</main>

		<aside id="optional-panel" class="scrollable">
			<div id="optional-panel-container">
				<div class="toolbar bottom-border hidden-normal">
					<f-button id="toggle-view-button" onclick="AppUI.toggleView(true)" text="${Strings.ShowPlaylist}" icon-name="icon-playlist"></f-button>
				</div>

				<div class="toolbar">
					<f-button id="graphical-filter-control-enabled" checkable text="${Strings.Enabled}">
					</f-button><f-button id="graphical-filter-control-type" icon-name="icon-filter"></f-button>
				</div>

				<div id="filter-container" class="top-margin"></div>

				<div class="top-border">
					<f-button id="stereo-panner-control-enabled" checkable text="${Strings.Panning}" icon-name="icon-multiple-stop">
					</f-button><f-slider id="stereo-panner-slider" class="left-margin"></f-slider>
				</div>

				<div class="top-border" id="mono-down-mixer-control-container">
					<f-button id="mono-down-mixer-control-enabled" checkable text="${Strings.DownMixToMono}" icon-name="icon-call-merge-flipped"></f-button>
				</div>
			</div>
		</aside>
		`;

		AppUI._fixedPanel = document.getElementById("fixed-panel") as HTMLDivElement;
		AppUI._middlePanel = document.getElementById("middle-panel") as HTMLDivElement;
		AppUI._optionalPanel = document.getElementById("optional-panel") as HTMLDivElement;
		AppUI._playButton = document.getElementById("play-button") as ButtonControl;
		AppUI._ruler = document.getElementById("ruler") as HTMLDivElement;
		AppUI._titleLabel = document.getElementById("title-label") as HTMLParagraphElement;
		AppUI._artistLabel = document.getElementById("artist-label") as HTMLParagraphElement;
		AppUI._assistiveSongLengthLabel = document.getElementById("assistive-song-length-label") as HTMLSpanElement;
		AppUI._topMessage = document.getElementById("top-message") as HTMLDivElement;
		AppUI._toggleViewButton = document.getElementById("toggle-view-button") as ButtonControl;

		AppUI._webFrame = webFrame;

		window.addEventListener("keydown", AppUI.globalKeyHandler, true);

		if (webFrame && appSettings.devicePixelRatio && appSettings.devicePixelRatio !== devicePixelRatio)
			webFrame.setZoomFactor(appSettings.devicePixelRatio);

		if (FilePicker.isSupported()) {
			FilePicker.lastPath = appSettings.filePickerLastPath || null;
			FilePicker.lastRootLength = appSettings.filePickerRootLength || 0;

			const addFolderButton = document.getElementById("add-folder-button") as HTMLElement;
			(addFolderButton.parentNode as HTMLElement).removeChild(addFolderButton);
		}

		AppUI._seekSlider = document.getElementById("seek-slider") as SliderControl;
		AppUI._seekSlider.disabled = true;
		AppUI._seekSlider.onvaluechange = AppUI.seekSliderValueChange;
		AppUI._seekSlider.ondragchangecommit = AppUI.seekSliderDragChangeCommit;

		const currentTimeLabel = document.createElement("span");
		currentTimeLabel.className = "seek-label";
		AppUI._currentTimeS = 0;
		Strings.changeText(currentTimeLabel, Formatter.none);
		AppUI._seekSlider.leftChild = currentTimeLabel;

		AppUI._songLengthLabel = document.createElement("span");
		AppUI._songLengthLabel.className = "seek-label";
		Strings.changeText(AppUI._songLengthLabel, Formatter.none);
		Strings.changeText(AppUI._assistiveSongLengthLabel, Formatter.none);
		AppUI._seekSlider.rightChild = AppUI._songLengthLabel;

		AppUI._volumeSlider = document.getElementById("volume-slider") as SliderControl;
		AppUI._volumeSlider.mapper = function (value) {
			return (value <= Player.minVolume ? GraphicalFilterEditorStrings.MinusInfinity : (value ? value : "-0")) + " dB";
		};
		AppUI._volumeSlider.leftChild = Icon.create("icon-volume", "green", true, "small-right-margin");
		const volumeLabel = document.createElement("span");
		volumeLabel.className = "small-left-margin";
		volumeLabel.id = "volume-label";
		AppUI._volumeSlider.rightChild = volumeLabel;
		AppUI._volumeSlider.onvaluechange = AppUI.volumeSliderValueChange;

		AppUI._playlistControl = document.getElementById("playlist-control") as ListControl<Song>;
		AppUI._playlistControl.onitemclick = AppUI.playlistControlItemClick;
		AppUI._playlistControl.onitemcontextmenu = AppUI.playlistControlItemContextMenu;
		AppUI._playlistControl.onitemcontrolclick = AppUI.playlistControlItemControlClick;

		AppUI._graphicalFilterControlType = document.getElementById("graphical-filter-control-type") as ButtonControl;
		AppUI._graphicalFilterControlType.text = (appSettings.graphicalFilterControlSimpleMode ? Strings.TraditionalFilter : Strings.AdvancedFilter);
		AppUI._graphicalFilterControlType.onclick = AppUI.graphicalFilterControlTypeClick;

		AppUI._graphicalFilterControlEnabled = document.getElementById("graphical-filter-control-enabled") as ButtonControl;
		AppUI._graphicalFilterControlEnabled.checked = appSettings.graphicalFilterControlEnabled || false;
		AppUI._graphicalFilterControlEnabled.onclick = AppUI.graphicalFilterControlEnabledClick;

		AppUI._stereoPannerControlEnabled = document.getElementById("stereo-panner-control-enabled") as ButtonControl;
		AppUI._stereoPannerControlEnabled.checked = appSettings.stereoPannerControlEnabled || false;
		AppUI._stereoPannerControlEnabled.onclick = AppUI.stereoPannerControlEnabledClick;

		if (MonoDownMixerControl.isSupported()) {
			AppUI._monoDownMixerControlEnabled = document.getElementById("mono-down-mixer-control-enabled") as ButtonControl;
			AppUI._monoDownMixerControlEnabled.checked = appSettings.monoDownMixerControlEnabled || false;
			AppUI._monoDownMixerControlEnabled.onclick = AppUI.monoDownMixerControlEnabledClick;
		} else {
			const monoDownMixerControlContainer = document.getElementById("mono-down-mixer-control-container") as HTMLDivElement;
			(monoDownMixerControlContainer.parentNode as HTMLDivElement).removeChild(monoDownMixerControlContainer);
		}

		if (App.frameless)
			AppUI._panelContainer.classList.remove("web");

		window.addEventListener("resize", AppUI.adjustWindow, { passive: true });

		AppUI.rgbMode = appSettings.rgbMode || false;
		AppUI.animatedRGBMode = appSettings.animatedRGBMode || false;
		AppUI.extraRGBMode = appSettings.extraRGBMode || false;
		AppUI.neonMode = appSettings.neonMode || false;

		AppUI.adjustWindow();
	}

	public static init(appSettings: AppSettings): void {
		if (App.player) {
			AppUI._volumeSlider.value = App.player.volume;

			App.player.onsongchange = AppUI.playerSongChange;
			App.player.onloadingchange = AppUI.playerLoadingChange;
			App.player.onpausedchange = AppUI.playerPausedChange;
			App.player.oncurrenttimeschange = AppUI.playerCurrentTimeSChange;
			App.player.onerror = AppUI.playerError;

			AppUI.preparePlaylist();

			AppUI.playerSongChange(App.player.currentSong, App.player.currentTimeMS / 1000);

			AppUI.centerCurrentSongIntoView();

			try {
				AppUI._playlistControl.focus();
			} catch (ex: any) {
				// Just ignore...
			}

			HistoryHandler.init(Menu.historyStatePopped, Modal.historyStatePopped, AppUI.historyStatePopped);

			AppUI._cover.classList.remove("in");
	
			DelayControl.delayShortCB(function () {
				AppUI.centerCurrentSongIntoView();
	
				DelayControl.delayFadeCB(function () {
					if (AppUI._cover)
						document.body.removeChild(AppUI._cover);
				});
			});
		}
	}

	private static adjustCover(): void {
		if (AppUI._cover) {
			// Having a 1px x 1px black rectangle that is scaled by a large amount makes
			// an area of the rectangle transparent, like a regular scaling "artifact"
			// that appears when scaling regular images. Therefore, I decided to keep the
			// rectangle with a size of 2px x 2px, scaling it twice as needed, in order to
			// try to reduce this "artifact".
			const rect = document.body.getBoundingClientRect();
			AppUI._cover.style.transform = `scale(${rect.right}, ${rect.bottom})`;
		}
	}

	private static centerCurrentSongIntoView(): void {
		if (App.player && App.player.playlist && App.player.playlist.currentIndex >= 0)
			AppUI._playlistControl.centerItemIntoView(App.player.playlist.currentIndex);
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

	public static get playlistControlElement(): ListControl<Song> {
		return AppUI._playlistControl;
	}

	public static get rgbMode(): boolean {
		return AppUI._rgbMode;
	}

	public static set rgbMode(rgbMode: boolean) {
		if (AppUI._rgbMode === rgbMode)
			return;

		AppUI._rgbMode = rgbMode;

		if (!rgbMode) {
			AppUI._animatedRGBMode = false;
			AppUI._extraRGBMode = false;
			document.body.classList.remove("rgb");
			document.body.classList.remove("rgb-animated");
			document.body.classList.remove("rgb-extra");
		} else {
			document.body.classList.add("rgb");
		}
	}

	public static get animatedRGBMode(): boolean {
		return AppUI._animatedRGBMode;
	}

	public static set animatedRGBMode(animatedRGBMode: boolean) {
		if (AppUI._animatedRGBMode === animatedRGBMode)
			return;

		AppUI._animatedRGBMode = animatedRGBMode;

		if (!animatedRGBMode) {
			document.body.classList.remove("rgb-animated");
		} else {
			AppUI._rgbMode = true;
			document.body.classList.add("rgb");
			document.body.classList.add("rgb-animated");
		}
	}

	public static get extraRGBMode(): boolean {
		return AppUI._extraRGBMode;
	}

	public static set extraRGBMode(extraRGBMode: boolean) {
		if (AppUI._extraRGBMode === extraRGBMode)
			return;

		AppUI._extraRGBMode = extraRGBMode;

		if (!extraRGBMode) {
			document.body.classList.remove("rgb-extra");
		} else {
			AppUI._rgbMode = true;
			document.body.classList.add("rgb");
			document.body.classList.add("rgb-extra");
		}
	}

	public static get neonMode(): boolean {
		return AppUI._neonMode;
	}

	public static set neonMode(neonMode: boolean) {
		if (AppUI._neonMode === neonMode)
			return;

		AppUI._neonMode = neonMode;

		if (!neonMode)
			document.body.classList.remove("neon");
		else
			document.body.classList.add("neon");
	}

	public static addZoomHandler(zoomHandler: AppUIZoomHandler | null): void {
		if (zoomHandler)
			AppUI._zoomHandlers.push(zoomHandler);
	}

	public static removeZoomHandler(zoomHandler: AppUIZoomHandler | null): void {
		if (!zoomHandler)
			return;

		for (let i = AppUI._zoomHandlers.length - 1; i >= 0; i--) {
			if (AppUI._zoomHandlers[i] === zoomHandler) {
				AppUI._zoomHandlers.splice(i, 1);
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

	private static playerSongChange(song: Song | null, currentTimeS: number): void {
		if (!App.player || !AppUI._playlistControl)
			return;

		document.title = ((song && song.title) ? (song.title + " - FPlay") : "FPlay");

		Strings.changeText(AppUI._titleLabel, (song && song.title) || Formatter.none);

		Strings.changeText(AppUI._artistLabel, (song && song.artist) || Formatter.none);

		if (App.player.playlist && App.player.playlist.currentIndex >= 0 && !AppUI._playlistControl.deleteMode && song)
			AppUI._playlistControl.bringItemIntoView(App.player.playlist.currentIndex);

		if (currentTimeS < 0)
			currentTimeS = 0;
		AppUI._currentTimeS = currentTimeS | 0;

		if (!song) {
			Strings.changeText(AppUI._songLengthLabel, Formatter.none);
			Strings.changeText(AppUI._assistiveSongLengthLabel, Formatter.none);

			if (AppUI._seekSlider) {
				AppUI._seekSlider.disabled = true;
				AppUI._seekSlider.manuallyChangeAll(0, Formatter.none, SliderControlValueChild.LeftChild);
			}
		} else {
			Strings.changeText(AppUI._songLengthLabel, song.length);
			Strings.changeText(AppUI._assistiveSongLengthLabel, song.length);

			if (AppUI._seekSlider) {
				if (song.lengthMS > 0) {
					AppUI._seekSlider.disabled = false;
					AppUI._seekSlider.max = song.lengthMS;
				} else {
					AppUI._seekSlider.disabled = true;
				}

				AppUI._seekSlider.manuallyChangeAll(currentTimeS * 1000, Formatter.formatTimeS(AppUI._currentTimeS), SliderControlValueChild.LeftChild);
			}
		}
	}

	private static playerLoadingChange(loading: boolean): void {
		App.updateLoadingIcon();
	}

	private static playerPausedChange(paused: boolean): void {
		if (AppUI._playButton)
			AppUI._playButton.iconName = (paused ? "icon-play" : "icon-pause");
	}

	private static playerCurrentTimeSChange(currentTimeS: number): void {
		if (!AppUI._seekSlider || AppUI._seekSlider.dragging || !App.player)
			return;

		if (currentTimeS < 0)
			currentTimeS = 0;

		const s = currentTimeS | 0;
		if (AppUI._currentTimeS !== s) {
			AppUI._currentTimeS = s;

			const currentTimeMS = s * 1000;
			if (App.player.currentSong) {
				const delta = App.player.currentSong.lengthMS - currentTimeMS;
				if (delta < 5500 && delta > 2500)
					App.player.preloadNextSong();
			}

			AppUI._seekSlider.manuallyChangeAll(currentTimeMS, Formatter.formatTimeS(s), SliderControlValueChild.LeftChild);
		} else {
			AppUI._seekSlider.value = currentTimeS * 1000;
		}
	}

	private static playerError(message: string): void {
		Modal.show({
			text: message,
			returnFocusElement: AppUI._playlistControl
		});
	}

	private static playlistSongLengthChange(song: Song): void {
		if (!App.player)
			return;

		if (song === App.player.currentSong) {
			Strings.changeText(AppUI._songLengthLabel, song.length);
			Strings.changeText(AppUI._assistiveSongLengthLabel, song.length);

			if (AppUI._seekSlider) {
				if (song.lengthMS > 0) {
					AppUI._seekSlider.disabled = false;
					AppUI._seekSlider.max = song.lengthMS;
				} else {
					AppUI._seekSlider.value = 0;
					AppUI._seekSlider.disabled = true;
				}
			}
		}

		if (AppUI._playlistControl)
			AppUI._playlistControl.refreshVisibleItems();
	}

	private static seekSliderValueChange(value: number): void {
		if (!AppUI._seekSlider || !AppUI._seekSlider.dragging)
			return;

		const s = ((value / 1000) | 0);
		if (AppUI._currentTimeS !== s) {
			AppUI._currentTimeS = s;

			AppUI._seekSlider.manuallyChangeAria(Formatter.formatTimeS(s), SliderControlValueChild.LeftChild);
		}
	}

	private static seekSliderDragChangeCommit(value: number): void {
		if (!App.player)
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
		if (!App.player || !item || !AppUI._playlistControl || AppUI._playlistControl.deleteMode)
			return;

		AppUI.showSongInfo(item);
	}

	private static playlistControlItemControlClick(item: Song, index: number, button: number, target: HTMLElement): void {
		AppUI.playlistControlItemContextMenu(item, index);
	}

	private static graphicalFilterControlTypeClick(): void {
		if (!App.graphicalFilterControl)
			return;

		App.graphicalFilterControl.simpleMode = !App.graphicalFilterControl.simpleMode;
		AppUI._graphicalFilterControlType.text = (App.graphicalFilterControl.simpleMode ? Strings.TraditionalFilter : Strings.AdvancedFilter);
	}

	private static graphicalFilterControlEnabledClick(): void {
		if (!App.graphicalFilterControl)
			return;

		App.graphicalFilterControl.enabled = AppUI._graphicalFilterControlEnabled.checked;
	}

	private static stereoPannerControlEnabledClick(): void {
		if (!App.stereoPannerControl)
			return;

		App.stereoPannerControl.enabled = AppUI._stereoPannerControlEnabled.checked;
	}

	private static monoDownMixerControlEnabledClick(): void {
		if (!App.monoDownMixerControl)
			return;

		App.monoDownMixerControl.enabled = AppUI._monoDownMixerControlEnabled.checked;
	}

	public static hideTopMessage(): void {
		if (AppUI._topMessageFading < 0 || !AppUI._topMessage)
			return;

		if (AppUI._topMessageTimeout)
			clearTimeout(AppUI._topMessageTimeout);

		AppUI._topMessageFading = -1;

		AppUI._topMessage.classList.remove("in");

		AppUI._topMessageTimeout = DelayControl.delayFadeCB(function () {
			if (AppUI._topMessageFading >= 0)
				return;

			AppUI._topMessageFading = 0;
			AppUI._topMessageTimeout = 0;

			AppUI._topMessage.style.visibility = "";

			AppUI._topMessage.innerHTML = "";

			if (AppUI._titleLabel)
				AppUI._titleLabel.classList.remove("behind");

			if (AppUI._artistLabel)
				AppUI._artistLabel.classList.remove("behind");
		});
	}

	public static showTopMessage(html: string, createHandler?: (parent: HTMLDivElement) => void): void {
		if (!AppUI._topMessage)
			return;

		if (AppUI._topMessageTimeout)
			clearTimeout(AppUI._topMessageTimeout);

		AppUI._topMessageFading = 1;

		if (AppUI._titleLabel)
			AppUI._titleLabel.classList.add("behind");

		if (AppUI._artistLabel)
			AppUI._artistLabel.classList.add("behind");

		AppUI._topMessage.innerHTML = html;

		if (createHandler)
			createHandler(AppUI._topMessage);

		AppUI._topMessage.style.visibility = "visible";

		AppUI._topMessageTimeout = DelayControl.delayShortCB(function () {
			if (AppUI._topMessageFading <= 0 || AppUI._topMessageFading !== 1)
				return;

			AppUI._topMessageFading = 2;

			AppUI._topMessage.classList.add("in");

			AppUI._topMessageTimeout = DelayControl.delayFadeCB(function () {
				if (AppUI._topMessageFading !== 2)
					return;

				AppUI._topMessageFading = 0;
				AppUI._topMessageTimeout = 0;
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
			fileFetcher = FilePicker.showAddPlay(AppUI._playlistControl);
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
				buffer = (electron ? null : new Uint8Array(BufferedReader.minBufferLength)),
				tempBuffer = (electron ? null : [new Uint8Array(2048)]);

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

			if (missingSongWasAdded && AppUI._playlistControl)
				AppUI._playlistControl.refreshVisibleItems();
		} catch (ex: any) {
			Modal.show({
				text: "addFiles error: " + (ex.message || ex.toString()),
				returnFocusElement: AppUI._playlistControl
			});
		} finally {
			AppUI._loading = false;
			App.updateLoadingIcon();
		}
	}

	public static toggleDeleteMode(popStateIfLeaving: boolean): void {
		if (!AppUI._playlistControl)
			return;

		if (AppUI._focusBlocker) {
			AppUI._focusBlocker.unblock();
			AppUI._focusBlocker = null;
		}

		if (AppUI._playlistControl.deleteMode) {
			AppUI._playlistControl.deleteMode = false;

			AppUI.hideTopMessage();

			if (popStateIfLeaving)
				HistoryHandler.popState();
		} else {
			AppUI._playlistControl.deleteMode = true;

			AppUI._focusBlocker = new FocusBlocker();
			AppUI._focusBlocker.block(AppUI._middlePanel);

			AppUI.showTopMessage(Strings.DeleteModeHTML, function (parent) {
				const div = document.createElement("div");

				div.innerHTML = `
					<f-button color="red" onclick="
					if (App.player && App.player.playlist)
						App.player.playlist.clear();

					if (AppUI._playlistControl && AppUI._playlistControl.deleteMode)
						AppUI.toggleDeleteMode(true);
					" text="${Strings.DeleteAllSongs}" icon-name="icon-delete-all">
					</f-button><f-button color="green" onclick="
					if (AppUI._playlistControl && AppUI._playlistControl.deleteMode)
						AppUI.toggleDeleteMode(true);
					" text="${Strings.Done}" icon-name="icon-check">
					</f-button>
				`;

				parent.appendChild(div);
			});

			HistoryHandler.pushState();
		}

		try {
			AppUI._playlistControl.focus();
		} catch (ex: any) {
			// Just ignore...
		}
	}

	private static checkPanelContainerToggleState() {
		if (window.innerWidth <= 875 || !AppUI._fixedPanel || !AppUI._optionalPanel)
			return;

		if (AppUI._panelContainerToggling) {
			AppUI._panelContainerToggleVersion++;
			AppUI._panelContainerToggling = false;

			const parent = AppUI._cover.parentNode;
			if (parent)
				parent.removeChild(AppUI._cover);

			AppUI._cover.classList.remove("in");
		}

		if (AppUI._panelContainerToggled) {
			AppUI._panelContainerToggled = false;

			AppUI._panelContainer.classList.remove("toggled");

			HistoryHandler.popState();
		}
	}

	public static toggleView(popStateIfLeaving: boolean): void {
		if (AppUI._panelContainer) {
			AppUI._panelContainerToggleVersion++;

			const version = AppUI._panelContainerToggleVersion,
				fadePanels = function (focusElement: HTMLElement, addToggledClass: boolean) {
					AppUI._panelContainerToggling = true;

					AppUI._cover.classList.remove("in");

					if (!AppUI._cover.parentNode)
						document.body.appendChild(AppUI._cover);

					DelayControl.delayShortCB(async function () {
						if (AppUI._panelContainerToggleVersion !== version)
							return;

						AppUI._cover.classList.add("in");

						await DelayControl.delayFade();

						if (AppUI._panelContainerToggleVersion !== version)
							return;

						if (addToggledClass)
							AppUI._panelContainer.classList.add("toggled");
						else
							AppUI._panelContainer.classList.remove("toggled");

						AppUI._cover.classList.remove("in");

						await DelayControl.delayFade();

						if (AppUI._panelContainerToggleVersion !== version)
							return;

						const parent = AppUI._cover.parentNode;
						if (parent)
							parent.removeChild(AppUI._cover);

						AppUI._panelContainerToggling = false;

						try {
							focusElement.focus();
						} catch (ex: any) {
							// Just ignore...
						}
					});
				};

			if (AppUI._panelContainerToggled) {
				AppUI._panelContainerToggled = false;

				fadePanels(AppUI._playlistControl, false);

				if (popStateIfLeaving)
					HistoryHandler.popState();
			} else {
				AppUI._panelContainerToggled = true;

				fadePanels(AppUI._toggleViewButton.defaultFocusElement, true);

				HistoryHandler.pushState();
			}
		}
	}

	public static showSongInfo(song?: Song | null): void {
		if (!song)
			song = (App.player && App.player.currentSong);

		if (!song) {
			Alert.show(Strings.NoSongPlaying);
			return;
		}

		Modal.show({
			html: `<div class="selectable-text">
				<p><b>${Strings.Title}</b><br/>${Strings.htmlEncode(song.title)}</p>
				${(song.artist ? `<p><b>${Strings.Artist}</b><br/>${Strings.htmlEncode(song.artist)}</p>` : '')}
				${(song.album ? `<p><b>${Strings.Album}</b><br/>${Strings.htmlEncode(song.album)}</p>` : '')}
				<div class="top-margin" style="display: flex; flex-direction: row; justify-content: center;">
					<p class="no-top-margin"><b>${Strings.Track}</b><br/>${((song.track > 0) ? song.track : Formatter.none)}</p>
					<p class="no-top-margin large-left-margin"><b>${Strings.Year}</b><br/>${((song.year > 0) ? song.year : Formatter.none)}</p>
					<p class="no-top-margin large-left-margin"><b>${Strings.Duration}</b><br/>${((song.lengthMS > 0) ? song.length : Formatter.none)}</p>
				</div>
				<div class="top-margin" style="display: flex; flex-direction: row; justify-content: center;">
					<p class="no-top-margin"><b>${Strings.SampleRate}</b><br/>${((song.sampleRate > 0) ? (song.sampleRate + " Hz") : Formatter.none)}</p>
					<p class="no-top-margin large-left-margin"><b>${Strings.Channels}</b><br/>${((song.channels > 0) ? song.channels : Formatter.none)}</p>
				</div>
				${(song.url ? `<p class="top-margin"><b>${Strings.Path}</b><br/>${Strings.htmlEncode(song.url.startsWith(FileUtils.localURLPrefix) ? song.url.substring(FileUtils.localURLPrefix.length) : (song.url.startsWith(FileUtils.fileURLPrefix) ? decodeURI(song.url.substring(FileUtils.fileURLPrefix.length)) : song.url))}</p>` : '')}
			</div>`,
			title: Strings.SongInfo,
			returnFocusElement: AppUI._playlistControl
		});
	}

	public static showAbout(): void {
		const body = document.createElement("div");

		const updateRGBCheckboxes = function () {
			rgbModeCheckbox.checked = AppUI.rgbMode;
			animatedRGBModeCheckbox.checked = AppUI.animatedRGBMode;
			extraRGBModeCheckbox.checked = AppUI.extraRGBMode;
		};

		const rgbModeCheckbox = ButtonControl.create({
			text: Strings.RGBMode,
			checkable: true,
			checked: AppUI.rgbMode,
			parent: body,
			onclick: function () {
				AppUI.rgbMode = rgbModeCheckbox.checked;
				updateRGBCheckboxes();
			}
		});

		const animatedRGBModeCheckbox = ButtonControl.create({
			text: Strings.AnimatedRGBMode,
			checkable: true,
			checked: AppUI.animatedRGBMode,
			parent: body,
			onclick: function () {
				AppUI.animatedRGBMode = animatedRGBModeCheckbox.checked;
				updateRGBCheckboxes();
			}
		});

		const extraRGBModeCheckbox = ButtonControl.create({
			text: Strings.ExtraRGBMode,
			checkable: true,
			checked: AppUI.extraRGBMode,
			parent: body,
			onclick: function () {
				AppUI.extraRGBMode = extraRGBModeCheckbox.checked;
				updateRGBCheckboxes();
			}
		});

		const neonModeCheckbox = ButtonControl.create({
			text: Strings.NeonMode,
			checkable: true,
			checked: AppUI.neonMode,
			parent: body,
			onclick: function () {
				AppUI.neonMode = neonModeCheckbox.checked;
			}
		});

		body.insertAdjacentHTML("beforeend", `
			<h1 class="modal-header padding extra-large-top-margin extra-large-bottom-margin n-left-margin n-right-margin">
				${(Strings.About + " (v" + (window as any).CACHE_VERSION + ")")}
			</h1>
			${Strings.AboutHTML} ${((App.player && App.player.audioContext) ? `
			<p class="large-top-margin"><small>
				Base latency: ${(App.player.audioContext.baseLatency || 0).toFixed(4)} s
			</small></p><p class="small-top-margin"><small>
				Output latency: ${(isNaN((App.player.audioContext as any).outputLatency) ? "-" : ((App.player.audioContext as any).outputLatency.toFixed(4) + ' s'))}
			</small></p><p class="small-top-margin"><small>
				Output sample rate: ${(isNaN(App.player.audioContext.sampleRate) ? "-" : App.player.audioContext.sampleRate)} Hz
			</small></p><p class="small-top-margin"><small>
				User agent: ${Strings.htmlEncode(navigator.userAgent)}
			</small></p>
		` : '')}`);

		Modal.show({
			html: body,
			title: Strings.Options,
			returnFocusElement: AppUI._playlistControl,
			onhidden: function () {
				App.saveSettings(false);
			}
		});
	}
}
