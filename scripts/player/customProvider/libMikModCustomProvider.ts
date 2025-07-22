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

class LibMikModCustomProvider extends CustomProvider {
	public static init(): void {
		const supportedExtensions: string[] = [
			".669", ".amf", ".asy", ".dsm", ".far", ".gdm", ".gt2", ".imf", ".it", ".m15", ".med", ".mod", ".mtm", ".okt", ".s3m", ".stm", ".stx", ".ult", ".umx", ".uni", ".xm"
		];

		const instance = new LibMikModCustomProvider();

		for (let i = supportedExtensions.length - 1; i >= 0; i--)
			FileUtils.addSupportedExtension(supportedExtensions[i], "application/octet-stream", instance);
	}

	private constructor() {
		super(CustomProviderId.LibMikMod);
	}

	public async extractMetadata(metadata: Metadata, file: File, buffer: Uint8Array, tmpBuffer: ResizeableBuffer, fetchAlbumArt: boolean): Promise<Metadata | null> {
		metadata.flags &= ~MetadataFlags.Seekable;
		return metadata;
	}
}
