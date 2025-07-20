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

class FilePickerListAdapter extends ListAdapter<FilePickerListItem> {
	public constructor(list: List<FilePickerListItem>) {
		super(list);
	}

	public get itemHeight(): number {
		return AppUI.buttonSizePX;
	}

	public createEmptyElement(baseClass: string): HTMLElement {
		const div = document.createElement("div");
		div.className = baseClass;

		ButtonControl.create({
			text: Strings.Selected,
			square: true,
			checkable: true,
			checkbox0Color: "pink",
			checkbox1Color: "green",
			unfocusable: true,
			parent: div
		}).dataset["check"] = "1";

		ButtonControl.create({
			iconName: "icon-clear",
			text: Strings.Delete,
			color: "red",
			square: true,
			unfocusable: true,
			className: "no-left-margin",
			parent: div
		}).dataset["delete"] = "1";

		div.appendChild(Icon.create("icon-folder", "orange", true, "button-top-margin margin", null, Strings.FolderLabel));
		div.appendChild(Icon.create("icon-add-folder", "green", true, "button-top-margin margin left-margin"));
		div.appendChild(document.createTextNode(Formatter.none));

		return div;
	}

	public prepareElement(item: FilePickerListItem, index: number, length: number, element: HTMLElement): void {
		const childNodes = element.childNodes;

		if (item.root) {
			(childNodes[0] as HTMLElement).classList.add("hidden");
			if (!item.path)
				(childNodes[3] as HTMLElement).classList.remove("hidden");
			else
				(childNodes[3] as HTMLElement).classList.add("hidden");
		} else {
			const checkboxButton = (childNodes[0] as ButtonControl);
			checkboxButton.classList.remove("hidden");
			if (item.dir)
				checkboxButton.classList.remove("small-right-margin");
			else
				checkboxButton.classList.add("small-right-margin");
			checkboxButton.checked = item.selected as boolean;
			(childNodes[3] as HTMLElement).classList.add("hidden");
		}

		if (item.deletable)
			(childNodes[1] as HTMLElement).classList.remove("hidden");
		else
			(childNodes[1] as HTMLElement).classList.add("hidden");

		if (item.dir) {
			const folderIcon = (childNodes[2] as HTMLElement);
			folderIcon.classList.remove("hidden");
			if (item.root && !item.deletable)
				folderIcon.classList.add("left-margin");
			else
				folderIcon.classList.remove("left-margin");
		} else {
			(childNodes[2] as HTMLElement).classList.add("hidden");
		}

		(childNodes[4] as Text).nodeValue = item.name;
	}

	public prepareElementIndexOrLengthChanged(item: FilePickerListItem, index: number, length: number, element: HTMLElement): void {
	}
}

interface FilePickerQueueItem {
	play: boolean;
	files: File[] | string[] | null;
}

class FilePicker {
	private static _filePicker: FilePicker | null = null;

	public static lastPath: string | null = null;
	public static lastRootLength = 0;

	public static isSupported(): boolean {
		return (!!App.hostInterface || FileSystemAPI.isSupported());
	}

	public static get visible(): boolean {
		return !!FilePicker._filePicker;
	}

	public static show(returnFocusElement?: HTMLElement | null): Promise<File[] | string[] | null> {
		if (FilePicker._filePicker || Modal.visible)
			return Promise.resolve(null);

		return new Promise(function (resolve) {
			FilePicker._filePicker = new FilePicker(resolve, returnFocusElement);
		});
	}

	public static showAddPlay(returnFocusElement?: HTMLElement | null): (() => Promise<FilePickerQueueItem | null>) | null {
		if (FilePicker._filePicker || Modal.visible)
			return null;

		let closed = false;
		let queue: FilePickerQueueItem[] = [];
		let lastResolve: ((value: FilePickerQueueItem | PromiseLike<FilePickerQueueItem | null> | null) => void) | null = null;

		FilePicker._filePicker = new FilePicker(function () {
			closed = true;
			if (lastResolve) {
				lastResolve(null);
				lastResolve = null;
			}
		}, returnFocusElement, function (queueItem) {
			if (lastResolve) {
				lastResolve(queueItem);
				lastResolve = null;
			} else {
				queue.push(queueItem);
			}
		});

		return function () {
			if (queue.length) {
				const r = queue.pop() as FilePickerQueueItem;
				return Promise.resolve(r);
			}

			if (!closed)
				return new Promise(function (resolve) {
					lastResolve = resolve;
				});

			return Promise.resolve(null);
		};
	}

	private readonly _callback: ((queueItem: FilePickerQueueItem) => void) | null;
	private readonly _resolve: (value: File[] | PromiseLike<File[] | null> | null) => void;
	private readonly _provider: FilePickerProvider;
	private readonly _list: List<FilePickerListItem>;
	private readonly _listAdapter: FilePickerListAdapter;
	private readonly _listControl: ListControl<FilePickerListItem>;
	private readonly _iconFolder: HTMLElement;
	private readonly _iconLoading: HTMLElement;
	private readonly _pathElement: HTMLDivElement;

	private readonly _boundRefreshRoot: any;

	private _selectedFiles: File[] | null;
	private _gettingFiles: boolean;
	private _fading: boolean;
	private _providerVersion: number;
	private _path: string | null;
	private _rootLength: number;

	private constructor(resolve: (value: File[] | PromiseLike<File[] | null> | null) => void, returnFocusElement?: HTMLElement | null, callback?: ((queueItem: FilePickerQueueItem) => void) | null) {
		const header = document.createElement("div");

		const headerLabel = Strings.createSrOnlyText(Strings.AddSongs);
		header.appendChild(headerLabel);

		ButtonControl.create({
			color: "orange",
			iconName: "icon-up",
			text: Strings.Up,
			parent: header,
			onclick: this.navigateUp.bind(this),
		});

		ButtonControl.create({
			iconName: "icon-checkbox-1",
			text: Strings.All,
			parent: header,
			onclick: this.toggleAll.bind(this),
		});

		const pathDiv = document.createElement("div");
		pathDiv.className = "file-picker-path padding bottom-border left";
		pathDiv.ariaAtomic = "true";
		pathDiv.ariaLive = "assertive";
		(pathDiv as any).ariaRelevant = "all";

		const iconFolder = Icon.create("icon-folder-open", "orange", true, "hidden", null, Strings.CurrentPathLabel);
		pathDiv.appendChild(iconFolder);

		const iconLoading = document.createElement("i");
		iconLoading.className = "icon loading large";
		iconLoading.appendChild(Strings.createSrOnlyText(Strings.LoadingCurrentPathLabel));

		pathDiv.appendChild(iconLoading);

		const pathElement = document.createElement("div");
		pathElement.className = "file-picker-path-element small-left-padding";
		pathDiv.appendChild(pathElement);

		const listElement = document.createElement("f-list") as ListControl<FilePickerListItem>;
		listElement.className = "full-height-list fade";

		this._callback = callback || null;
		this._resolve = resolve;
		this._provider = ((App.hostType === App.hostTypeAndroid) ? new FilePickerAndroidProvider() : new FilePickerFileSystemAPIProvider());
		this._list = new List();
		this._listAdapter = new FilePickerListAdapter(this._list);
		this._listControl = listElement;
		this._listControl.addEventListener("keydown", this.listKeyDown.bind(this));
		this._listControl.onitemclick = this.itemClick.bind(this);
		this._listControl.onitemcontrolclick = this.itemControlClick.bind(this);
		this._listControl.adapter = this._listAdapter;

		this._selectedFiles = null;
		this._gettingFiles = false;
		this._fading = false;
		this._providerVersion = 0;
		this._path = FilePicker.lastPath;
		this._rootLength = FilePicker.lastRootLength;
		this._iconFolder = iconFolder;
		this._iconLoading = iconLoading;
		this._pathElement = pathElement;

		this._boundRefreshRoot = this.refreshRoot.bind(this);

		this.updatePathElement(this._path);

		const options: ModalOptions = {
			html: [pathDiv, listElement],
			title: header,
			titleHeader: headerLabel,
			returnFocusElement,
			skipBody: true,
			fullHeight: true,
			onshown: this.modalShown.bind(this),
			onhiding: this.modalHiding.bind(this),
			onhidden: this.modalHidden.bind(this)
		};

		if (this._callback) {
			options.buttons = [
				{
					id: "cancel",
					defaultCancel: true,
					iconName: "icon-clear",
					text: Strings.Close,
					color: "red",
					onclick: Modal.hide
				},
				{
					id: "add",
					iconName: "icon-add",
					text: Strings.Add,
					color: "green",
					onclick: () => this.modalOk(false)
				},
				{
					id: "play",
					iconName: "icon-play",
					text: Strings.Play,
					color: "blue",
					onclick: () => this.modalOk(true)
				}
			];
		} else {
			options.okCancel = true;
			options.onok = () => this.modalOk(false);
		}

		if (!Modal.show(options))
			throw new Error("Assertion error: Modal.show() === false");
	}

	private updatePathElement(path: string | null): string | null {
		if (path && path.endsWith("/"))
			path = path.substring(0, path.length - 1);

		Strings.changeText(this._pathElement, path || Strings.Storage);

		return path;
	}

	private updateIconLoading(loading: boolean): void {
		if (!this._iconFolder || !this._iconLoading)
			return;

		if (loading) {
			this._iconFolder.classList.add("hidden");
			this._iconLoading.classList.remove("hidden");
		} else {
			this._iconLoading.classList.add("hidden");
			this._iconFolder.classList.remove("hidden");
		}
	}

	private listKeyDown(e: KeyboardEvent): any {
		if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.repeat || e.key !== "Backspace")
			return;

		this.navigateUp();
	}

	private itemClick(item: FilePickerListItem, index: number, button: number): void {
		if (this._gettingFiles || this._fading)
			return;

		if (item.root && !item.path && this._provider.editableRoots()) {
			this.updateIconLoading(true);
			this._provider.addNewRoot().then(this._boundRefreshRoot, this._boundRefreshRoot);
		} else if (item.dir) {
			this.navigate(item.path);
		} else if (this._listControl) {
			item.selected = !item.selected;
			this._listControl.refreshVisibleItems();
		}
	}

	private itemControlClick(item: FilePickerListItem, index: number, button: number, target: HTMLElement): void {
		if (this._gettingFiles || this._fading)
			return;

		if (target.tagName === "SPAN") {
			target = target.parentNode as HTMLElement;
			if (!target)
				return;
		}

		if (target.classList.contains("f-list-item")) {
			const childNodes = target.getElementsByTagName("f-button") as HTMLCollectionOf<ButtonControl>;
			for (let i = 0; i < childNodes.length; i++) {
				const childNode = childNodes[i];
				if (childNode.classList.contains("hidden"))
					continue;
				target = childNode;
				if (target.dataset["check"])
					(target as ButtonControl).checked = !(target as ButtonControl).checked;
				break;
			}
		}

		if (target.dataset["check"]) {
			item.selected = (target as ButtonControl).checked;
		} else if (target.dataset["delete"]) {
			this.updateIconLoading(true);
			this._provider.removeRoot(item).then(this._boundRefreshRoot, this._boundRefreshRoot);
		}
	}

	private refreshRoot(refresh?: boolean | null): void {
		if (!this._path) {
			if (refresh === true)
				this.navigate(null);
			else
				this.updateIconLoading(false);
		}
	}

	private finishNavigation(items: FilePickerListItem[]): void {
		if (!this._path && this._provider.editableRoots())
			items.push({
				name: Strings.AddMoreFolders,
				dir: 0,
				path: "",
				root: true,
				deletable: false
			});

		this.updateIconLoading(false);

		if (items.length) {
			this._list.addItems(items);
			this._listControl.classList.add("in");
		}
	}

	private navigate(path: string | null): void {
		if (FilePicker._filePicker !== this || this._gettingFiles || this._fading)
			return;

		const leavingRoot = !this._path;

		this._path = path = this.updatePathElement(path);

		if (leavingRoot)
			this._rootLength = (path ? path.length : 0);

		this._providerVersion++;
		const providerVersion = this._providerVersion;

		this.updateIconLoading(true);

		let returnedItems: FilePickerListItem[] | null = null;

		if (this._listControl.classList.contains("in")) {
			this._fading = true;

			this._listControl.classList.remove("in");

			DelayControl.delayFadeCB(() => {
				if (FilePicker._filePicker !== this || !this._provider || providerVersion !== this._providerVersion)
					return;

				this._list.clear();

				this._fading = false;

				if (returnedItems)
					this.finishNavigation(returnedItems);
			});
		}

		this._provider.navigate(path).then((items) => {
			if (FilePicker._filePicker !== this || !this._provider || providerVersion !== this._providerVersion)
				return;

			returnedItems = items || [];

			if (!this._fading)
				this.finishNavigation(returnedItems);
		}, (reason) => {
			if (FilePicker._filePicker !== this || !this._provider || providerVersion !== this._providerVersion)
				return;

			this.updateIconLoading(false);

			Alert.show(reason.message || (((typeof reason.error) === "string") ? reason.error : ((reason.error && reason.error.message) || reason.toString())), true);
		});
	}

	private navigateUp(): void {
		let path = this._path,
			i: number;

		if (!path || (i = path.lastIndexOf('/')) <= 0) {
			this.navigate(null);
		} else {
			path = path.substring(0, i);
			this.navigate((path.length < this._rootLength) ? null : path);
		}
	}

	private toggleAll(): void {
		if (FilePicker._filePicker !== this || this._gettingFiles || this._fading)
			return;

		const list = this._list;

		let selected = false;

		for (let i = list.length - 1; i >= 0; i--) {
			if (!list.item(i).selected) {
				selected = true;
				break;
			}
		}

		for (let i = list.length - 1; i >= 0; i--)
			list.item(i).selected = selected;

		this._listControl.refreshVisibleItems();
	}

	private modalShown(): HTMLElement | null {
		this.navigate(this._path);

		return this._listControl;
	}

	private modalHiding(): boolean {
		if (FilePicker._filePicker !== this)
			return true;

		FilePicker._filePicker = null;

		if (this._provider)
			this._provider.destroy();

		return true;
	}

	private modalHidden(): void {
		const resolve = this._resolve,
			selectedFiles = this._selectedFiles;

		this._selectedFiles = null;

		zeroObject(this);

		if (resolve)
			resolve(selectedFiles);
	}

	private modalOk(play: boolean): void {
		if (FilePicker._filePicker !== this || this._gettingFiles || this._fading)
			return;

		const selectedDirectories: FilePickerListItem[] = [],
			selectedFiles: FilePickerListItem[] = [],
			list = this._list,
			length = list.length;

		if (this._path) {
			for (let i = 0; i < length; i++) {
				const item = list.item(i);

				if (item.selected)
					(item.dir ? selectedDirectories : selectedFiles).push(item);
			}
		}

		if (!this._path || (!selectedDirectories.length && !selectedFiles.length)) {
			Alert.show(Strings.NothingSelected);
			return;
		}

		FilePicker.lastPath = this._path;
		FilePicker.lastRootLength = this._rootLength;

		this._gettingFiles = true;

		this._providerVersion++;
		const providerVersion = this._providerVersion;

		this.updateIconLoading(true);

		this._provider.getFiles(selectedDirectories, selectedFiles).then((files) => {
			if (FilePicker._filePicker !== this || !this._provider || providerVersion !== this._providerVersion)
				return;

			if (this._callback) {
				const list = this._list;

				for (let i = list.length - 1; i >= 0; i--)
					list.item(i).selected = false;

				this._listControl.refreshVisibleItems();

				this.updateIconLoading(false);

				this._gettingFiles = false;

				this._callback({
					play,
					files
				});

				return;
			}

			this._selectedFiles = files;

			Modal.hide();
		}, (reason) => {
			if (FilePicker._filePicker !== this || !this._provider || providerVersion !== this._providerVersion)
				return;

			this.updateIconLoading(false);

			this._gettingFiles = false;

			Alert.show(reason.message || (((typeof reason.error) === "string") ? reason.error : ((reason.error && reason.error.message) || reason.toString())), true);
		});
	}
}
