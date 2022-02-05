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

class FilePickerAndroidProvider implements FilePickerProvider {
	public static callback: ((enumerationVersion: number, filePaths: string[] | null) => void) | null = null;
	private static callbackPermissionResolve: ((permissionGranted: boolean) => void) | null = null;
	private static permissionGranted = false;

	public static callbackPermission(permissionGranted: number): void {
		FilePickerAndroidProvider.permissionGranted = !!permissionGranted;

		if (FilePickerAndroidProvider.callbackPermissionResolve) {
			FilePickerAndroidProvider.callbackPermissionResolve(FilePickerAndroidProvider.permissionGranted);
			FilePickerAndroidProvider.callbackPermissionResolve = null;
		}
	}

	private static checkPermission(): Promise<boolean> {
		if (FilePickerAndroidProvider.callbackPermissionResolve) {
			FilePickerAndroidProvider.callbackPermissionResolve(false);
			FilePickerAndroidProvider.callbackPermissionResolve = null;
		}

		if (!App.hostInterface)
			return Promise.resolve(false);

		if (App.hostInterface.checkFilePermission()) {
			FilePickerAndroidProvider.permissionGranted = true;
			return Promise.resolve(true);
		}

		return new Promise(function (resolve) {
			if (!App.hostInterface) {
				resolve(false);
				return;
			}

			FilePickerAndroidProvider.callbackPermissionResolve = resolve;

			App.hostInterface.requestFilePermission();
		});
	}

	private version: number;
	private enumerationVersion: number;

	public constructor() {
		this.version = 0;
		this.enumerationVersion = 0;
	}

	public editableRoots(): boolean {
		return false;
	}

	public addNewRoot(): Promise<boolean> {
		return Promise.resolve(false);
	}

	public removeRoot(root: FilePickerListItem): Promise<boolean> {
		return Promise.resolve(false);
	}

	// File paths should start with "/", but not directory paths!
	private enumerate(path: string | null): Promise<string[] | null> {
		this.enumerationVersion++;

		if (FilePickerAndroidProvider.callback) {
			FilePickerAndroidProvider.callback(0, null);
			FilePickerAndroidProvider.callback = null;
		}

		return new Promise((resolve) => {
			if (!App.hostInterface)
				return null;

			FilePickerAndroidProvider.callback = (enumerationVersion, filePaths) => {
				if (enumerationVersion !== this.enumerationVersion) {
					resolve(null);
				} else {
					FilePickerAndroidProvider.callback = null;
					resolve(filePaths);
				}
			};

			App.hostInterface.enumerateFiles(this.enumerationVersion, path);
		});
	}

	private async getDirectoryFiles(version: number, filePaths: string[], directoryPath: string): Promise<void> {
		const paths = await this.enumerate(directoryPath);

		if (!paths || version !== this.version)
			return;

		const comparer = Strings.comparer;

		paths.sort(function (a, b) {
			const aFile = (a.charCodeAt(0) === 0x2F),
				bFile = (b.charCodeAt(0) === 0x2F);
			return ((aFile === bFile) ? comparer(a, b) : (aFile ? 1 : -1));
		});

		for (let i = 0; i < paths.length && version === this.version; i++) {
			const path = paths[i];

			if (path.charCodeAt(0) === 0x2F)
				filePaths.push(path);
			else
				await this.getDirectoryFiles(version, filePaths, path);
		}
	};

	public async getFiles(directories: FilePickerListItem[] | null, files: FilePickerListItem[] | null): Promise<File[] | null> {
		this.cancel();

		const filePaths: string[] = [],
			version = this.version,
			// We must call this as soon as possible, to try to prevent the error
			// "File chooser dialog can only be shown with a user activation".
			// This error occurs if the call to input.click() happens a few seconds
			// after the actual click, or if it happens outside its call stack.
			promise = App.showOpenDialogWeb(false, true);

		if (directories)
			for (let i = 0; i < directories.length && version === this.version; i++)
				await this.getDirectoryFiles(version, filePaths, directories[i].path);

		if (files && version === this.version) {
			for (let i = 0; i < files.length; i++)
				filePaths.push(files[i].path);
		}

		if (!App.hostInterface || !filePaths.length)
			return null;

		for (let i = filePaths.length - 1; i >= 0; i--)
			filePaths[i] = FileUtils.fileURLPrefix + encodeURI(filePaths[i]);

		App.hostInterface.setFileURLs(filePaths);

		const returnedFiles = await promise;

		if (!returnedFiles || returnedFiles.length !== filePaths.length || version !== this.version)
			return null;

		for (let i = filePaths.length - 1; i >= 0; i--)
			(returnedFiles[i] as any)["data-path"] = filePaths[i];

		return returnedFiles;
	}

	public async navigate(path: string | null): Promise<FilePickerListItem[] | null> {
		this.cancel();

		const version = this.version;

		if (!FilePickerAndroidProvider.permissionGranted && !await FilePickerAndroidProvider.checkPermission())
			return null;

		if (version !== this.version)
			return null;

		const paths = await this.enumerate(path);

		if (!paths || !paths.length || version !== this.version)
			return null;

		const items: FilePickerListItem[] = new Array(paths.length);

		if (!path) {
			for (let i = items.length - 1; i >= 0; i--) {
				const path = paths[i],
					sep = path.indexOf(FileUtils.separator);
	
				items[i] = {
					name: ((sep > 0) ? path.substring(0, sep) : Formatter.none),
					dir: 1,
					path: ((sep > 0) ? path.substring(sep + 1) : path),
					root: true
				};
			}
		} else {
			for (let i = items.length - 1; i >= 0; i--) {
				const path = paths[i];
	
				items[i] = {
					name: FileUtils.nameFromLinuxPath(path),
					dir: ((path.charCodeAt(0) === 0x2F) ? 0 : 1),
					path
				};
			}
		}

		const comparer = Strings.comparer;

		items.sort(function (a, b) { return ((a.dir === b.dir) ? comparer(a.name, b.name) : (b.dir - a.dir)); });

		return items;
	}

	public cancel(): void {
		this.version++;
		this.enumerationVersion++;
	}

	public destroy(): void {
		if (App.hostInterface)
			App.hostInterface.cancelFileEnumeration(this.enumerationVersion);

		this.cancel();
	}
}
