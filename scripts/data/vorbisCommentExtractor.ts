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

class VorbisCommentExtractor extends MetadataExtractor {
	protected static async extractVorbisComment(blockLength: number, metadata: Metadata, f: BufferedReader, tmpPtr: Uint8Array[]): Promise<boolean> {
		// https://xiph.org/flac/format.html#metadata_block_header
		// https://xiph.org/flac/format.html#metadata_block_vorbis_comment
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

		return true;
	}
}
