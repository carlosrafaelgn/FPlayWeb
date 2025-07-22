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

interface SupportedExtensionInfo {
	extension: string;
	mimeType: string;
	customProvider: CustomProvider | null;
}

class FileUtils {
	public static readonly separator = "\u0004";
	public static readonly httpURLPrefix = "http";
	public static readonly fileURLPrefix = "file://";
	public static readonly localURLPrefix = "local://";
	private static readonly _fileURLPrefixWindows = "file:///";
	private static readonly _regExpSepWindows = /\\/g;
	private static readonly _regExpHash = /\#/g;

	private static readonly supportedExtensions: Map<string, SupportedExtensionInfo> = new Map([
		[".aac", { extension: ".aac", mimeType: "audio/aac", customProvider: null }],
		[".flac", { extension: ".flac", mimeType: "audio/flac", customProvider: null }],
		[".mp3", { extension: ".mp3", mimeType: "audio/mpeg", customProvider: null }],
		[".ogg", { extension: ".ogg", mimeType: "audio/ogg", customProvider: null }],
		[".wav", { extension: ".wav", mimeType: "audio/wav", customProvider: null }],
	]);

	public static concatenatedSupportedExtensions: string;

	public static init(): void {
		FileUtils.concatenatedSupportedExtensions = Array.from(FileUtils.supportedExtensions.keys()).join(",");
	}

	public static addSupportedExtension(extension: string, mimeType: string, customProvider: CustomProvider | null) {
		FileUtils.supportedExtensions.set(extension, { extension, mimeType, customProvider });
	}

	public static getSupportedExtensionInfoByPath(urlOrAbsolutePath: string): SupportedExtensionInfo | null {
		const i = urlOrAbsolutePath.lastIndexOf(".");
		if (i < 0)
			return null;

		const ext = urlOrAbsolutePath.substring(i);
		return (FileUtils.supportedExtensions.get(ext) || FileUtils.supportedExtensions.get(ext.toLowerCase()) || null);
	}

	public static getCustomProviderByExtension(extension: string): CustomProvider | null {
		const supportedExtension = FileUtils.supportedExtensions.get(extension);
		return (supportedExtension ? supportedExtension.customProvider : null);
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
		return encodeURI((absolutePath.charCodeAt(0) === 0x2F) ? (FileUtils.fileURLPrefix + absolutePath) : (FileUtils._fileURLPrefixWindows + absolutePath.replace(FileUtils._regExpSepWindows, "/")))
			.replace(FileUtils._regExpHash, "%23");
	}

	public static nameFromLinuxPath(path: string): string {
		if (!path) return path;
		let i = path.lastIndexOf("/");
		return ((i >= 0) ? path.substring(i + 1) : path);
	}
}
