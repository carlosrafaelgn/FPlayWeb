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

		const row1 = document.createElement("span");
		row1.className = "playlist-item-row1";
		row1.appendChild(Icon.create("icon-title", "playlist-item-icon pink margin", null, Strings.TitleLabel));
		row1.appendChild(document.createTextNode(Formatter.none));
		div.appendChild(row1);

		const srow1 = document.createElement("span");
		srow1.className = "playlist-item-s-row1";
		srow1.appendChild(Strings.createSrOnlyText(Strings.DurationLabel));
		srow1.appendChild(document.createTextNode(Formatter.none));
		div.appendChild(srow1);

		const row2 = document.createElement("span");
		row2.className = "playlist-item-row2";
		row2.appendChild(Icon.create("icon-artist", "playlist-item-icon orange margin", null, Strings.ArtistLabel));
		row2.appendChild(document.createTextNode(Formatter.none));
		div.appendChild(row2);

		const row3 = document.createElement("span");
		row3.className = "playlist-item-row3";
		row3.appendChild(Icon.create("icon-album", "playlist-item-icon green margin", null, Strings.AlbumLabel));
		row3.appendChild(document.createTextNode(Formatter.none));
		div.appendChild(row3);

		const srow3 = document.createElement("span");
		srow3.className = "playlist-item-s-row3";
		srow3.setAttribute("aria-hidden", "true");
		srow3.appendChild(document.createTextNode(Formatter.none));
		div.appendChild(srow3);

		return div;
	}

	public prepareElement(item: Song, index: number, length: number, element: HTMLElement): void {
		const childNodes = element.childNodes;
		(childNodes[0].childNodes[1] as Text).nodeValue = item.title;
		(childNodes[1].childNodes[1] as Text).nodeValue = item.length;
		(childNodes[2].childNodes[1] as Text).nodeValue = item.artist;
		(childNodes[3].childNodes[1] as Text).nodeValue = item.album;
		(childNodes[4].firstChild as Text).nodeValue = ((item.url || item.file) ? `${(index + 1)} / ${length}` : `(${Strings.Missing}) ${(index + 1)} / ${length}`);
	}

	public prepareElementIndexOrLengthChanged(item: Song, index: number, length: number, element: HTMLElement): void {
		(element.childNodes[8].firstChild as Text).nodeValue = ((item.url || item.file) ? `${(index + 1)} / ${length}` : `(${Strings.Missing}) ${(index + 1)} / ${length}`);
	}
}

class Playlist extends List<Song> {
	public static deserialize(reader: DataReader): Playlist {
		reader.readUint8(); // version

		const count = reader.readInt32(),
			currentIndex = reader.readInt32(),
			currentIndexResumeTimeS = reader.readInt32(),
			songs: Song[] = new Array(count);

		for (let i = 0; i < count; i++)
			songs[i] = Song.deserialize(reader);

		return new Playlist(songs, currentIndex, currentIndexResumeTimeS);
	}

	public static deserializeWeb(json: string): Playlist | null {
		try {
			const tmp = JSON.parse(json);
			if (!tmp || !tmp.items || !Array.isArray(tmp.items))
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

			return new Playlist(songs, tmp.currentIndex || 0, tmp.currentIndexResumeTimeS || 0, missingSongs.size ? missingSongs : null);
		} catch (ex: any) {
			return null;
		}
	}

	private missingSongs: Map<string, Song> | null;
	private _currentIndexResumeTimeS: number;

	public onsonglengthchange: ((song: Song) => void) | null;

	public constructor(songs?: Song[] | null, currentIndex?: number, currentIndexResumeTimeS?: number, missingSongs?: Map<string, Song> | null) {
		super(songs, currentIndex);

		this._currentIndexResumeTimeS = currentIndexResumeTimeS || 0;
		this.missingSongs = missingSongs || null;
		this.onsonglengthchange = null;
	}

	public get currentIndexResumeTimeS(): number {
		return this._currentIndexResumeTimeS;
	}

	public set currentIndexResumeTimeS(currentIndexResumeTimeS: number) {
		if (!this.currentItem || !currentIndexResumeTimeS || currentIndexResumeTimeS < 0)
			currentIndexResumeTimeS = 0;

		if (this._currentIndexResumeTimeS === currentIndexResumeTimeS)
			return;

		this.modified = true;
		this._currentIndexResumeTimeS = currentIndexResumeTimeS;
	}

	protected serializeExtraProperties(writer: DataWriter, count: number): DataWriter {
		writer.writeInt32(count ? this._currentIndexResumeTimeS : 0);
		return writer;
	}

	protected serializeExtraPropertiesWeb(serializedObject: any): any {
		serializedObject.currentIndexResumeTimeS = this._currentIndexResumeTimeS;
		return serializedObject;
	}

	public updateSongLength(song: Song, lengthS: number): void {
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

		if (this.onsonglengthchange)
			this.onsonglengthchange(song);
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
