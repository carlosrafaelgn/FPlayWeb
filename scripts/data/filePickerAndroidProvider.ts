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
	private static _callbackPermissionResolve: ((permissionGranted: boolean) => void) | null = null;
	private static _callbackClickDoneResolve: (() => void) | null = null;
	private static _permissionGranted = false;

	public static callbackPermission(permissionGranted: number): void {
		FilePickerAndroidProvider._permissionGranted = !!permissionGranted;

		if (FilePickerAndroidProvider._callbackPermissionResolve) {
			FilePickerAndroidProvider._callbackPermissionResolve(FilePickerAndroidProvider._permissionGranted);
			FilePickerAndroidProvider._callbackPermissionResolve = null;
		}
	}

	public static callbackClickDone(): void {
		if (FilePickerAndroidProvider._callbackClickDoneResolve) {
			FilePickerAndroidProvider._callbackClickDoneResolve();
			FilePickerAndroidProvider._callbackClickDoneResolve = null;
		}
	}

	private static checkPermission(): Promise<boolean> {
		if (FilePickerAndroidProvider._callbackPermissionResolve) {
			FilePickerAndroidProvider._callbackPermissionResolve(false);
			FilePickerAndroidProvider._callbackPermissionResolve = null;
		}

		if (!App.hostInterface)
			return Promise.resolve(false);

		if (App.hostInterface.checkFilePermission()) {
			FilePickerAndroidProvider._permissionGranted = true;
			return Promise.resolve(true);
		}

		return new Promise(function (resolve) {
			if (!App.hostInterface) {
				resolve(false);
				return;
			}

			FilePickerAndroidProvider._callbackPermissionResolve = resolve;

			App.hostInterface.requestFilePermission();
		});
	}

	private _version: number;
	private _enumerationVersion: number;

	public constructor() {
		this._version = 0;
		this._enumerationVersion = 0;
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
		this._enumerationVersion++;

		if (FilePickerAndroidProvider.callback) {
			FilePickerAndroidProvider.callback(0, null);
			FilePickerAndroidProvider.callback = null;
		}

		return new Promise((resolve) => {
			if (!App.hostInterface)
				return null;

			FilePickerAndroidProvider.callback = (enumerationVersion, filePaths) => {
				if (enumerationVersion !== this._enumerationVersion) {
					resolve(null);
				} else {
					FilePickerAndroidProvider.callback = null;
					resolve(filePaths);
				}
			};

			App.hostInterface.enumerateFiles(this._enumerationVersion, path);
		});
	}

	private async getDirectoryFiles(version: number, filePaths: string[], directoryPath: string): Promise<void> {
		const paths = await this.enumerate(directoryPath);

		if (!paths || version !== this._version)
			return;

		const comparer = Strings.comparer;

		paths.sort(function (a, b) {
			const aFile = (a.charCodeAt(0) === 0x2F),
				bFile = (b.charCodeAt(0) === 0x2F);
			return ((aFile === bFile) ? comparer(a, b) : (aFile ? 1 : -1));
		});

		for (let i = 0; i < paths.length && version === this._version; i++) {
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
			version = this._version,
			// The Promise's executor function runs before the constructor returns, so this is safe!
			promiseClickReady = new Promise<void>(function (resolve) { FilePickerAndroidProvider._callbackClickDoneResolve = resolve; }),
			// We must call this as soon as possible, to try to prevent the error
			// "File chooser dialog can only be shown with a user activation".
			// This error occurs if the call to input.click() happens a few seconds
			// after the actual click, or if it happens outside its call stack.
			promise = App.showOpenDialogWeb(false, true);

		await promiseClickReady;

		if (!App.hostInterface || version !== this._version)
			return null;

		if (directories)
			for (let i = 0; i < directories.length && version === this._version; i++)
				await this.getDirectoryFiles(version, filePaths, directories[i].path);

		if (files && version === this._version) {
			for (let i = 0; i < files.length; i++)
				filePaths.push(files[i].path);
		}

		if (!App.hostInterface || !filePaths.length)
			return null;

		for (let i = filePaths.length - 1; i >= 0; i--)
			filePaths[i] = FileUtils.pathToURL(filePaths[i]);

		App.hostInterface.setFileURLs(filePaths);

		const returnedFiles = await promise;

		if (!returnedFiles || returnedFiles.length !== filePaths.length || version !== this._version)
			return null;

		for (let i = filePaths.length - 1; i >= 0; i--)
			(returnedFiles[i] as any)["data-path"] = filePaths[i];

		return returnedFiles;
	}

	public async navigate(path: string | null): Promise<FilePickerListItem[] | null> {
		this.cancel();

		const version = this._version;

		if (!FilePickerAndroidProvider._permissionGranted && !await FilePickerAndroidProvider.checkPermission())
			return null;

		if (version !== this._version)
			return null;

		const paths = await this.enumerate(path);

		if (!paths || !paths.length || version !== this._version)
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
		this._version++;
		this._enumerationVersion++;

		FilePickerAndroidProvider.callbackClickDone();
	}

	public destroy(): void {
		this.cancel();

		if (App.hostInterface)
			App.hostInterface.cancelFileEnumeration(this._enumerationVersion);
	}
}
