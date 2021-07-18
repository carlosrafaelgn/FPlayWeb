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
	private static readonly cachePrefix = "https://fplay.com.br/";
	private static readonly cacheNamePlaylists = "playlists";

	private static async cacheGet(cacheName: string, name?: string | null): Promise<ArrayBuffer | null> {
		const cache = await caches.open(cacheName);

		if (!name)
			name = InternalStorage.cachePrefix;
		else
			name = InternalStorage.cachePrefix + name;

		const response = await cache.match(name);

		return (response ? response.arrayBuffer() : null);
	}

	private static async cachePut(cacheName: string, name: string | null | undefined, response: Response): Promise<void> {
		const cache = await caches.open(cacheName);

		if (!name)
			name = InternalStorage.cachePrefix;
		else
			name = InternalStorage.cachePrefix + name;

		return cache.put(name, response);
	}

	public static loadAppSettings(): AppSettings {
		try {
			const s = localStorage.getItem("appSettings");
			if (s) {
				const appSettings = JSON.parse(s);
				if (appSettings)
					return appSettings;
			}
		} catch (ex) {
			// Just ignore...
		}
		return {
			playerVolume: 100,
			graphicalFilterControlEnabled: false
		};
	}

	public static saveAppSettings(appSettings: AppSettings | null): void {
		if (appSettings)
			localStorage.setItem("appSettings", JSON.stringify(appSettings));
		else
			localStorage.removeItem("appSettings");
	}

	public static loadGraphicalFilterEditorSettings(): GraphicalFilterEditorSettings {
		try {
			const s = localStorage.getItem("graphicalFilterEditorSettings");
			if (s) {
				const graphicalFilterEditorSettings = JSON.parse(s);
				if (graphicalFilterEditorSettings)
					return graphicalFilterEditorSettings;
			}
		} catch (ex) {
			// Just ignore...
		}
		return {
			currentChannelIndex: 0,
			editMode: GraphicalFilterEditorControl.editModeZones,
			isActualChannelCurveNeeded: true,
			isNormalized: false,
			isSameFilterLR: true,
			showZones: true
		};
	}

	public static saveGraphicalFilterEditorSettings(graphicalFilterEditorSettings: GraphicalFilterEditorSettings | null): void {
		if (graphicalFilterEditorSettings)
			localStorage.setItem("graphicalFilterEditorSettings", JSON.stringify(graphicalFilterEditorSettings));
		else
			localStorage.removeItem("graphicalFilterEditorSettings");
	}

	public static async loadPlaylist(name?: string | null): Promise<Playlist | null> {
		const arrayBuffer = await InternalStorage.cacheGet(InternalStorage.cacheNamePlaylists, name);

		if (!arrayBuffer)
			return null;

		try {
			return Playlist.deserialize(new DataReader(arrayBuffer));
		} catch (ex) {
			return null;
		}
	}

	public static async savePlaylist(playlist: Playlist, name?: string | null): Promise<void> {
		return InternalStorage.cachePut(InternalStorage.cacheNamePlaylists, name, new Response(playlist.serialize().trimmedArrayBuffer));
	}
}
