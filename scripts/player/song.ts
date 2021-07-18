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

interface SongInfo {
	id: number;
	url: string;
	isHttp: boolean;
	title: string;
	artist: string;
	album: string;
	track: number;
	lengthMS: number;
	year: number;
	length: string;
}

class Song extends ListItem implements SongInfo {
	public static isPathHttp(path: string): boolean {
		return (path.startsWith("http:") || path.startsWith("https:") || path.startsWith("icy:"));
	}

	public static deserialize(reader: DataReader): Song {
		// NEVER change this order! (changing will destroy existing playlists)
		reader.readUint8(); // version
		const song = new Song(reader.readString(), reader.readString(), reader.readString(), reader.readString(), reader.readInt16(), reader.readInt32(), reader.readInt16());
		reader.readInt32(); // flags
		return song;
	}

	public readonly url: string;
	public readonly isHttp: boolean;
	public readonly title: string;
	public readonly artist: string;
	public readonly album: string;
	public readonly track: number;
	public lengthMS: number;
	public readonly year: number;
	public length: string;

	public file?: File | null;

	constructor(urlOrMetadata: string | Metadata, title?: string | null, artist?: string | null, album?: string | null, track?: number | null, lengthMS?: number | null, year?: number | null) {
		super();

		if ((typeof urlOrMetadata) !== "string") {
			const songInfo = urlOrMetadata as Metadata;
			urlOrMetadata = songInfo.url;
			title = songInfo.title;
			artist = songInfo.artist;
			album = songInfo.album;
			track = songInfo.track;
			lengthMS = songInfo.lengthMS;
			year = songInfo.year;
			if (songInfo.file) {
				if (!urlOrMetadata)
					this.file = songInfo.file;
				if (!title) {
					const i = songInfo.file.name.lastIndexOf(".");
					title = ((i > 0) ? songInfo.file.name.substr(0, i) : songInfo.file.name);
				}
			}
		}

		this.url = urlOrMetadata as string;
		this.isHttp = Song.isPathHttp(this.url);

		if (!title) {
			// Extract file name from url/path
			urlOrMetadata = decodeURI(urlOrMetadata as string);
			let i = urlOrMetadata.lastIndexOf("/");
			title = ((i >= 0) ? urlOrMetadata.substr(i + 1) : urlOrMetadata);
			if (!this.isHttp) {
				i = title.lastIndexOf(".");
				if (i > 0)
					title = title.substr(0, i);
			}
		}

		this.title = (title || Formatter.none);
		this.artist = (artist || Formatter.none);
		this.album = (album || Formatter.none);
		this.track = ((track && track > 0) ? track : Formatter.noneInt);
		this.lengthMS = ((lengthMS && lengthMS > 0) ? lengthMS : Formatter.noneInt);
		this.year = ((year && year > 0) ? year : Formatter.noneInt);
		this.length = Formatter.formatTimeMS(this.lengthMS);
	}

	public estimateSerializedLength(): number {
		return (this.url.length +
			this.title.length +
			this.artist.length +
			this.album.length) << 1;
	}

	public serialize(writer: DataWriter): DataWriter {
		// NEVER change this order! (changing will destroy existing playlists)
		return writer.writeUint8(0) // version
			.writeString(this.url)
			.writeString(this.title)
			.writeString(this.artist)
			.writeString(this.album)
			.writeInt16(this.track)
			.writeInt32(this.lengthMS)
			.writeInt16(this.year)
			.writeInt32(0); // flags
	}

	public info(): SongInfo {
		return {
			id: this.id,
			url: this.url,
			isHttp: this.isHttp,
			title: this.title,
			artist: this.artist,
			album: this.album,
			track: this.track,
			lengthMS: this.lengthMS,
			year: this.year,
			length: this.length
		};
	}
}
