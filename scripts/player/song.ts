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
	url: string;
	flags: MetadataFlags;
	title: string;
	artist: string;
	album: string;
	track: number;
	lengthMS: number;
	year: number;
	sampleRate: number;
	channels: number;

	fileName: string | null;
	fileSize: number;
}

class Song implements SerializableListItem, SongInfo {
	private static _lastId = 0;

	public static isPathHttp(path: string): boolean {
		return (path.startsWith("http:") || path.startsWith("https:") || path.startsWith("icy:"));
	}

	public static deserialize(reader: DataReader): Song {
		// NEVER change this order! (changing will destroy existing playlists)
		reader.readUint8(); // version
		return new Song(reader.readString(), reader.readInt32(), reader.readString(), reader.readString(), reader.readString(), reader.readInt16(), reader.readInt32(), reader.readInt16(), reader.readInt32(), reader.readInt8(), reader.readString(), reader.readInt32());
	}

	public readonly id: number;
	public readonly url: string;
	public readonly flags: MetadataFlags;
	public readonly isHttp: boolean;
	public readonly title: string;
	public readonly artist: string;
	public readonly album: string;
	public readonly track: number;
	public lengthMS: number;
	public readonly year: number;
	public readonly sampleRate: number;
	public readonly channels: number;
	public length: string;

	public file?: File;
	public readonly fileName: string | null;
	public readonly fileSize: number;

	public constructor(urlOrMetadata: string | Metadata, flags?: MetadataFlags, title?: string | null, artist?: string | null, album?: string | null, track?: number, lengthMS?: number, year?: number, sampleRate?: number | null, channels?: number | null, fileName?: string | null, fileSize?: number) {
		if ((typeof urlOrMetadata) !== "string") {
			const metadata = urlOrMetadata as Metadata;
			urlOrMetadata = metadata.url;
			flags = metadata.flags;
			title = metadata.title;
			artist = metadata.artist;
			album = metadata.album;
			track = metadata.track;
			lengthMS = metadata.lengthMS;
			year = metadata.year;
			sampleRate = metadata.sampleRate;
			channels = metadata.channels;
			if (metadata.file) {
				if (!urlOrMetadata || urlOrMetadata.startsWith(FileUtils.localURLPrefix))
					this.file = metadata.file;
				if (!title) {
					const i = metadata.file.name.lastIndexOf(".");
					title = ((i > 0) ? metadata.file.name.substring(0, i) : metadata.file.name);
				}
			}
			fileName = metadata.fileName;
			fileSize = metadata.fileSize;
		}

		this.id = ++Song._lastId;
		this.url = urlOrMetadata as string;
		this.flags = flags || 0;
		this.isHttp = Song.isPathHttp(this.url);

		if (!title) {
			// Extract file name from url/path
			urlOrMetadata = decodeURI(urlOrMetadata as string);
			let i = urlOrMetadata.lastIndexOf("/");
			title = ((i >= 0) ? urlOrMetadata.substring(i + 1) : urlOrMetadata);
			if (!this.isHttp) {
				i = title.lastIndexOf(".");
				if (i > 0)
					title = title.substring(0, i);
			}
		}

		this.title = (title || Formatter.none);
		this.artist = (artist || Formatter.none);
		this.album = (album || Formatter.none);
		this.track = ((track && track > 0) ? track : Formatter.noneInt);
		this.lengthMS = ((lengthMS && lengthMS > 0) ? lengthMS : Formatter.noneInt);
		this.year = ((year && year > 0) ? year : Formatter.noneInt);
		this.sampleRate = ((sampleRate && sampleRate > 0) ? sampleRate : Formatter.noneInt);
		this.channels = ((channels && channels > 0) ? channels : Formatter.noneInt);
		this.length = Formatter.formatTimeMS(this.lengthMS);
		this.fileName = fileName || null;
		this.fileSize = fileSize || 0;
	}

	public get isSeekable(): boolean {
		return ((this.flags & MetadataFlags.Seekable) ? true : false);
	}

	public estimateSerializedLength(): number {
		return ((this.url.length +
			this.title.length +
			this.artist.length +
			this.album.length + 
			(this.fileName ? this.fileName.length : 0)) << 1) + 17;
	}

	public serialize(writer: DataWriter): DataWriter {
		// NEVER change this order! (changing will destroy existing playlists)
		return writer.writeUint8(0) // version
			.writeString(this.url)
			.writeInt32(this.flags)
			.writeString(this.title)
			.writeString(this.artist)
			.writeString(this.album)
			.writeInt16(this.track)
			.writeInt32(this.lengthMS)
			.writeInt16(this.year)
			.writeInt32(this.sampleRate)
			.writeInt8(this.channels)
			.writeString(this.fileName || null)
			.writeInt32(this.fileSize || 0);
	}

	public serializeWeb(): SongInfo {
		return {
			url: this.url,
			flags: this.flags,
			title: this.title,
			artist: this.artist,
			album: this.album,
			track: this.track,
			lengthMS: this.lengthMS,
			year: this.year,
			sampleRate: this.sampleRate,
			channels: this.channels,
			fileName: this.fileName,
			fileSize: this.fileSize
		};
	}
}
