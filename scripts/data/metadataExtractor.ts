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

enum MetadataFlags {
	Seekable = 1
};

interface Metadata {
	url: string;
	flags: MetadataFlags;
	title?: string | null;
	artist?: string | null;
	album?: string | null;
	track?: number;
	lengthMS?: number;
	year?: number;

	file?: File;
	fileName?: string;
	fileSize?: number;
}

class BufferedFileHandle {
	public static readonly minBufferLength = 32768;

	private readonly file: File;
	public readonly fileLength: number;

	private readonly buffer: Uint8Array;
	private position: number;
	private bufferPosition: number;
	private _bufferAvailable: number;
	private _eof: boolean;

	public get bufferAvailable(): number {
		return this._bufferAvailable;
	}

	public get eof(): boolean {
		return this._eof;
	}

	public constructor(file: File, buffer: Uint8Array) {
		if (buffer.length < BufferedFileHandle.minBufferLength)
			throw new Error("Buffer length too small: " + buffer.length);
		this.file = file;
		this.fileLength = file.size;
		this.buffer = buffer;
		this.position = 0;
		this.bufferPosition = 0;
		this._bufferAvailable = 0;
		this._eof = false;
	}

	public seekTo(position: number): void {
		if (position < 0)
			throw new Error("Invalid position");

		this.bufferPosition = 0;
		this._bufferAvailable = 0;

		if (position >= this.fileLength) {
			this.position = this.fileLength;
			this._eof = true;
		} else {
			this.position = position;
			this._eof = false;
		}
	}

	public skip(bytes: number): void {
		if (bytes <= 0)
			return;

		if (bytes >= this._bufferAvailable) {
			bytes -= this._bufferAvailable;

			this.position += bytes;

			if (this.position >= this.fileLength) {
				this.position = this.fileLength;
				this._eof = true;
			}

			this.bufferPosition = 0;
			this._bufferAvailable = 0;
		} else {
			this.bufferPosition += bytes;
			this._bufferAvailable -= bytes;
		}
	}

	public fillBuffer(length: number): Promise<void> | null {
		if (length <= 0)
			length = this.buffer.length;
		else if (length < 0 || length > this.buffer.length)
			throw new Error("Invalid length");

		const avail = this._bufferAvailable;
		if (length <= avail || this._eof)
			return null;

		length = this.buffer.length;

		if (avail && this.bufferPosition) {
			this.buffer.copyWithin(0, this.bufferPosition, this.bufferPosition + avail);
			this.bufferPosition = 0;
		}

		length -= avail;

		return new Promise((resolve, reject) => {
			this.file.slice(this.position, this.position + length).arrayBuffer().then((value) => {
				if (!value.byteLength) {
					this._eof = true;
				} else {
					this.position += value.byteLength;
					if (this.position >= this.fileLength) {
						this.position = this.fileLength;
						this._eof = true;
					}

					this._bufferAvailable += value.byteLength;
				}

				this.buffer.set(new Uint8Array(value), avail);

				resolve();
			}, reject);
		});
	}

	public readByte(): number {
		if (!this._bufferAvailable)
			return -1;

		this._bufferAvailable--;
		return this.buffer[this.bufferPosition++];
	}

	public readUInt32BE(): number | null {
		if (this._bufferAvailable < 4)
			return null;

		this._bufferAvailable -= 4;
		return ((this.buffer[this.bufferPosition++] << 24) |
			(this.buffer[this.bufferPosition++] << 16) |
			(this.buffer[this.bufferPosition++] << 8) |
			this.buffer[this.bufferPosition++]);
	}

	public readUInt32LE(): number | null {
		if (this._bufferAvailable < 4)
			return null;

		this._bufferAvailable -= 4;
		return (this.buffer[this.bufferPosition++] |
			(this.buffer[this.bufferPosition++] << 8) |
			(this.buffer[this.bufferPosition++] << 16) |
			(this.buffer[this.bufferPosition++] << 24));
	}

	public readUInt16BE(): number | null {
		if (this._bufferAvailable < 2)
			return null;

		this._bufferAvailable -= 2;
		return ((this.buffer[this.bufferPosition++] << 8) |
			this.buffer[this.bufferPosition++]);
	}

	public readUInt16LE(): number | null {
		if (this._bufferAvailable < 2)
			return null;

		this._bufferAvailable -= 2;
		return (this.buffer[this.bufferPosition++] |
			(this.buffer[this.bufferPosition++] << 8));
	}

	public read(buffer: Uint8Array, offset: number, length: number): Promise<number> | number {
		if (length < 0)
			throw new Error("Invalid length");

		const avail = this._bufferAvailable;

		if (length <= avail) {
			buffer.set(this.buffer.subarray(this.bufferPosition, this.bufferPosition += length), offset);
			this._bufferAvailable -= length;
			if (!this._bufferAvailable)
				this.bufferPosition = 0;
			return length;
		}

		let totalRead = 0;

		if (avail) {
			buffer.set(this.buffer.subarray(this.bufferPosition, this.bufferPosition + avail), offset);
			totalRead += avail;
			offset += avail;
			length -= avail;
			this.bufferPosition = 0;
			this._bufferAvailable = 0;
		}

		if (this._eof)
			return totalRead;

		return new Promise((resolve, reject) => {
			this.file.slice(this.position, this.position + length).arrayBuffer().then((value) => {
				if (!value.byteLength) {
					this._eof = true;
				} else {
					this.position += value.byteLength;
					if (this.position >= this.fileLength) {
						this.position = this.fileLength;
						this._eof = true;
					}
				}

				buffer.set(new Uint8Array(value), offset);

				resolve(value.byteLength + totalRead);
			}, reject);
		});
	}
}

class MetadataExtractor {
	private static readonly ALL_B = 0x3f;
	private static readonly ALL_BUT_LENGTH_B = 0x1f;
	private static readonly TITLE_B = 0x01;
	private static readonly ARTIST_B = 0x02;
	private static readonly ALBUM_B = 0x04;
	private static readonly TRACK_B = 0x08;
	private static readonly YEAR_B = 0x10;
	private static readonly LENGTH_B = 0x20;

	private static readonly textDecoderIso88591 = new TextDecoder("iso-8859-1");
	private static readonly textDecoderUtf16 = new TextDecoder("utf-16");
	private static readonly textDecoderUtf16be = new TextDecoder("utf-16be");
	private static readonly textDecoderUtf8 = new TextDecoder("utf-8");

	private static async extractRIFF(metadata: Metadata, f: BufferedFileHandle, tmp: Uint8Array): Promise<[Metadata, boolean] | null> {
		// When entering extractRIFF() the first four bytes have already been consumed
		if (f.fileLength < 44)
			return null;

		const riffLength = f.readUInt32LE();
		if (riffLength === null)
			return null;
		if (f.fileLength < (8 + riffLength))
			return null;

		let bytesLeftInFile = riffLength, fmtOk = false, dataOk = false, id3Position = 0, dataLength = 0, avgBytesPerSec = 0;

		_mainLoop:
		while (bytesLeftInFile > 0) {
			let isWave = false, bytesLeftInChunk = 0, tmpChunkLength: number | null, p: Promise<void> | null;

			switch (f.readUInt32BE()) {
				case null:
					break _mainLoop;

				case 0x57415645: // WAVE
					isWave = true;
					bytesLeftInFile -= 4;
					break;

				case 0x4c495354: // LIST
					tmpChunkLength = f.readUInt32LE();
					if (tmpChunkLength === null)
						break _mainLoop;

					bytesLeftInFile -= 8;
					bytesLeftInChunk = tmpChunkLength;

					if (bytesLeftInChunk < 0 || bytesLeftInChunk > bytesLeftInFile)
						break _mainLoop;
					break;

				case 0x69643320: // id3
					tmpChunkLength = f.readUInt32LE();
					if (tmpChunkLength === null)
						break _mainLoop;

					bytesLeftInFile -= 8;

					if (tmpChunkLength < 0 || tmpChunkLength > bytesLeftInFile)
						break _mainLoop;

					p = f.fillBuffer(1024);
					if (p)
						await p;

					if (tmpChunkLength > 4) {
						const b0 = f.readByte(),
							b1 = f.readByte(),
							b2 = f.readByte();

						if (b0 === null || b1 === null || b2 === null)
							break _mainLoop;

						bytesLeftInFile -= 3;
						tmpChunkLength -= 3;

						if (b0 === 0x49 || b1 === 0x44 || b2 === 0x33) {
							id3Position = f.fileLength - bytesLeftInFile;
							if (fmtOk && dataOk) {
								id3Position = -1;
								break _mainLoop;
							} else {
							}
						}
					}

					f.skip(tmpChunkLength);

					p = f.fillBuffer(1024);
					if (p)
						await p;

					continue;

				default:
					tmpChunkLength = f.readUInt32LE();
					if (tmpChunkLength === null)
						break _mainLoop;

					bytesLeftInFile -= 8;

					if (tmpChunkLength < 0 || tmpChunkLength > bytesLeftInFile)
						break _mainLoop;

					f.skip(tmpChunkLength);

					p = f.fillBuffer(1024);
					if (p)
						await p;

					continue;
			}

			p = f.fillBuffer(1024);
			if (p)
				await p;

			while ((isWave && (!fmtOk || !dataOk)) || bytesLeftInChunk > 0) {
				const subChunk = f.readUInt32BE();
				let subChunkLength: number | null = 0;

				if (subChunk === null)
					break _mainLoop;

				bytesLeftInFile -= 4;
				bytesLeftInChunk -= 4;

				if (subChunk !== 0x494e464f) { // INFO
					subChunkLength = f.readUInt32LE();

					if (subChunkLength === null ||
						subChunkLength < 0 ||
						subChunkLength > bytesLeftInFile ||
						(!isWave && subChunkLength > bytesLeftInChunk))
						break _mainLoop;

					bytesLeftInFile -= 4;
					bytesLeftInChunk -= 4;
				}

				if (subChunk !== 0x64617461) { // data
					p = f.fillBuffer(Math.min(8 + 256, 8 + subChunkLength));
					if (p)
						await p;
				}

				switch (subChunk) {
					case 0x666d7420: // fmt
						if (!isWave)
							break;

						// https://docs.microsoft.com/en-us/windows/win32/api/mmeapi/ns-mmeapi-waveformatex
						// https://docs.microsoft.com/en-us/windows/win32/directshow/audio-subtypes
						const wFormatTag = f.readUInt16LE(),
							nChannels = f.readUInt16LE(),
							nSamplesPerSec = f.readUInt32LE(),
							nAvgBytesPerSec = f.readUInt32LE(),
							nBlockAlign = f.readUInt16LE(),
							wBitsPerSample = f.readUInt16LE();

						subChunkLength -= 16;
						bytesLeftInFile -= 16;
						bytesLeftInChunk -= 16;

						if (wFormatTag === null ||
							nChannels === null ||
							nSamplesPerSec === null ||
							nAvgBytesPerSec === null ||
							nBlockAlign === null ||
							wBitsPerSample === null)
							break _mainLoop;

						// We could simply ignore compressed files... But let the browser decide...
						//if (wFormatTag !== 1 && // WAVE_FORMAT_PCM
						//	wFormatTag !== 3) // WAVE_FORMAT_IEEE_FLOAT
						//	break;

						fmtOk = true;

						if (!avgBytesPerSec)
							avgBytesPerSec = nAvgBytesPerSec;
						break;

					case 0x64617461: // data
						if (isWave) {
							dataOk = true;

							if (!dataLength)
								dataLength = subChunkLength;
						}
						break;

					case 0x494e464f: // INFO
						function readInfoStr(actualStrLen: number): string | null {
							f.read(tmp, 0, actualStrLen);
							return MetadataExtractor.finishReadingV2Frame(0, actualStrLen, tmp);
						}

						// https://www.robotplanet.dk/audio/wav_meta_data/
						// https://www.robotplanet.dk/audio/wav_meta_data/riff_mci.pdf
						while (bytesLeftInChunk > 0) {
							p = f.fillBuffer(8);
							if (p)
								await p;

							const metadataId = f.readUInt32BE();
							bytesLeftInFile -= 4;
							bytesLeftInChunk -= 4;

							if (metadataId === null)
								break _mainLoop;

							let nullTerminatedStrLen = f.readUInt32LE();
							bytesLeftInFile -= 4;
							bytesLeftInChunk -= 4;

							if (nullTerminatedStrLen === null || nullTerminatedStrLen < 0 || nullTerminatedStrLen > bytesLeftInChunk)
								break _mainLoop;

							if (nullTerminatedStrLen <= 1) {
								f.skip(nullTerminatedStrLen);
								continue;
							}

							let actualStrLen = Math.min(257, nullTerminatedStrLen) - 1;
							p = f.fillBuffer(actualStrLen);
							if (p)
								await p;

							switch (metadataId) {
								case 0x494e414d: // INAM
									metadata.title = readInfoStr(actualStrLen);
									break;
								case 0x49505244: // IPRD
									metadata.album = readInfoStr(actualStrLen);
									break;
								case 0x49415254: // IART
									metadata.artist = readInfoStr(actualStrLen);
									break;
								case 0x49435244: // ICRD
									metadata.year = parseInt(readInfoStr(actualStrLen) as string) || 0;
									break;
								case 0x4954524b: // ITRK
									metadata.track = parseInt(readInfoStr(actualStrLen) as string) || 0;
									break;
								default:
									actualStrLen = 0;
									break;
							}

							f.skip(nullTerminatedStrLen - actualStrLen);
							bytesLeftInFile -= nullTerminatedStrLen;
							bytesLeftInChunk -= nullTerminatedStrLen;
						}
						break;
				}

				if (subChunkLength > 0) {
					f.skip(subChunkLength);
					bytesLeftInFile -= subChunkLength;
					bytesLeftInChunk -= subChunkLength;
				}

				if (bytesLeftInFile) {
					p = f.fillBuffer(8);
					if (p)
						await p;
				}
			}
		}

		if (fmtOk && dataOk) {
			if (id3Position) {
				if (id3Position > 0)
					f.seekTo(id3Position);
				const p = f.fillBuffer(1024);
				if (p)
					await p;
			}
			metadata.lengthMS = (dataLength * 1000 / avgBytesPerSec) | 0;
			return [metadata, !!id3Position];
		}

		return null;
	}

	private static finishReadingV2Frame(encoding: number, frameSize: number, tmp: Uint8Array): string | null {
		let offsetStart = 0, offsetEnd = frameSize - 1;

		_trimStart:
		while (frameSize > 0) {
			switch (tmp[offsetStart]) {
				case 0x00:
				case 0x09:
				case 0x0A:
				case 0x0B:
				case 0x0C:
				case 0x0D:
				case 0x20:
				case 0x85:
				case 0xA0:
					frameSize--;
					offsetStart++;
					break;
				default:
					break _trimStart;
			}
		}

		_trimEnd:
		while (frameSize > 0) {
			switch (tmp[offsetEnd]) {
				case 0x00:
				case 0x09:
				case 0x0A:
				case 0x0B:
				case 0x0C:
				case 0x0D:
				case 0x20:
				case 0x85:
				case 0xA0:
					frameSize--;
					offsetEnd--;
					break;
				default:
					break _trimEnd;
			}
		}

		// According to https://nodejs.org/api/util.html#util_class_util_textdecoder
		// The following charsets are available:
		// iso-8859-1
		// utf-16
		// utf-16be
		// utf-16le
		// utf-8
		let ret: string | null = null;

		switch (encoding) {
			case 1: // UCS-2 (utf-16 encoded Unicode with BOM), in ID3v2.2 and ID3v2.3
			case 2: // utf-16be encoded Unicode without BOM, in ID3v2.4
				// Restore the extra 0 removed from the end
				if ((frameSize & 1) && (offsetStart + frameSize) < tmp.length)
					frameSize++;

				if (frameSize >= 2 && encoding === 1) {
					if (tmp[offsetStart] === 0xFE && tmp[offsetStart + 1] === 0xFF) {
						encoding = 2;
						offsetStart += 2;
						frameSize -= 2;
					} else if (tmp[offsetStart] === 0xFF && tmp[offsetStart + 1] === 0xFE) {
						offsetStart += 2;
						frameSize -= 2;
					}
					if (!frameSize)
						return null;
				}
				break;
		}

		switch (encoding) {
			case 0: // iso-8859-1
				ret = MetadataExtractor.textDecoderIso88591.decode(tmp.subarray(offsetStart, offsetStart + frameSize));
				break;

			case 1: // UCS-2 (utf-16 encoded Unicode with BOM), in ID3v2.2 and ID3v2.3
				ret = MetadataExtractor.textDecoderUtf16.decode(tmp.subarray(offsetStart, offsetStart + frameSize));
				break;

			case 2: // utf-16be encoded Unicode without BOM, in ID3v2.4
				ret = MetadataExtractor.textDecoderUtf16be.decode(tmp.subarray(offsetStart, offsetStart + frameSize));
				break;

			case 3: // utf-8 encoded Unicode, in ID3v2.4
				ret = MetadataExtractor.textDecoderUtf8.decode(tmp.subarray(offsetStart, offsetStart + frameSize));
				break;
		}

		return ((!ret || !ret.length) ? null : ret);
	}

	private static readV2Frame(f: BufferedFileHandle, frameSize: number, tmpPtr: Uint8Array[]): Promise<string | null> | string | null {
		if (frameSize < 2) {
			f.skip(frameSize);
			return null;
		}

		const encoding = f.readByte();

		frameSize--; // Discount the encoding

		if (encoding < 0 || encoding > 3) {
			f.skip(frameSize);
			return null;
		}

		let tmp = tmpPtr[0];

		if (frameSize > tmp.length) {
			tmp = new Uint8Array(frameSize + 16);
			tmpPtr[0] = tmp;
		}

		const p = f.read(tmp, 0, frameSize);
		if ((typeof p) === "number")
			return MetadataExtractor.finishReadingV2Frame(encoding, p as number, tmp);

		return (p as Promise<number>).then(function (value) {
			return MetadataExtractor.finishReadingV2Frame(encoding, value, tmp);
		});
	}

	private static async extractID3v1(metadata: Metadata, f: BufferedFileHandle, found: number, tmp: Uint8Array): Promise<void> {
		try {
			f.seekTo(f.fileLength - 128);
			const p = f.read(tmp, 0, 128);
			if ((typeof p) !== "number")
				await p;
	
			if (tmp[0] != 0x54 ||
				tmp[1] != 0x41 ||
				tmp[2] != 0x47) //TAG
				return;

			//struct _ID3v1 {
			//public:
			//	char title[30];
			//	char artist[30];
			//	char album[30];
			//	char year[4];
			//	char comment[28];
			//	unsigned char zeroByte; //If a track number is stored, this byte contains a binary 0.
			//	unsigned char track; //The number of the track on the album, or 0. Invalid, if previous byte is not a binary 0.
			//	unsigned char genre; //Index in a list of genres, or 255
			//} tag;

			let i: number, c: number;

			if (!(found & MetadataExtractor.TITLE_B)) {
				i = 3;
				c = 0;
				while (c < 30 && tmp[i]) {
					c++;
					i++;
				}
				if (c)
					metadata.title = MetadataExtractor.textDecoderIso88591.decode(tmp.subarray(3, 3 + c));
			}

			if (!(found & MetadataExtractor.ARTIST_B)) {
				i = 3 + 30;
				c = 0;
				while (c < 30 && tmp[i]) {
					c++;
					i++;
				}
				if (c)
					metadata.artist = MetadataExtractor.textDecoderIso88591.decode(tmp.subarray(3 + 30, 3 + 30 + c));
			}

			if (!(found & MetadataExtractor.ALBUM_B)) {
				i = 3 + 30 + 30;
				c = 0;
				while (c < 30 && tmp[i]) {
					c++;
					i++;
				}
				if (c)
					metadata.album = MetadataExtractor.textDecoderIso88591.decode(tmp.subarray(3 + 30 + 30, 3 + 30 + 30 + c));
			}

			if (!(found & MetadataExtractor.YEAR_B)) {
				i = 3 + 30 + 30 + 30;
				c = 0;
				while (c < 4 && tmp[i]) {
					c++;
					i++;
				}
				if (c)
					metadata.year = parseInt(MetadataExtractor.textDecoderIso88591.decode(tmp.subarray(3 + 30 + 30 + 30, 3 + 30 + 30 + 30 + c)));
			}

			if (!(found & MetadataExtractor.TRACK_B) && !tmp[128 - 3] && tmp[128 - 2])
				metadata.track = tmp[128 - 2] & 0xff;
		} catch (ex) {
			// Ignore all exceptions while reading ID3v1, in favor of
			// everything that has already been read in ID3v2
		}
	}

	private static async extractID3v2Andv1(file: File, f: BufferedFileHandle, tmpPtr: Uint8Array[]): Promise<Metadata | null> {
		const metadata: Metadata = {
			url: FileUtils.urlOrPathToURL((file as any)["data-path"]) || "",
			flags: MetadataFlags.Seekable
		};

		if (!metadata.url) {
			metadata.file = file;
			metadata.fileSize = file.size;
			metadata.fileName = file.name;
		} else if (metadata.url.startsWith(FileUtils.localURLPrefix)) {
			metadata.file = file;
		}

		//struct _ID3v2TagHdr {
		//public:
		//	unsigned int hdr;
		//	unsigned char hdrRev;
		//	unsigned char flags;
		//	unsigned char sizeBytes[4];
		//} tagV2Hdr;

		// readInt() reads a big-endian 32-bit integer
		let hdr = (f.readByte() << 24) | (f.readByte() << 16) | (f.readByte() << 8);
		if (hdr !== 0x49443300) { // ID3x
			hdr |= f.readByte();
			if (hdr === 0x52494646) { // RIFF
				const riffResult = await MetadataExtractor.extractRIFF(metadata, f, tmpPtr[0]);
				// Codec/file type not supported
				if (!riffResult)
					return null;
				// When extractRIFF()[1] === true, f points to a possible ID3 tag, with the first 3 bytes already consumed
				if (!riffResult[1])
					return metadata;
			} else {
				await MetadataExtractor.extractID3v1(metadata, f, 0, tmpPtr[0]);
				return metadata;
			}
		}

		const hdrRevLo = f.readByte(),
			hdrRevHi = f.readByte(),
			flags = f.readByte(),
			sizeBytes0 = f.readByte(),
			sizeBytes1 = f.readByte(),
			sizeBytes2 = f.readByte(),
			sizeBytes3 = f.readByte();

		let size = ((flags & 0x10) ? 10 : 0) + // Footer presence flag
		(
			(sizeBytes3 & 0x7f) |
			((sizeBytes2 & 0x7f) << 7) |
			((sizeBytes1 & 0x7f) << 14) |
			((sizeBytes0 & 0x7f) << 21)
		);

		if ((hdrRevLo & 0xff) > 2 || hdrRevHi) { // Only rev 3 or greater supported
			// http://id3.org/id3v2.3.0
			// http://id3.org/id3v2.4.0-structure
			// http://id3.org/id3v2.4.0-frames

			let found = 0;

			while (size > 0 && found !== MetadataExtractor.ALL_B) {
				const p = f.fillBuffer(1024);
				if (p)
					await p;

				// struct _ID3v2FrameHdr {
				// public:
				// 	unsigned int id;
				// 	unsigned int size;
				// 	unsigned short flags;
				// } frame;
				const frameId = (f.readByte() << 24) | (f.readByte() << 16) | (f.readByte() << 8) | f.readByte();
				const frameSize = (f.readByte() << 24) | (f.readByte() << 16) | (f.readByte() << 8) | f.readByte();
				// Skip the flags
				f.skip(2);
				if (!frameId || frameSize <= 0 || frameSize > size)
					break;

				switch (frameId) {
					case 0x54495432: // title - TIT2
						if (!(found & MetadataExtractor.TITLE_B)) {
							const p = MetadataExtractor.readV2Frame(f, frameSize, tmpPtr);
							if (p && (p as Promise<string | null>).then)
								metadata.title = await p;
							else
								metadata.title = p as string;
							if (metadata.title)
								found |= MetadataExtractor.TITLE_B;
						} else {
							f.skip(frameSize);
						}
						break;

					case 0x54504531: // artist - TPE1
						if (!(found & MetadataExtractor.ARTIST_B)) {
							const p = MetadataExtractor.readV2Frame(f, frameSize, tmpPtr);
							if (p && (p as Promise<string | null>).then)
								metadata.artist = await p;
							else
								metadata.artist = p as string;
							if (metadata.artist)
								found |= MetadataExtractor.ARTIST_B;
						} else {
							f.skip(frameSize);
						}
						break;

					case 0x54414c42: // album - TALB
						if (!(found & MetadataExtractor.ALBUM_B)) {
							const p = MetadataExtractor.readV2Frame(f, frameSize, tmpPtr);
							if (p && (p as Promise<string | null>).then)
								metadata.album = await p;
							else
								metadata.album = p as string;
							if (metadata.album)
								found |= MetadataExtractor.ALBUM_B;
						} else {
							f.skip(frameSize);
						}
						break;

					case 0x5452434b: // track - TRCK
						if (!(found & MetadataExtractor.TRACK_B)) {
							const p = MetadataExtractor.readV2Frame(f, frameSize, tmpPtr);
							if (p && (p as Promise<string | null>).then)
								metadata.track = parseInt(await (p as Promise<string>));
							else
								metadata.track = parseInt(p as string);
							if (metadata.track)
								found |= MetadataExtractor.TRACK_B;
							else
								metadata.track = 0;
						} else {
							f.skip(frameSize);
						}
						break;

					case 0x544c454e: // length - TLEN
						if (!(found & MetadataExtractor.LENGTH_B)) {
							const p = MetadataExtractor.readV2Frame(f, frameSize, tmpPtr);
							if (p && (p as Promise<string | null>).then)
								metadata.lengthMS = parseInt(await (p as Promise<string>));
							else
								metadata.lengthMS = parseInt(p as string);
							if (metadata.lengthMS)
								found |= MetadataExtractor.LENGTH_B;
							else
								metadata.lengthMS = 0;
						} else {
							f.skip(frameSize);
						}
						break;

					case 0x54594552: // year - TYER
					case 0x54445243: // Recording time - TDRC
						if (!(found & MetadataExtractor.YEAR_B)) {
							const p = MetadataExtractor.readV2Frame(f, frameSize, tmpPtr);
							if (p && (p as Promise<string | null>).then)
								metadata.year = parseInt(await (p as Promise<string>));
							else
								metadata.year = parseInt(p as string);
							if (metadata.year)
								found |= MetadataExtractor.YEAR_B;
							else
								metadata.year = 0;
						} else {
							f.skip(frameSize);
						}
						break;

					default:
						f.skip(frameSize);
						break;
				}

				size -= (10 + frameSize);
			}

			// Try to extract ID3v1 only if there are any blank fields
			if ((found & MetadataExtractor.ALL_BUT_LENGTH_B) !== MetadataExtractor.ALL_BUT_LENGTH_B)
				await MetadataExtractor.extractID3v1(metadata, f, found, tmpPtr[0]);
		}

		return metadata;
	}

	public static async extract(file: File, buffer?: Uint8Array | null, tempBuffer?: Uint8Array[] | null): Promise<Metadata | null> {
		if (!file)
			return null;

		if (!file.name.endsWith(".mp3") &&
			!file.name.endsWith(".aac") &&
			!file.name.endsWith(".wav")) {
			const lcase = file.name.toLowerCase();
			if (!lcase.endsWith(".mp3") &&
				!lcase.endsWith(".aac") &&
				!lcase.endsWith(".wav"))
				return null;
		}

		if (!buffer)
			buffer = new Uint8Array(BufferedFileHandle.minBufferLength);

		if (!tempBuffer)
			tempBuffer = [new Uint8Array(256)];

		try {
			const f = new BufferedFileHandle(file, buffer);

			await f.fillBuffer(-1);

			// Call await here, instead of returning the Promise itself, so we can catch
			// errors here and return null instead of returning a rejected Promise.
			//
			// Also, if we don't call await here, we could end up with errors since
			// stream.cancel() is called inside finally, which could happen before
			// MetadataExtractor.extractID3v2Andv1() has had a chance to actually read
			// the metadata...
			return await MetadataExtractor.extractID3v2Andv1(file, f, tempBuffer);
		} catch (ex) {
			return null;
		}
	}
}
