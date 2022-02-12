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

class PlaylistAdapter extends ListAdapter<Song> {
	public constructor(list: Playlist) {
		super(list);
	}

	public get itemHeight(): number {
		return AppUI.playlistItemSizePX;
	}

	public createEmptyElement(baseClass: string): HTMLElement {
		const div = document.createElement("div");
		div.className = baseClass + " playlist-item";

		div.appendChild(Icon.create("icon-title", "pink margin"));
		div.appendChild(document.createTextNode(Formatter.none));
		div.appendChild(document.createElement("br"));

		div.appendChild(Icon.create("icon-artist", "orange margin"));
		let span = document.createElement("span");
		Strings.changeText(span, Formatter.none);
		div.appendChild(span);
		div.appendChild(document.createElement("br"));

		span = document.createElement("span");
		span.className = "length";
		Strings.changeText(span, Formatter.none);
		div.appendChild(span);

		span = document.createElement("span");
		span.className = "float-right";
		Strings.changeText(span, Formatter.none);
		div.appendChild(span);

		return div;
	}

	public prepareElement(item: Song, index: number, length: number, element: HTMLElement): void {
		const childNodes = element.childNodes;
		(childNodes[1] as Text).nodeValue = item.title;
		(childNodes[4].firstChild as Text).nodeValue = item.artist;
		(childNodes[6].firstChild as Text).nodeValue = item.length;
		(childNodes[7].firstChild as Text).nodeValue = ((item.url || item.file) ? `${(index + 1)} / ${length}` : `(${Strings.Missing}) ${(index + 1)} / ${length}`);
	}

	public prepareElementIndexOrLengthChanged(item: Song, index: number, length: number, element: HTMLElement): void {
		(element.childNodes[7].firstChild as Text).nodeValue = ((item.url || item.file) ? `${(index + 1)} / ${length}` : `(${Strings.Missing}) ${(index + 1)} / ${length}`);
	}
}

class Playlist extends List<Song> {
	public static deserialize(reader: DataReader): Playlist {
		reader.readUint8(); // version

		const count = reader.readInt32(),
			currentIndex = reader.readInt32(),
			songs: Song[] = new Array(count);

		for (let i = 0; i < count; i++)
			songs[i] = Song.deserialize(reader);

		return new Playlist(songs, currentIndex);
	}

	public static deserializeWeb(json: string): Playlist | null {
		try {
			const tmp: any = JSON.parse(json);
			if (!tmp || !tmp.items || !tmp.items.length)
				return null;

			const items: any[] = tmp.items,
				count = items.length,
				songs: Song[] = new Array(count),
				missingSongs: Map<string, Song> = new Map();

			for (let i = 0; i < count; i++) {
				const song = new Song(items[i] as Metadata);
				songs[i] = song;
				if (!song.url && song.fileName)
					missingSongs.set(song.fileName + song.fileSize, song);
			}

			return new Playlist(songs, tmp.currentIndex || 0, missingSongs.size ? missingSongs : null);
		} catch (ex: any) {
			return null;
		}
	}

	private missingSongs: Map<string, Song> | null;

	public onsonglengthchanged: ((song: Song) => void) | null;

	public constructor(songs?: Song[] | null, currentIndex?: number, missingSongs?: Map<string, Song> | null) {
		super(songs, currentIndex);

		this.missingSongs = missingSongs || null;
		this.onsonglengthchanged = null;
	}

	public songLengthChanged(song: Song, lengthS: number): void {
		if (lengthS <= 0 || isNaN(lengthS) || !isFinite(lengthS)) {
			if (song.lengthMS < 0)
				return;

			lengthS = -1;
		} else {
			if (song.lengthMS >= 0 && ((song.lengthMS / 1000) | 0) === (lengthS | 0))
				return;

			lengthS = (lengthS * 1000) | 0;
		}

		this.modified = true;
		song.lengthMS = lengthS;
		song.length = Formatter.formatTimeMS(lengthS);

		if (this.onsonglengthchanged)
			this.onsonglengthchanged(song);
	}

	public clear(): void {
		if (this.missingSongs) {
			this.missingSongs.clear();
			this.missingSongs = null;
		}

		super.clear();
	}

	public changeItems(items: Song[] | null): void {
		if (this.missingSongs) {
			this.missingSongs.clear();
			this.missingSongs = null;
		}

		super.changeItems(items);
	}

	public removeItems(firstIndex: number, lastIndex?: number): number {
		if (this.missingSongs && this.items && firstIndex >= 0 && firstIndex < this.items.length) {
			const missingSongs = this.missingSongs,
				items = this.items;

			if (lastIndex === undefined || lastIndex >= items.length)
				lastIndex = items.length - 1;
			else if (lastIndex < firstIndex)
				lastIndex = firstIndex;

			for (let i = firstIndex; i <= lastIndex; i++) {
				const song = items[i];
				if (!song.url && !song.file && song.fileName) {
					missingSongs.delete(song.fileName + song.fileSize);

					if (!missingSongs.size) {
						this.missingSongs = null;
						break;
					}
				}
			}
		}

		return super.removeItems(firstIndex, lastIndex);
	}

	public async addSong(urlOrAbsolutePathOrFile: string | AppFile, position?: number): Promise<boolean> {
		let urlOrAbsolutePath: string,
			fileSize = 0;

		if ((typeof urlOrAbsolutePathOrFile) !== "string") {
			urlOrAbsolutePath = (urlOrAbsolutePathOrFile as AppFile).fileURL;
			fileSize = (urlOrAbsolutePathOrFile as AppFile).fileSize;
		} else {
			urlOrAbsolutePath = urlOrAbsolutePathOrFile as string;
		}

		if (!FileUtils.isTypeSupported(urlOrAbsolutePath))
			return false;

		const metadata = await App.extractMetadata(urlOrAbsolutePath, fileSize);

		if (!metadata)
			return false;

		super.addItem(new Song(metadata), position);

		return true;
	}

	public async addSongWeb(file: File, buffer?: Uint8Array | null, tempArray?: Uint8Array[] | null, position?: number): Promise<boolean> {
		if (!FileUtils.isTypeSupported(file.name))
			return false;

		if (this.missingSongs) {
			const key = file.name + file.size,
				song = this.missingSongs.get(key);

			if (song) {
				song.file = file;
				this.missingSongs.delete(key);

				if (!this.missingSongs.size)
					this.missingSongs = null;

				return true;
			}
		}

		const metadata = await MetadataExtractor.extract(file, buffer, tempArray);

		if (!metadata)
			return false;

		super.addItem(new Song(metadata), position);

		return true;
	}
}
