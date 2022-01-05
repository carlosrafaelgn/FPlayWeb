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
		return AppUI.remToPX(14);
	}

	public createEmptyElement(baseClass: string): HTMLElement {
		const div = document.createElement("div");
		div.className = baseClass + " playlist-item";

		div.appendChild(Icon.create("icon-artist", "orange margin"));

		let span = document.createElement("span");
		Strings.changeText(span, Formatter.none);
		div.appendChild(span);

		div.appendChild(document.createElement("br"));
		div.appendChild(Icon.create("icon-title", "pink margin"));
		div.appendChild(document.createTextNode(Formatter.none));
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
		(element.childNodes[1].firstChild as Text).nodeValue = item.artist;
		(element.childNodes[4] as Text).nodeValue = item.title;
		(element.childNodes[6].firstChild as Text).nodeValue = item.length;
		(element.childNodes[7].firstChild as Text).nodeValue = ((item.url || item.file) ? `${(index + 1)} / ${length}` : `(${Strings.Missing}) ${(index + 1)} / ${length}`);
	}

	public prepareElementIndexOrLengthChanged(item: Song, index: number, length: number, element: HTMLElement): void {
		(element.childNodes[7].firstChild as Text).nodeValue = ((item.url || item.file) ? `${(index + 1)} / ${length}` : `(${Strings.Missing}) ${(index + 1)} / ${length}`);
	}
}

class Playlist extends List<Song> {
	private static readonly supportedExtensions: { [extension: string]: boolean } = {
		".aac": true,
		".mp3": true,
		".wav": true
	};

	public static readonly concatenatedSupportedExtensions = (() => {
		let c = "";
		for (let ext in Playlist.supportedExtensions)
			c = (c ? (c + "," + ext) : ext)
		return c;
	})();

	public static isTypeSupported(urlOrAbsolutePath: string): boolean {
		const i = urlOrAbsolutePath.lastIndexOf(".");
		if (i < 0)
			return false;

		const ext = urlOrAbsolutePath.substring(i);
		return (Playlist.supportedExtensions[ext] || Playlist.supportedExtensions[ext.toLowerCase()] || false);
	}

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
				songs: Song[] = new Array(count);

			for (let i = 0; i < count; i++)
				songs[i] = new Song(items[i] as Metadata);

			return new Playlist(songs, tmp.currentIndex || 0, songs.slice());
		} catch (ex: any) {
			return null;
		}
	}

	private missingSongs: Song[] | null;

	public onsonglengthchanged: ((song: Song) => void) | null;

	public constructor(songs?: Song[] | null, currentIndex?: number, missingSongs?: Song[] | null) {
		super(songs, currentIndex);

		this.missingSongs = missingSongs || null;
		this.onsonglengthchanged = null;
	}

	public estimateSerializedLength(): number {
		const songs = this.items;
		let total = 0;

		for (let i = songs.length - 1; i >= 0; i--)
			total += songs[i].estimateSerializedLength();

		return total + 128;
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

	public async addSong(urlOrAbsolutePathOrFile: string | AppFile, position?: number): Promise<boolean> {
		let urlOrAbsolutePath: string,
			fileSize = 0;

		if ((typeof urlOrAbsolutePathOrFile) !== "string") {
			urlOrAbsolutePath = (urlOrAbsolutePathOrFile as AppFile).fileURL;
			fileSize = (urlOrAbsolutePathOrFile as AppFile).fileSize;
		} else {
			urlOrAbsolutePath = urlOrAbsolutePathOrFile as string;
		}

		if (!Playlist.isTypeSupported(urlOrAbsolutePath))
			return false;

		const metadata = await App.extractMetadata(urlOrAbsolutePath, fileSize);

		if (!metadata)
			return false;

		super.addItem(new Song(metadata), position);

		return true;
	}

	public async addSongWeb(file: File, buffer?: Uint8Array | null, tempArray?: Uint8Array[] | null, position?: number): Promise<boolean> {
		if (!Playlist.isTypeSupported(file.name))
			return false;

		if (this.missingSongs) {
			const missingSongs = this.missingSongs,
				count = missingSongs.length;
			for (let i = 0; i < count; i++) {
				const missingSong = missingSongs[i];
				if (missingSong.fileName === file.name && missingSong.fileSize === file.size) {
					missingSong.file = file;
					missingSongs.splice(i, 1);
					if (!missingSongs.length)
						this.missingSongs = null;
					return true;
				}
			}
		}

		const metadata = await MetadataExtractor.extract(file, buffer, tempArray);

		if (!metadata)
			return false;

		super.addItem(new Song(metadata), position);

		return true;
	}
}
