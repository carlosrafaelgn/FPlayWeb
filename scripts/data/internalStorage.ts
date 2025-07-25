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

class InternalStorage {
	// We avoid overwriting settings/playlists throughout this class if they have
	// not changed, to try to spare the flash memory in devices that use them

	private static readonly _playlistCachePrefix = "https://fplay.com.br/";
	private static readonly _playlistCacheName = "playlists";

	private static readonly _appSettingsName = "appSettings";
	private static readonly _graphicalFilterEditorSettingsName = "graphicalFilterEditorSettings";
	private static readonly _stereoPannerSettingsName = "stereoPannerSettings";
	private static readonly _defaultPlaylistName = "defaultPlaylist";

	private static async cacheGet(cacheName: string, name?: string | null): Promise<ArrayBuffer | null> {
		const cache = await caches.open(cacheName);

		if (!name)
			name = InternalStorage._playlistCachePrefix;
		else
			name = InternalStorage._playlistCachePrefix + name;

		const response = await cache.match(name);

		return (response ? response.arrayBuffer() : null);
	}

	private static async cachePut(cacheName: string, name: string | null | undefined, response: Response): Promise<void> {
		const cache = await caches.open(cacheName);

		if (!name)
			name = InternalStorage._playlistCachePrefix;
		else
			name = InternalStorage._playlistCachePrefix + name;

		return cache.put(name, response);
	}

	public static loadAppSettings(): AppSettings {
		try {
			const s = localStorage.getItem(InternalStorage._appSettingsName);
			if (s) {
				const appSettings = JSON.parse(s);
				if (appSettings)
					return appSettings;
			}
		} catch (ex: any) {
			// Just ignore...
		}
		return {
			playerVolume: 0,
			graphicalFilterControlEnabled: false,
			graphicalFilterControlSimpleMode: (window.innerWidth < (512 + 32)),
			stereoPannerControlEnabled: false,
			monoDownMixerControlEnabled: false
		};
	}

	public static saveAppSettings(appSettings: AppSettings | null): void {
		const oldSettings = localStorage.getItem(InternalStorage._appSettingsName);

		if (appSettings) {
			const newSettings = JSON.stringify(appSettings);

			if (oldSettings !== newSettings)
				localStorage.setItem(InternalStorage._appSettingsName, newSettings);
		} else if (oldSettings) {
			localStorage.removeItem(InternalStorage._appSettingsName);
		}
	}

	public static loadGraphicalFilterEditorSettings(): GraphicalFilterEditorSettings {
		try {
			const s = localStorage.getItem(InternalStorage._graphicalFilterEditorSettingsName);
			if (s) {
				const graphicalFilterEditorSettings = JSON.parse(s);
				if (graphicalFilterEditorSettings)
					return graphicalFilterEditorSettings;
			}
		} catch (ex: any) {
			// Just ignore...
		}
		return {
			currentChannelIndex: 0,
			editMode: GraphicalFilterEditorControl.editModeShelfEq,
			isActualChannelCurveNeeded: true,
			isNormalized: false,
			isSameFilterLR: true,
			showZones: true
		};
	}

	public static saveGraphicalFilterEditorSettings(graphicalFilterEditorSettings: GraphicalFilterEditorSettings | null): void {
		const oldSettings = localStorage.getItem(InternalStorage._graphicalFilterEditorSettingsName);

		if (graphicalFilterEditorSettings) {
			const newSettings = JSON.stringify(graphicalFilterEditorSettings);

			if (oldSettings !== newSettings)
				localStorage.setItem(InternalStorage._graphicalFilterEditorSettingsName, newSettings);
		} else if (oldSettings) {
			localStorage.removeItem(InternalStorage._graphicalFilterEditorSettingsName);
		}
	}

	public static loadStereoPannerSettings(): number {
		return Math.max(-StereoPannerControl.maxAbsoluteValue, Math.min(StereoPannerControl.maxAbsoluteValue, parseInt(localStorage.getItem(InternalStorage._stereoPannerSettingsName) as string) | 0));
	}

	public static saveStereoPannerSettings(pan: number): void {
		const oldSettings = localStorage.getItem(InternalStorage._stereoPannerSettingsName),
			newSettings = (pan | 0).toString();

		if (oldSettings !== newSettings)
			localStorage.setItem(InternalStorage._stereoPannerSettingsName, newSettings);
	}

	public static async loadPlaylist(name?: string | null): Promise<Playlist | null> {
		const arrayBuffer = await InternalStorage.cacheGet(InternalStorage._playlistCacheName, name);

		if (!arrayBuffer)
			return null;

		try {
			return Playlist.deserialize(new DataReader(arrayBuffer));
		} catch (ex: any) {
			return null;
		}
	}

	public static loadPlaylistWeb(name?: string | null): Playlist | null {
		const json = localStorage.getItem(name || InternalStorage._defaultPlaylistName);

		return (json ? Playlist.deserializeWeb(json) : null);
	}

	public static savePlaylist(playlist: Playlist, name?: string | null): Promise<void> {
		// Treat the default playlist differently
		if (!name) {
			if (!playlist.modified)
				return Promise.resolve();
			playlist.modified = false;
		}

		return InternalStorage.cachePut(InternalStorage._playlistCacheName, name, new Response(playlist.serialize().trimmedArrayBuffer));
	}

	public static savePlaylistWeb(playlist: Playlist, name?: string | null): void {
		// Treat the default playlist differently
		if (!name) {
			if (!playlist.modified)
				return;
			playlist.modified = false;
		}

		return localStorage.setItem(name || InternalStorage._defaultPlaylistName, JSON.stringify(playlist.serializeWeb()));
	}
}
