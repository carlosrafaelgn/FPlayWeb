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

// TypeScript lacked these declarations in 2022/10

interface FileSystemHandle {
	queryPermission(descriptor: any): Promise<string>;
	requestPermission(descriptor: any): Promise<string>;
}

// This declaration is not 100%, but works... :)
interface FileSystemDirectoryHandle extends FileSystemHandle, Array<Promise<FileSystemHandle>> {
}

class FileSystemAPI {
	public static isSupported(): boolean {
		return (("FileSystemHandle" in window) && ("showDirectoryPicker" in window));
	}

	private static readonly _dbName = "fplay";
	private static readonly _dbStoreName = "fplay-roots";

	private static readonly _roots: [string, FileSystemDirectoryHandle][] = [];
	private static readonly _directoryHandles: Map<string, FileSystemDirectoryHandle> = new Map();

	private static openDatabase<T>(mode: IDBTransactionMode, callback: (db: IDBDatabase, store: IDBObjectStore, close: (value?: T | null, error?: any) => void) => void): Promise<T> {
		return new Promise<T>(function (resolve, reject) {
			let db: IDBDatabase | null = null;

			function close(value?: T | null, error?: any): void {
				if (db) {
					try {
						db.close();
					} catch (ex: any) {
						// Just ignore...
					}
				}

				if (error)
					reject(error);
				else
					resolve(value as any);
			}

			try {
				const request = indexedDB.open(FileSystemAPI._dbName);
				request.onupgradeneeded = function () { request.result.createObjectStore(FileSystemAPI._dbStoreName); };
				request.onsuccess = function () {
					db = request.result;

					try {
						callback(db, db.transaction(FileSystemAPI._dbStoreName, mode).objectStore(FileSystemAPI._dbStoreName), close);
					} catch (ex: any) {
						close(null, ex);
					}
				};
				request.onerror = function () { close(null, request.error); };
			} catch (ex: any) {
				close(null, ex);
			}
		});
	}

	public static init(): Promise<void> {
		return FileSystemAPI.openDatabase("readonly", function (db, store, close) {
			const request = store.openCursor();
			request.onsuccess = function () {
				const cursor = request.result;
				if (!cursor) {
					const comparer = Strings.comparer;
					FileSystemAPI._roots.sort(function (a, b) { return comparer(a[0], b[0]); });
					close();
					return;
				}

				const key = cursor.key.toString(),
					value = cursor.value as FileSystemDirectoryHandle;

				if (key && value) {
					FileSystemAPI._roots.push([key, value]);
					FileSystemAPI._directoryHandles.set(key, value);
				}

				cursor.continue();
			};
			request.onerror = function () { close(null, request.error); };
		});
	}

	public static async addNewRoot(): Promise<boolean> {
		try {
			const directoryHandle = await ((window as any).showDirectoryPicker() as Promise<FileSystemDirectoryHandle>);
			if (directoryHandle) {
				await FileSystemAPI.addRoot(directoryHandle);
				return true;
			}
		} catch (ex: any) {
			// Just ignore...
		}

		return false;
	}

	public static addRoot(directoryHandle: FileSystemDirectoryHandle): Promise<void> {
		if (!directoryHandle)
			return Promise.resolve();

		return FileSystemAPI.openDatabase("readwrite", function (db, store, close) {
			store.put(directoryHandle, directoryHandle.name);

			const transaction = store.transaction;

			transaction.onabort = function () { close(); };
			transaction.oncomplete = function () {
				const roots = FileSystemAPI._roots,
					name = directoryHandle.name;

				let found = false;

				for (let i = roots.length - 1; i >= 0; i--) {
					if (roots[i][0] === name) {
						roots[i][1] = directoryHandle;
						found = true;
						break;
					}
				}

				if (!found) {
					const comparer = Strings.comparer;
					roots.push([name, directoryHandle]);
					roots.sort(function (a, b) { return comparer(a[0], b[0]); });
				}

				FileSystemAPI._directoryHandles.set(name, directoryHandle);

				close();
			};
			transaction.onerror = function () { close(null, transaction.error); };
		});
	}

	public static removeRoot(name: string): Promise<boolean> {
		if (!name)
			return Promise.resolve(false);

		return FileSystemAPI.openDatabase("readwrite", function (db, store, close) {
			store.delete(name);

			const transaction = store.transaction;

			transaction.onabort = function () { close(); };
			transaction.oncomplete = function () {
				const roots = FileSystemAPI._roots;

				for (let i = roots.length - 1; i >= 0; i--) {
					if (roots[i][0] === name) {
						roots.splice(i, 1);
						break;
					}
				}

				close(true);
			};
			transaction.onerror = function () { close(null, transaction.error); };
		});
	}

	public static getRootHandles(): FileSystemDirectoryHandle[] {
		const roots = FileSystemAPI._roots,
			rootHandles: FileSystemDirectoryHandle[] = new Array(roots.length);

		for (let i = roots.length - 1; i >= 0; i--)
			rootHandles[i] = roots[i][1];

		return rootHandles;
	}

	private static async checkRootPermission(path: string): Promise<number> {
		if (!path)
			return 0;

		const i = path.indexOf("/");
		if (i > 0)
			path = path.substring(0, i);

		const directoryHandle = FileSystemAPI._directoryHandles.get(path);
		if (!directoryHandle)
			return 0;

		try {
			const descriptor = { mode: "read" },
				permission = await directoryHandle.queryPermission(descriptor);

			switch (permission) {
				case "granted":
					return 1;

				case "prompt":
					return ((await directoryHandle.requestPermission(descriptor) === "granted") ? -1 : 0);

				default:
					return 0;
			}
		} catch (ex: any) {
			return 0;
		}
	}

	public static async getDirectoryHandle(path: string, parentHandle?: FileSystemDirectoryHandle | null): Promise<FileSystemDirectoryHandle | null> {
		let directoryHandle: FileSystemDirectoryHandle | null | undefined = FileSystemAPI._directoryHandles.get(path);
		if (directoryHandle)
			return directoryHandle;

		try {
			const i = path.lastIndexOf("/");
			if (i <= 0 || i >= (path.length - 1))
				return null;

			directoryHandle = (parentHandle || await FileSystemAPI.getDirectoryHandle(path.substring(0, i)));
			if (!directoryHandle)
				return null;

			directoryHandle = await directoryHandle.getDirectoryHandle(path.substring(i + 1));
			if (!directoryHandle)
				return null;

			FileSystemAPI._directoryHandles.set(path, directoryHandle);

			return directoryHandle;
		} catch (ex: any) {
			return ((await FileSystemAPI.checkRootPermission(path) < 0) ? FileSystemAPI.getDirectoryHandle(path) : null);
		}
	}

	public static async getFile(path: string, pathHandle?: FileSystemFileHandle | null): Promise<File | null> {
		try {
			if (pathHandle)
				return pathHandle.getFile();

			const i = path.lastIndexOf("/");
			if (i <= 0 || i >= (path.length - 1))
				return null;

			const directoryHandle = await FileSystemAPI.getDirectoryHandle(path.substring(0, i));
			if (!directoryHandle)
				return null;

			const fileHandle = await directoryHandle.getFileHandle(path.substring(i + 1));
			if (!fileHandle)
				return null;

			return fileHandle.getFile();
		} catch (ex: any) {
			return ((await FileSystemAPI.checkRootPermission(path) < 0) ? FileSystemAPI.getFile(path, pathHandle) : null);
		}
	}

	public static async enumerate(path: string, pathHandle?: FileSystemDirectoryHandle | null): Promise<FileSystemHandle[] | null> {
		try {
			const directoryHandle = (pathHandle || await FileSystemAPI.getDirectoryHandle(path));
			if (!directoryHandle)
				return null;

			const items: FileSystemHandle[] = [];

			for await (const item of directoryHandle.values()) {
				if (item.kind !== "file" || FileUtils.isTypeSupported(item.name))
					items.push(item);
			}

			return items;
		} catch (ex: any) {
			return ((await FileSystemAPI.checkRootPermission(path) < 0) ? FileSystemAPI.enumerate(path, pathHandle) : null);
		}
	}
}
