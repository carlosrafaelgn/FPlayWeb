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

class FLACMetadataExtractor extends VorbisCommentExtractor {
	private static readHeaderAndStreamInfo(metadata: Metadata, f: BufferedReader, tmp: Uint8Array): number {
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
		// MSB
		// sample rate in Hz (20 bits)
		// number of channels - 1 (3 bits)
		// bits per sample - 1 (5 bits)
		// MSB total samples in stream (4 bits)
		// LSB

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

		metadata.sampleRate = d0;
		metadata.channels = numberOfChannels;

		return (lastBlock ? -1 : 1);
	}

	private static async readMetadataBlock(metadata: Metadata, f: BufferedReader, tmpBuffer: ResizeableBuffer, fetchAlbumArt: boolean): Promise<number> {
		// https://xiph.org/flac/format.html#metadata_block_header
		// https://xiph.org/flac/format.html#metadata_block_vorbis_comment
		// https://xiph.org/flac/format.html#metadata_block_picture
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

		if (type === 127 || (typeAndLength + f.readPosition) > f.totalLength)
			return 0;

		if (type === 4) // VORBIS_COMMENT
			return (await VorbisCommentExtractor.extractVorbisComment(typeAndLength, metadata, f, tmpBuffer, fetchAlbumArt) ? -2 : 0);

		if (type === 6 && fetchAlbumArt) { // PICTURE
			let p = f.fillBuffer(4);
			if (p)
				await p;

			const pictureType = f.readUInt32BE(); // The picture type according to Table 13
			if (pictureType === null)
				return 0;

			if (pictureType !== 3) {
				f.skip(typeAndLength - 4);
				return 1;
			}

			p = f.fillBuffer(-1);
			if (p)
				await p;

			const mimeTypeLength = f.readUInt32BE(); // The length of the media type string in bytes.
			if (mimeTypeLength === null)
				return 0;

			f.skip(mimeTypeLength);	

			const descriptionLength = f.readUInt32BE(); // The length of the description string in bytes.
			if (descriptionLength === null)
				return 0;

			f.skip(descriptionLength);

			const width = f.readUInt32BE(); // The width of the picture in pixels.
			if (width === null)
				return 0;

			const height = f.readUInt32BE(); // The height of the picture in pixels.
			if (height === null)
				return 0;

			const colorDepth = f.readUInt32BE(); // The color depth of the picture in bits per pixel.
			if (colorDepth === null)
				return 0;

			const colorsUsed = f.readUInt32BE(); // For indexed-color pictures (e.g., GIF), the number of colors used; 0 for non-indexed pictures.
			if (colorsUsed === null)
				return 0;

			const dataLength = f.readUInt32BE(); // The length of the picture data in bytes.
			if (dataLength === null)
				return 0;

			const image = new Uint8Array(dataLength);
			const bytesRead = await f.read(image, 0, image.length);
			if (bytesRead === image.length)
				metadata.albumArt = image;

			return -3;
		} else {
			f.skip(typeAndLength);
		}

		return (lastBlock ? -1 : 1);
	}

	public static async extract(file: File, buffer: Uint8Array, tmpBuffer: ResizeableBuffer, fetchAlbumArt: boolean): Promise<Metadata | null> {
		try {
			const f = new BufferedFileReader(file, buffer);

			await f.fillBuffer(-1);

			const metadata = MetadataExtractor.createBasicMetadata(file);

			// The header and stream info, together, should have less than 256 bytes. Therefore,
			// since f is filled with enough data, readHeaderAndStreamInfo() does not need to be async.
			let r = FLACMetadataExtractor.readHeaderAndStreamInfo(metadata, f, tmpBuffer.buffer);
			if (!r)
				return null;
			if (r < 0)
				return metadata;

			if (!fetchAlbumArt) {
				do {
					r = await FLACMetadataExtractor.readMetadataBlock(metadata, f, tmpBuffer, fetchAlbumArt);
					if (!r)
						return null;
				} while (r > 0);
			} else {
				let metadataOK = false;
				let pictureOK = false;

				do {
					r = await FLACMetadataExtractor.readMetadataBlock(metadata, f, tmpBuffer, fetchAlbumArt);
					if (!r)
						return null;
					if (r === -2) {
						r = 1;
						metadataOK = true;
					} else if (r === -3) {
						r = 1;
						pictureOK = true;
					}
					if (metadataOK && pictureOK)
						break;
				} while (r > 0);
			}

			return metadata;
		} catch (ex) {
			return null;
		}
	}
}
