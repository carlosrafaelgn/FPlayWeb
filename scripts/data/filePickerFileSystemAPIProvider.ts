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

class FilePickerFileSystemAPIProvider implements FilePickerProvider {
	private version: number;

	public constructor() {
		this.version = 0;
	}

	public editableRoots(): boolean {
		return true;
	}

	public addNewRoot(): Promise<boolean> {
		return FileSystemAPI.addNewRoot();
	}

	public removeRoot(root: FilePickerListItem): Promise<boolean> {
		return FileSystemAPI.removeRoot(root.name);
	}

	private async getDirectoryFiles(version: number, files: File[], directoryPath: string, directoryHandle: FileSystemDirectoryHandle): Promise<void> {
		const items = await FileSystemAPI.enumerate(directoryPath, directoryHandle);

		if (!items || version !== this.version)
			return;

		const comparer = Strings.comparer;

		items.sort(function (a, b) { return ((a.kind === b.kind) ? comparer(a.name, b.name) : ((a.kind === "file") ? 1 : -1)); });

		if (!directoryPath.endsWith("/"))
			directoryPath += "/";

		for (let i = 0; i < items.length && version === this.version; i++) {
			const item = items[i],
				itemPath = directoryPath + item.name;

			if (item.kind === "file") {
				const file = await FileSystemAPI.getFile(itemPath, items[i] as FileSystemFileHandle);
				if (file) {
					(file as any)["data-path"] = FileUtils.localURLPrefix + itemPath;
					files.push(file);
				}
			} else {
				await this.getDirectoryFiles(version, files, itemPath, item as FileSystemDirectoryHandle);
			}
		}
	};

	public async getFiles(directories: FilePickerListItem[] | null, files: FilePickerListItem[] | null): Promise<File[] | null> {
		this.cancel();

		const items: File[] = [],
			version = this.version;

		if (directories) {
			for (let i = 0; i < directories.length && version === this.version; i++)
				await this.getDirectoryFiles(version, items, directories[i].path, directories[i].handle as FileSystemDirectoryHandle);
		}

		if (files) {
			for (let i = 0; i < files.length && version === this.version; i++) {
				const path = files[i].path,
					file = await FileSystemAPI.getFile(path, files[i].handle as FileSystemFileHandle);

				if (file) {
					(file as any)["data-path"] = FileUtils.localURLPrefix + path;
					items.push(file);
				}
			}
		}

		return items;
	}

	public async navigate(path: string | null): Promise<FilePickerListItem[] | null> {
		this.cancel();

		if (!path) {
			const rootHandles = FileSystemAPI.getRootHandles(),
				items: FilePickerListItem[] = new Array(rootHandles.length);

			for (let i = rootHandles.length - 1; i >= 0; i--)
				items[i] = {
					name: rootHandles[i].name,
					dir: 1,
					path: rootHandles[i].name,
					root: true,
					deletable: true,
					handle: rootHandles[i]
				};

			return items;
		}

		const version = this.version,
			systemHandles = await FileSystemAPI.enumerate(path);

		if (!systemHandles || !systemHandles.length || version !== this.version)
			return null;

		if (!path.endsWith("/"))
			path += "/";

		const items: FilePickerListItem[] = new Array(systemHandles.length);
		for (let i = systemHandles.length - 1; i >= 0; i--)
			items[i] = {
				name: systemHandles[i].name,
				dir: (systemHandles[i].kind === "file" ? 0 : 1),
				path: path + systemHandles[i].name,
				handle: systemHandles[i]
			};

		const comparer = Strings.comparer;

		items.sort(function (a, b) { return ((a.dir === b.dir) ? comparer(a.name, b.name) : (b.dir - a.dir)); });

		return items;
	}

	public cancel(): void {
		this.version++;
	}

	public destroy(): void {
		this.cancel();
	}
}
