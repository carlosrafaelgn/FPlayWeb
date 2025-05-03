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

function decodeBase64(c: number): number {
	if (c >= 0x41 && c <= 0x5A) // A - Z
		return c - 0x41;
	else if (c >= 0x61 && c <= 0x7A) // a - z
		return c - 0x61 + 26;
	else if (c >= 0x30 && c <= 0x39) // 0 - 9
		return c - 0x30 + 26 + 26;
	else if (c === 0x2B) // +
		return 62;
	return 63;
}

class VorbisCommentExtractor extends MetadataExtractor {
	protected static async extractVorbisComment(blockLength: number, metadata: Metadata, f: BufferedReader, tmpBuffer: ResizeableBuffer, fetchAlbumArt: boolean): Promise<boolean> {
		// https://xiph.org/flac/format.html#metadata_block_header
		// https://xiph.org/flac/format.html#metadata_block_vorbis_comment
		// https://xiph.org/flac/format.html#metadata_block_picture
		// https://www.xiph.org/vorbis/doc/v-comment.html

		let p = f.fillBuffer(1024);
		if (p)
			await p;

		const vendorLength = f.readUInt32LE();
		blockLength -= 4;
		if (!vendorLength || vendorLength > blockLength)
			return false;

		f.skip(vendorLength);
		blockLength -= vendorLength;
		if (!blockLength)
			return true;

		p = f.fillBuffer(1024);
		if (p)
			await p;

		let userCommentListLength = f.readUInt32LE();
		blockLength -= 4;
		if (userCommentListLength === null || blockLength < 0 || userCommentListLength > blockLength)
			return false;

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
				return false;

			const bytesToRead = Math.min(2048, length);

			tmpBuffer.resizeCapacity(bytesToRead);
			const tmp = tmpBuffer.buffer;

			p = f.fillBuffer(bytesToRead + 4);
			if (p)
				await p;

			f.read(tmp, 0, bytesToRead);

			let bytesRead = bytesToRead;

			blockLength -= length;

			try {
				let i: number;
				for (i = 0; i < bytesToRead; i++) {
					if (tmp[i] === 0x3d) { // =
						if (i && i < (bytesToRead - 1)) {
							const name = MetadataExtractor.textDecoderUtf8.decode(tmp.subarray(0, i)).normalize().trim();

							let value: string;

							switch (name.toUpperCase()) {
								case "TITLE":
									if ((value = MetadataExtractor.textDecoderUtf8.decode(tmp.subarray(i + 1, bytesToRead)).normalize().trim()))
										metadata.title = value;
									break;

								case "ARTIST":
									if ((value = MetadataExtractor.textDecoderUtf8.decode(tmp.subarray(i + 1, bytesToRead)).normalize().trim())) {
										if (metadata.artist)
											metadata.artist += ", " + value;
										else
											metadata.artist = value;
									}
									break;

								case "PERFORMER":
									if ((value = MetadataExtractor.textDecoderUtf8.decode(tmp.subarray(i + 1, bytesToRead)).normalize().trim()))
										performer = value;
									break;

								case "ALBUMARTIST":
									if ((value = MetadataExtractor.textDecoderUtf8.decode(tmp.subarray(i + 1, bytesToRead)).normalize().trim()))
										albumArtist = value;
									break;

								case "COMPOSER":
									if ((value = MetadataExtractor.textDecoderUtf8.decode(tmp.subarray(i + 1, bytesToRead)).normalize().trim()))
										composer = value;
									break;

								case "ALBUM":
									if ((value = MetadataExtractor.textDecoderUtf8.decode(tmp.subarray(i + 1, bytesToRead)).normalize().trim()))
										metadata.album = value;
									break;

								case "TRACKNUMBER":
									if ((value = MetadataExtractor.textDecoderUtf8.decode(tmp.subarray(i + 1, bytesToRead)).normalize().trim()))
										metadata.track = parseInt(value) || 0;
									break;

								case "DATE":
									if ((value = MetadataExtractor.textDecoderUtf8.decode(tmp.subarray(i + 1, bytesToRead)).normalize().trim()))
										metadata.year = parseInt(value) || 0;
									break;

								case "METADATA_BLOCK_PICTURE":
									if (fetchAlbumArt && !metadata.albumArt) {
										const base64Bytes = new Uint8Array(length - i - 1);
										const tmpSubarray = tmp.subarray(i + 1, bytesToRead);
										base64Bytes.set(tmpSubarray);
										if (length > bytesRead) {
											await f.read(base64Bytes, tmpSubarray.length, length - bytesRead);
											bytesRead = length;
										}

										let srcLen = base64Bytes.length;
										if ((srcLen & 3))
											break;

										let dstLen = ((srcLen >>> 2) * 3);
										let extra = 0;
										if (base64Bytes[srcLen - 2] === 0x3D) {
											srcLen -= 4;
											extra = 1;
											dstLen -= 2;
										} else if (base64Bytes[srcLen - 1] === 0x3D) {
											srcLen -= 4;
											extra = 2;
											dstLen--;
										}

										if (dstLen < 32)
											break;

										// Decode the first four bytes before, because they are the picture type, and if
										// they are not 3 (Front cover), we can skip the rest
										if (decodeBase64(base64Bytes[0]) ||
											decodeBase64(base64Bytes[1]) ||
											decodeBase64(base64Bytes[2]) ||
											decodeBase64(base64Bytes[3]) ||
											decodeBase64(base64Bytes[4]) ||
											(decodeBase64(base64Bytes[5]) & 0x30) !== 0x30)
											break;

										let src = 4;
										let dst = 3;

										for ( ; src < srcLen; src += 4, dst += 3) {
											const a = decodeBase64(base64Bytes[src]);
											const b = decodeBase64(base64Bytes[src + 1]);
											const c = decodeBase64(base64Bytes[src + 2]);
											const d = decodeBase64(base64Bytes[src + 3]);
											base64Bytes[dst] = (a << 2) + ((b & 0x30) >>> 4);
											base64Bytes[dst + 1] = ((b & 0x0F) << 4) + ((c & 0x3C) >>> 2);
											base64Bytes[dst + 2] = ((c & 0x03) << 6) + d;
										}

										if (extra === 1) {
											const a = decodeBase64(base64Bytes[src]);
											const b = decodeBase64(base64Bytes[src + 1]);
											base64Bytes[dst] = (a << 2) + ((b & 0x30) >>> 4);
										} else if (extra === 2) {
											const a = decodeBase64(base64Bytes[src]);
											const b = decodeBase64(base64Bytes[src + 1]);
											const c = decodeBase64(base64Bytes[src + 2]);
											base64Bytes[dst] = (a << 2) + ((b & 0x30) >>> 4);
											base64Bytes[dst + 1] = ((b & 0x0F) << 4) + ((c & 0x3C) >>> 2);
										}

										// Skip picture type
										let metadataBlockPosition = 4;
										if ((metadataBlockPosition + 4) >= dstLen)
											break;

										const mediaTypeLength = (
											(base64Bytes[metadataBlockPosition++] << 24) |
											(base64Bytes[metadataBlockPosition++] << 16) |
											(base64Bytes[metadataBlockPosition++] << 8) |
											base64Bytes[metadataBlockPosition++]
										);
										metadataBlockPosition += mediaTypeLength;
										if ((metadataBlockPosition + 4) >= dstLen)
											break;

										const descriptionLength = (
											(base64Bytes[metadataBlockPosition++] << 24) |
											(base64Bytes[metadataBlockPosition++] << 16) |
											(base64Bytes[metadataBlockPosition++] << 8) |
											base64Bytes[metadataBlockPosition++]
										);
										metadataBlockPosition += descriptionLength;
										if ((metadataBlockPosition + 4) >= dstLen)
											break;

										// Skip width, height, color depth and colors used
										metadataBlockPosition += 16;
										if ((metadataBlockPosition + 4) >= dstLen)
											break;

										const dataLength = (
											(base64Bytes[metadataBlockPosition++] << 24) |
											(base64Bytes[metadataBlockPosition++] << 16) |
											(base64Bytes[metadataBlockPosition++] << 8) |
											base64Bytes[metadataBlockPosition++]
										);
										if ((metadataBlockPosition + dataLength) > dstLen)
											break;

										metadata.albumArt = base64Bytes.subarray(metadataBlockPosition, metadataBlockPosition + dataLength);
									}
									break;
							}
						}
						break;
					}
				}
			} catch (ex: any) {
				// Just ignore...
			}

			if (length > bytesRead)
				f.skip(length - bytesRead);
		}

		if (!metadata.artist) {
			if (performer)
				metadata.artist = performer;
			else if (albumArtist)
				metadata.artist = albumArtist;
			else if (composer)
				metadata.artist = composer;
		}

		return true;
	}
}
