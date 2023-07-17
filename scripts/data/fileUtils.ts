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

class FileUtils {
	public static readonly separator = "\u0004";
	public static readonly httpURLPrefix = "http";
	public static readonly fileURLPrefix = "file://";
	public static readonly localURLPrefix = "local://";
	private static readonly fileURLPrefixWindows = "file:///";
	private static readonly regExpSepWindows = /\\/g;
	private static readonly regExpHash = /\#/g;

	private static readonly supportedExtensions: { [extension: string]: boolean } = {
		".aac": true,
		".flac": true,
		".mp3": true,
		".ogg": true,
		".wav": true
	};

	public static readonly concatenatedSupportedExtensions = (function () {
		let c = "";
		for (let ext in FileUtils.supportedExtensions)
			c = (c ? (c + "," + ext) : ext)
		return c;
	})();

	public static isTypeSupported(urlOrAbsolutePath: string): boolean {
		const i = urlOrAbsolutePath.lastIndexOf(".");
		if (i < 0)
			return false;

		const ext = urlOrAbsolutePath.substring(i);
		return (FileUtils.supportedExtensions[ext] || FileUtils.supportedExtensions[ext.toLowerCase()] || false);
	}

	public static urlOrPathToURL(urlOrAbsolutePath: string): string {
		return ((!urlOrAbsolutePath || urlOrAbsolutePath.startsWith(FileUtils.httpURLPrefix) || urlOrAbsolutePath.startsWith(FileUtils.fileURLPrefix) || urlOrAbsolutePath.startsWith(FileUtils.localURLPrefix)) ? urlOrAbsolutePath :
			FileUtils.pathToURL(urlOrAbsolutePath)
		);
	}

	public static pathToURL(absolutePath: string): string {
		// encodeURIComponent() encodes all special characters, which includes : / and #.
		// On the other hand, encodeURI() encodes several special characters, but preserves : / and #, and
		// Android does not like a file URL containing #'s...
		return encodeURI((absolutePath.charCodeAt(0) === 0x2F) ? (FileUtils.fileURLPrefix + absolutePath) : (FileUtils.fileURLPrefixWindows + absolutePath.replace(FileUtils.regExpSepWindows, "/")))
			.replace(FileUtils.regExpHash, "%23");
	}

	public static nameFromLinuxPath(path: string): string {
		if (!path) return path;
		let i = path.lastIndexOf("/");
		return ((i >= 0) ? path.substring(i + 1) : path);
	}
}
