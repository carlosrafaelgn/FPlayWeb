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

class FLACMetadataExtractor extends MetadataExtractor {
	private static readHeaderAndStreamInfo(metadata: Metadata, f: BufferedFileHandle, tmp: Uint8Array): number {
		// https://xiph.org/flac/format.html#stream

		if (f.readUInt32BE() !== 0x664c6143) // fLaC
			return 0;

		let typeAndLength = f.readUInt32BE();
		if (!typeAndLength)
			return 0;

		const lastBlock = (typeAndLength & 0x80000000);
		typeAndLength &= 0x7fffffff;
		if (typeAndLength !== 0x22)
			return 0;

		// https://xiph.org/flac/format.html#metadata_block_streaminfo

		f.skip(10); // minimum block size, maximum block size, minimum frame size, maximum frame size

		let d0 = f.readUInt32BE();
		let totalSamples = f.readUInt32BE();
		if (!d0 || totalSamples === null)
			return 0;

		f.skip(16); // MD5 signature of the unencoded audio data (128 bits)

		// d0
		// sample rate in Hz (20 bits)
		// number of channels - 1 (3 bits)
		// bits per sample - 1 (5 bits)
		// MSB total samples in stream (4 bits)

		totalSamples += (d0 & 0x0f) * 4294967296; // Not using << because this number is larger than 0xffffffff
		d0 >>= 4;

		const bitsPerSample = (d0 & 0x1f) + 1;
		d0 >>= 5;

		const numberOfChannels = (d0 & 0x07) + 1;
		d0 >>= 3;

		// d0 is the sample rate now
		if (bitsPerSample < 4 || !d0)
			return 0;

		if (totalSamples)
			metadata.lengthMS = Math.floor(totalSamples * 1000 / d0);

		return (lastBlock ? -1 : 1);
	}

	private static async extractVorbisComment(blockLength: number, metadata: Metadata, f: BufferedFileHandle, tmpPtr: Uint8Array[]): Promise<number> {
		// https://xiph.org/flac/format.html#metadata_block_header
		// https://xiph.org/flac/format.html#metadata_block_vorbis_comment
		// https://www.xiph.org/vorbis/doc/v-comment.html
debugger;
		let p = f.fillBuffer(1024);
		if (p)
			await p;

		const vendorLength = f.readUInt32LE();
		blockLength -= 4;
		if (!vendorLength || vendorLength > blockLength)
			return 0;

		f.skip(vendorLength);
		blockLength -= vendorLength;
		if (!blockLength)
			return 1;

		p = f.fillBuffer(1024);
		if (p)
			await p;

		let userCommentListLength = f.readUInt32LE();
		blockLength -= 4;
		if (userCommentListLength === null || blockLength < 0 || userCommentListLength > blockLength)
			return 0;

		let performer: string | null = null;
		let albumArtist: string | null = null;
		let composer: string | null = null;

		while (userCommentListLength > 0) {
			userCommentListLength--;

			p = f.fillBuffer(4);
			if (p)
				await p;

			const length = f.readUInt32LE();
			blockLength -= 4;
			if (length === null || blockLength < 0 || length > blockLength)
				return 0;

			const bytesToRead = Math.min(2048, length);

			let tmp = tmpPtr[0];
			if (tmp.length < bytesToRead) {
				tmp = new Uint8Array(bytesToRead);
				tmpPtr[0] = tmp;
			}

			p = f.fillBuffer(bytesToRead + 4);
			if (p)
				await p;

			f.read(tmp, 0, bytesToRead);

			if (length > bytesToRead)
				f.skip(length - bytesToRead);
			blockLength -= length;

			try {
				let i: number;
				for (i = 0; i < bytesToRead; i++) {
					if (tmp[i] === 0x3d) { // =
						if (i && i < (bytesToRead - 1)) {
							const name = MetadataExtractor.textDecoderUtf8.decode(tmp.subarray(0, i)).normalize().trim();
							const value = MetadataExtractor.textDecoderUtf8.decode(tmp.subarray(i + 1, bytesToRead)).normalize().trim();

							if (!value)
								break;

							switch (name.toUpperCase()) {
								case "TITLE":
									metadata.title = value;
									break;

								case "ARTIST":
									if (metadata.artist)
										metadata.artist += ", " + value;
									else
										metadata.artist = value;
									break;

								case "PERFORMER":
									performer = value;
									break;

								case "ALBUMARTIST":
									albumArtist = value;
									break;

								case "COMPOSER":
									composer = value;
									break;

								case "ALBUM":
									metadata.album = value;
									break;

								case "TRACKNUMBER":
									metadata.track = parseInt(value) || 0;
									break;

								case "DATE":
									metadata.year = parseInt(value) || 0;
									break;
							}
						}
						break;
					}
				}
			} catch (ex: any) {
				// Just ignore...
			}
		}

		if (!metadata.artist) {
			if (performer)
				metadata.artist = performer;
			else if (albumArtist)
				metadata.artist = albumArtist;
			else if (composer)
				metadata.artist = composer;
		}

		if (blockLength > 0)
			f.skip(blockLength);

		return 1;
	}

	private static async readMetadataBlock(metadata: Metadata, f: BufferedFileHandle, tmpPtr: Uint8Array[]): Promise<number> {
		// https://xiph.org/flac/format.html#metadata_block_header
		// https://xiph.org/flac/format.html#metadata_block_vorbis_comment
		// https://www.xiph.org/vorbis/doc/v-comment.html

		let p = f.fillBuffer(4);
		if (p)
			await p;

		let typeAndLength = f.readUInt32BE();
		if (!typeAndLength)
			return 0;

		const lastBlock = (typeAndLength & 0x80000000);
		typeAndLength &= 0x7fffffff;

		const type = typeAndLength >> 24;
		// typeAndLength is the length now
		typeAndLength &= 0x00ffffff;

		if (type === 127 || (typeAndLength + f.filePosition) > f.fileLength)
			return 0;

		if (type === 4) { // VORBIS_COMMENT
			if (!await FLACMetadataExtractor.extractVorbisComment(typeAndLength, metadata, f, tmpPtr))
				return 0;
		} else {
			f.skip(typeAndLength);
		}

		return (lastBlock ? -1 : 1);
	}

	public static async extract(file: File, buffer: Uint8Array, tmpPtr: Uint8Array[]): Promise<Metadata | null> {
		// This method should not be directly called. Instead, it should only be
		// called from within FLACMetadataExtractor.extract().

		try {
			const f = new BufferedFileHandle(file, buffer);

			await f.fillBuffer(-1);

			const metadata = MetadataExtractor.createBasicMetadata(file);

			// The header and stream info, together, should have less than 256 bytes. Therefore,
			// since f is filled with enough data, readHeaderAndStreamInfo() does not need to be async.
			let r = FLACMetadataExtractor.readHeaderAndStreamInfo(metadata, f, tmpPtr[0]);
			if (!r)
				return null;
			if (r < 0)
				return metadata;

			do {
				r = await FLACMetadataExtractor.readMetadataBlock(metadata, f, tmpPtr);
				if (!r)
					return null;
			} while (r > 0);

			return metadata;
		} catch (ex) {
			return null;
		}
	}
}
