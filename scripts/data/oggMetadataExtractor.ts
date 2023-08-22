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

class OggBufferedReader extends BufferedFileReader {
	// https://en.wikipedia.org/wiki/Ogg#Page_structure
	// https://wiki.xiph.org/OggVorbis
	// (Ogg) Basic page structure = 27 bytes
	// (Ogg) Maximum segment table = 255 bytes
	private static readonly basicPageStructureLength = 27;
	private static readonly maximumOggPageHeaderLength = OggBufferedReader.basicPageStructureLength + 255;
	// (Vorbis) Pack type = 1 bytes
	// (Vorbis) Identifier = 6 bytes "vorbis"
	private static readonly vorbisIdentifierLength = 1 + 6;

	private currentPageLength: number;
	private additionalSkipLength: number;

	public constructor(file: File, buffer: Uint8Array) {
		super(file, buffer);

		this.currentPageLength = 0;
		this.additionalSkipLength = 0;
	}

	private readPageLength(): number {
		if (super.bufferAvailable < OggBufferedReader.basicPageStructureLength)
			return -1;

		// Capture pattern (32 bits)
		if (super.readUInt32BE() !== 0x4f676753) // OggS
			return -1;

		// Version (8 bits)
		// Header type (8 bits)
		// Granule position (64 bits)
		// Bitstream serial number (32 bits)
		// Page sequence number (32 bits)
		// Checksum (32 bits)
		super.skip(22);

		// Page segments (8 bits)
		let pageSegments = super.readByte();
		if (super.bufferAvailable < pageSegments)
			return -1;

		if (!pageSegments)
			return 0;

		let pageLength = 0;
		while (pageSegments-- > 0)
			pageLength += super.readByte();

		return pageLength;
	}

	public async findInitialVorbisCommentPage(metadata: Metadata): Promise<boolean> {
		debugger;
		for (; ; ) {
			// Read one Ogg page + enough data to try to figure out its vorbis type
			const tmpLength = OggBufferedReader.maximumOggPageHeaderLength + OggBufferedReader.vorbisIdentifierLength;

			const p = super.fillBuffer(tmpLength);
			if (p)
				await p;

			const pageLength = this.readPageLength();
			if (pageLength < 0)
				return false;

			if (!pageLength)
				continue;

			if (pageLength > OggBufferedReader.vorbisIdentifierLength) {
				// readPageAndExtraData() leaves at least vorbisIdentifierLength extra bytes in the buffer
				if (super.bufferAvailable < OggBufferedReader.vorbisIdentifierLength)
					return false;

				const packtype = super.readByte();
				if (packtype < 0)
					return false;

				let signature1: number | null;
				let signature2: number | null;

				// https://xiph.org/vorbis/doc/Vorbis_I_spec.html
				// A.2. Encapsulation
				// Ogg encapsulation of a Vorbis packet stream is straightforward.
				// The first Vorbis packet (the identification header), which uniquely identifies a stream as Vorbis audio,
				// is placed alone in the first page of the logical Ogg stream. This results in a first Ogg page of exactly
				// 58 bytes at the very beginning of the logical stream.
				//
				// Therefore the first page should be of type 1, and it should contain the sample rate and number of channels.
				switch (packtype) {
					case 1:
						signature1 = super.readUInt32BE();
						signature2 = super.readUInt16BE();
						if (signature1 === 0x766f7262 && // vorb
							signature2 === 0x6973) { // is

							// https://wiki.xiph.org/OggVorbis
							// packtype (1 byte)
							// identifier char[6]: 'vorbis'
							// version (4 bytes)
							// channels (1 byte)
							// rate (4 bytes)

							this.currentPageLength = pageLength - 7;

							const p = this.fillBuffer(9);
							if (p)
								await p;

							super.skip(4); // version

							const channels = super.readByte();
							const sampleRate = super.readUInt32LE();
							if (channels < 0 || !sampleRate)
								return false;

							metadata.channels = channels;
							metadata.sampleRate = sampleRate;

							this.currentPageLength = pageLength - 16;

							super.skip(pageLength - 16);
							continue;
						}

						// Not a valid page, just skip it
						super.skip(pageLength - 7);
						break;

					case 3:
						signature1 = super.readUInt32BE();
						signature2 = super.readUInt16BE();
						if (signature1 === 0x766f7262 && // vorb
							signature2 === 0x6973) { // is

							this.currentPageLength = pageLength - 7;

							const p = this.fillBuffer(this.currentPageLength);
							if (p)
								await p;

							return true;
						}

						// Not a comment page, just skip it
						super.skip(pageLength - 7);
						break;

					default:
						// Not a comment page, just skip it
						super.skip(pageLength - 1);
						break;
				}
			} else {
				// Not a comment page, just skip it
				super.skip(pageLength);
			}
		}
	}

	public seekTo(position: number): void {
		throw new Error("Unsupported operation");
	}

	public skip(bytes: number): void {
		if (bytes <= 0)
			return;

		if (this.additionalSkipLength > 0) {
			this.additionalSkipLength += bytes;
		} else if (bytes <= this.currentPageLength) {
			this.currentPageLength -= bytes;
			super.skip(bytes);
			return;
		} else {
			this.additionalSkipLength = bytes - this.currentPageLength;
			super.skip(this.currentPageLength);
			this.currentPageLength = 0;
		}

		while (super.bufferAvailable > OggBufferedReader.maximumOggPageHeaderLength) {
			this.currentPageLength = this.readPageLength();
			if (this.currentPageLength < 0) {
				// Something wrong happened, so just skip to the end to force an eof
				super.skip(super.totalLength);
				return;
			}

			if (!this.currentPageLength)
				continue;

			if (this.additionalSkipLength <= this.currentPageLength) {
				this.currentPageLength -= this.additionalSkipLength;
				super.skip(this.additionalSkipLength);
				this.additionalSkipLength = 0;
				return;
			}

			this.additionalSkipLength -= this.currentPageLength;
			super.skip(this.currentPageLength);
			this.currentPageLength = 0;
		}
	}

	private async skipAdditionalSkipLength(): Promise<void> {
		while (this.additionalSkipLength > 0) {
			let p = super.fillBuffer(OggBufferedReader.maximumOggPageHeaderLength + OggBufferedReader.maximumOggPageHeaderLength + 4);
			if (p)
				await p;

			if (!this.currentPageLength && !this.readNextPageLength()) {
				this.additionalSkipLength = 0;
				return;
			}

			if (this.additionalSkipLength <= this.currentPageLength) {
				this.currentPageLength -= this.additionalSkipLength;
				super.skip(this.additionalSkipLength);
				this.additionalSkipLength = 0;

				p = super.fillBuffer(OggBufferedReader.maximumOggPageHeaderLength + OggBufferedReader.maximumOggPageHeaderLength + 4);
				if (p)
					await p;

				return;
			}

			this.additionalSkipLength -= this.currentPageLength;
			super.skip(this.currentPageLength);
			this.currentPageLength = 0;
		}
	}

	private readNextPageLength(): boolean {
		while (super.bufferAvailable > OggBufferedReader.maximumOggPageHeaderLength) {
			this.currentPageLength = this.readPageLength();
			if (this.currentPageLength < 0) {
				// Something wrong happened, so just skip to the end to force an eof
				super.skip(super.totalLength);
				return false;
			}

			if (!this.currentPageLength)
				continue;

			if (!super.bufferAvailable)
				return false;

			return true;
		}

		return false;
	}

	public fillBuffer(length: number): Promise<void | null> | null {
		if (this.additionalSkipLength > 0)
			return this.skipAdditionalSkipLength().then(() => this.fillBuffer(length));

		// Always leave enough data in the buffer in order to allow for
		// an extra int (32 bits) to be read, in addition to the next page header
		const p = super.fillBuffer(Math.min(length + OggBufferedReader.maximumOggPageHeaderLength + OggBufferedReader.maximumOggPageHeaderLength + 4, super.bufferLength));
		if (p)
			return p.then(() => this.fillBuffer(length));

		if (!this.currentPageLength)
			this.readNextPageLength();

		return null;
	}

	public readByte(): number {
		if (!this.currentPageLength && !this.readNextPageLength())
			return -1;

		this.currentPageLength--;
		return super.readByte();
	}

	public readUInt32BE(): number | null {
		if (this.currentPageLength >= 4) {
			this.currentPageLength -= 4;
			return super.readUInt32BE();
		}

		const a = this.readByte(),
			b = this.readByte(),
			c = this.readByte(),
			d = this.readByte();

		return ((a < 0 || b < 0 || c < 0 || d < 0) ? null : (
			(a << 24) |
			(b << 16) |
			(c << 8) |
			d
		));
	}

	public readUInt32LE(): number | null {
		if (this.currentPageLength >= 4) {
			this.currentPageLength -= 4;
			return super.readUInt32LE();
		}

		const a = this.readByte(),
			b = this.readByte(),
			c = this.readByte(),
			d = this.readByte();

		return ((a < 0 || b < 0 || c < 0 || d < 0) ? null : (
			a |
			(b << 8) |
			(c << 16) |
			(d << 24)
		));
	}

	public readUInt16BE(): number | null {
		if (this.currentPageLength >= 2) {
			this.currentPageLength -= 2;
			return super.readUInt16BE();
		}

		const a = this.readByte(),
			b = this.readByte();

		return ((a < 0 || b < 0) ? null : (
			(a << 8) |
			b
		));
	}

	public readUInt16LE(): number | null {
		if (this.currentPageLength >= 2) {
			this.currentPageLength -= 2;
			return super.readUInt16LE();
		}

		const a = this.readByte(),
			b = this.readByte();

		return ((a < 0 || b < 0) ? null : (
			a |
			(b << 8)
		));
	}

	private async readAsync(p: Promise<number> | number, buffer: Uint8Array, offset: number, length: number, totalRead: number): Promise<number> {
		if ((typeof p) !== "number") {
			p = await p;

			if (p <= 0)
				return totalRead;
		}

		length -= p as number;
		this.currentPageLength -= p as number;
		offset += p as number;
		totalRead += p as number;

		while (length > 0 && !super.eof) {
			if (!this.currentPageLength) {
				if (this.bufferAvailable < OggBufferedReader.maximumOggPageHeaderLength)
					await super.fillBuffer(OggBufferedReader.maximumOggPageHeaderLength + OggBufferedReader.maximumOggPageHeaderLength + 4);

				if (!this.readNextPageLength())
					return totalRead;
			}

			p = super.read(buffer, offset, Math.min(length, this.currentPageLength));
			if ((typeof p) !== "number")
				p = await p;

			if (p <= 0)
				break;

			length -= p as number;
			this.currentPageLength -= p as number;
			offset += p as number;
			totalRead += p as number;
		}

		if (!this.currentPageLength) {
			if (this.bufferAvailable < OggBufferedReader.maximumOggPageHeaderLength)
				await super.fillBuffer(OggBufferedReader.maximumOggPageHeaderLength + OggBufferedReader.maximumOggPageHeaderLength + 4);

			this.readNextPageLength();
		}

		return totalRead;
	}

	public read(buffer: Uint8Array, offset: number, length: number): Promise<number> | number {
		if (this.additionalSkipLength > 0)
			return this.skipAdditionalSkipLength().then(() => this.read(buffer, offset, length));

		let totalRead = 0;

		while (length > 0 && !super.eof) {
			if (!this.currentPageLength) {
				if (this.bufferAvailable < OggBufferedReader.maximumOggPageHeaderLength)
					return this.readAsync(0, buffer, offset, length, totalRead);

				if (!this.readNextPageLength())
					return totalRead;
			}

			const p = super.read(buffer, offset, Math.min(length, this.currentPageLength));
			if ((typeof p) !== "number")
				return this.readAsync(p, buffer, offset, length, totalRead);

			if (p <= 0)
				break;

			length -= p as number;
			this.currentPageLength -= p as number;
			offset += p as number;
			totalRead += p as number;
		}

		if (!this.currentPageLength && this.bufferAvailable > OggBufferedReader.maximumOggPageHeaderLength)
			this.readNextPageLength();

		return totalRead;
	}
}

class OggMetadataExtractor extends VorbisCommentExtractor {
	public static async extract(file: File, buffer: Uint8Array, tmpPtr: Uint8Array[]): Promise<Metadata | null> {
		try {
			const f = new OggBufferedReader(file, buffer);

			const metadata = MetadataExtractor.createBasicMetadata(file);

			if (!await f.findInitialVorbisCommentPage(metadata))
				return null;

			return (await VorbisCommentExtractor.extractVorbisComment(f.totalLength - f.readPosition, metadata, f, tmpPtr) ? metadata : null);
		} catch (ex) {
			return null;
		}
	}
}
