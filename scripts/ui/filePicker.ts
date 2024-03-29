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

		CheckboxControl.create({
			stringKey: "Selected",
			checkbox0Color: "pink",
			checkbox1Color: "green",
			square: true,
			keyboardFocusable: false,
			parent: div
		}).setAttribute("data-check", "1");

		ButtonControl.create({
			icon: "icon-clear",
			text: Strings.Delete,
			color: "red",
			square: true,
			keyboardFocusable: false,
			className: "no-left-margin",
			parent: div
		}).setAttribute("data-delete", "1");

		div.appendChild(Icon.createLarge("icon-folder", "orange button-top-margin margin", null, Strings.FolderLabel));
		div.appendChild(Icon.createLarge("icon-add-folder", "green button-top-margin margin left-margin"));
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
			const checkboxButton = (childNodes[0] as HTMLLabelElement);
			checkboxButton.classList.remove("hidden");
			if (item.dir)
				checkboxButton.classList.remove("small-right-margin");
			else
				checkboxButton.classList.add("small-right-margin");
			CheckboxControl.setChecked(checkboxButton, item.selected);
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
	private static filePicker: FilePicker | null = null;

	public static lastPath: string | null = null;
	public static lastRootLength = 0;

	public static isSupported(): boolean {
		return (!!App.hostInterface || FileSystemAPI.isSupported());
	}

	public static get visible(): boolean {
		return !!FilePicker.filePicker;
	}

	public static show(returnFocusElement?: HTMLElement | null): Promise<File[] | string[] | null> {
		if (FilePicker.filePicker || Modal.visible)
			return Promise.resolve(null);

		return new Promise(function (resolve) {
			FilePicker.filePicker = new FilePicker(resolve, returnFocusElement);
		});
	}

	public static showAddPlay(returnFocusElement?: HTMLElement | null): (() => Promise<FilePickerQueueItem | null>) | null {
		if (FilePicker.filePicker || Modal.visible)
			return null;

		let closed = false;
		let queue: FilePickerQueueItem[] = [];
		let lastResolve: ((value: FilePickerQueueItem | PromiseLike<FilePickerQueueItem | null> | null) => void) | null = null;

		FilePicker.filePicker = new FilePicker(function () {
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

	private readonly callback: ((queueItem: FilePickerQueueItem) => void) | null;
	private readonly resolve: (value: File[] | PromiseLike<File[] | null> | null) => void;
	private readonly provider: FilePickerProvider;
	private readonly list: List<FilePickerListItem>;
	private readonly listAdapter: FilePickerListAdapter;
	private readonly listControl: ListControl<FilePickerListItem>;
	private readonly iconFolder: HTMLElement;
	private readonly iconLoading: HTMLElement;
	private readonly pathElement: HTMLDivElement;

	private readonly boundRefreshRoot: any;

	private selectedFiles: File[] | null;
	private gettingFiles: boolean;
	private fading: boolean;
	private providerVersion: number;
	private path: string | null;
	private rootLength: number;

	private constructor(resolve: (value: File[] | PromiseLike<File[] | null> | null) => void, returnFocusElement?: HTMLElement | null, callback?: ((queueItem: FilePickerQueueItem) => void) | null) {
		const header = document.createElement("div");

		const headerLabel = Strings.createSrOnlyText(Strings.AddSongs);
		header.appendChild(headerLabel);

		ButtonControl.create({
			color: "orange",
			icon: "icon-up",
			text: Strings.Up,
			parent: header,
			onclick: this.navigateUp.bind(this),
		});

		ButtonControl.create({
			icon: "icon-checkbox-1",
			text: Strings.All,
			parent: header,
			onclick: this.toggleAll.bind(this),
		});

		const pathDiv = document.createElement("div");
		pathDiv.className = "file-picker-path padding bottom-border left";
		pathDiv.setAttribute("aria-atomic", "true");
		pathDiv.setAttribute("aria-live", "assertive");
		pathDiv.setAttribute("aria-relevant", "all");

		const iconFolder = Icon.createLarge("icon-folder-open", "orange hidden", null, Strings.CurrentPathLabel);
		pathDiv.appendChild(iconFolder);

		const iconLoading = document.createElement("i");
		iconLoading.className = "icon loading large";
		iconLoading.appendChild(Strings.createSrOnlyText(Strings.LoadingCurrentPathLabel));

		pathDiv.appendChild(iconLoading);

		const pathElement = document.createElement("div");
		pathElement.className = "file-picker-path-element small-left-padding";
		pathDiv.appendChild(pathElement);

		const listElement = document.createElement("div");
		listElement.className = "file-picker-list fade";

		this.callback = callback || null;
		this.resolve = resolve;
		this.provider = ((App.hostType === App.hostTypeAndroid) ? new FilePickerAndroidProvider() : new FilePickerFileSystemAPIProvider());
		this.list = new List();
		this.listAdapter = new FilePickerListAdapter(this.list);
		this.listControl = new ListControl(listElement, Strings.FileList, true);
		this.listControl.element.addEventListener("keydown", this.listKeyDown.bind(this));
		this.listControl.onitemclick = this.itemClick.bind(this);
		this.listControl.onitemcontrolclick = this.itemControlClick.bind(this);
		this.listControl.adapter = this.listAdapter;

		this.selectedFiles = null;
		this.gettingFiles = false;
		this.fading = false;
		this.providerVersion = 0;
		this.path = FilePicker.lastPath;
		this.rootLength = FilePicker.lastRootLength;
		this.iconFolder = iconFolder;
		this.iconLoading = iconLoading;
		this.pathElement = pathElement;

		this.boundRefreshRoot = this.refreshRoot.bind(this);

		this.updatePathElement(this.path);

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

		if (this.callback) {
			options.buttons = [
				{
					id: "cancel",
					defaultCancel: true,
					icon: "icon-clear",
					text: Strings.Close,
					color: "red",
					onclick: Modal.hide
				},
				{
					id: "add",
					icon: "icon-add",
					text: Strings.Add,
					color: "green",
					onclick: () => this.modalOk(false)
				},
				{
					id: "play",
					icon: "icon-play",
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

		Strings.changeText(this.pathElement, path || Strings.Storage);

		return path;
	}

	private updateIconLoading(loading: boolean): void {
		if (!this.iconFolder || !this.iconLoading)
			return;

		if (loading) {
			this.iconFolder.classList.add("hidden");
			this.iconLoading.classList.remove("hidden");
		} else {
			this.iconLoading.classList.add("hidden");
			this.iconFolder.classList.remove("hidden");
		}
	}

	private listKeyDown(e: KeyboardEvent): any {
		if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.repeat || e.key !== "Backspace")
			return;

		this.navigateUp();
	}

	private itemClick(item: FilePickerListItem, index: number, button: number): void {
		if (this.gettingFiles || this.fading)
			return;

		if (item.root && !item.path && this.provider.editableRoots()) {
			this.updateIconLoading(true);
			this.provider.addNewRoot().then(this.boundRefreshRoot, this.boundRefreshRoot);
		} else if (item.dir) {
			this.navigate(item.path);
		} else if (this.listControl) {
			item.selected = !item.selected;
			this.listControl.refreshVisibleItems();
		}
	}

	private itemControlClick(item: FilePickerListItem, index: number, button: number, target: HTMLElement): void {
		if (this.gettingFiles || this.fading)
			return;

		if (target.tagName === "INPUT") {
			target = target.parentNode as HTMLElement;
			if (!target)
				return;
		}

		if (target.tagName === "SPAN") {
			target = target.parentNode as HTMLElement;
			if (!target)
				return;
		}

		if (target.classList.contains("list-item")) {
			const childNodes = target.childNodes;
			for (let i = 0; i < childNodes.length; i++) {
				if (childNodes[i] && (childNodes[i] as HTMLElement).tagName && !(childNodes[i] as HTMLElement).classList.contains("hidden")) {
					target = childNodes[i] as HTMLElement;
					if (target.getAttribute("data-check"))
						CheckboxControl.setChecked(target as HTMLLabelElement, !CheckboxControl.isChecked(target as HTMLLabelElement));
					break;
				}
			}
		}

		if (target.getAttribute("data-check")) {
			item.selected = CheckboxControl.isChecked(target as HTMLLabelElement);
		} else if (target.getAttribute("data-delete")) {
			this.updateIconLoading(true);
			this.provider.removeRoot(item).then(this.boundRefreshRoot, this.boundRefreshRoot);
		}
	}

	private refreshRoot(refresh?: boolean | null): void {
		if (!this.path) {
			if (refresh === true)
				this.navigate(null);
			else
				this.updateIconLoading(false);
		}
	}

	private finishNavigation(items: FilePickerListItem[]): void {
		if (!this.path && this.provider.editableRoots())
			items.push({
				name: Strings.AddMoreFolders,
				dir: 0,
				path: "",
				root: true,
				deletable: false
			});

		this.updateIconLoading(false);

		if (items.length) {
			this.list.addItems(items);
			this.listControl.element.classList.add("in");
		}
	}

	private navigate(path: string | null): void {
		if (FilePicker.filePicker !== this || this.gettingFiles || this.fading)
			return;

		const leavingRoot = !this.path;

		this.path = path = this.updatePathElement(path);

		if (leavingRoot)
			this.rootLength = (path ? path.length : 0);

		this.providerVersion++;
		const providerVersion = this.providerVersion;

		this.updateIconLoading(true);

		let returnedItems: FilePickerListItem[] | null = null;

		if (this.listControl.element.classList.contains("in")) {
			this.fading = true;

			this.listControl.element.classList.remove("in");

			DelayControl.delayFadeCB(() => {
				if (FilePicker.filePicker !== this || !this.provider || providerVersion !== this.providerVersion)
					return;

				this.list.clear();

				this.fading = false;

				if (returnedItems)
					this.finishNavigation(returnedItems);
			});
		}

		this.provider.navigate(path).then((items) => {
			if (FilePicker.filePicker !== this || !this.provider || providerVersion !== this.providerVersion)
				return;

			returnedItems = items || [];

			if (!this.fading)
				this.finishNavigation(returnedItems);
		}, (reason) => {
			if (FilePicker.filePicker !== this || !this.provider || providerVersion !== this.providerVersion)
				return;

			this.updateIconLoading(false);

			Alert.show(reason.message || (((typeof reason.error) === "string") ? reason.error : ((reason.error && reason.error.message) || reason.toString())), true);
		});
	}

	private navigateUp(): void {
		let path = this.path,
			i: number;

		if (!path || (i = path.lastIndexOf('/')) <= 0) {
			this.navigate(null);
		} else {
			path = path.substring(0, i);
			this.navigate((path.length < this.rootLength) ? null : path);
		}
	}

	private toggleAll(): void {
		if (FilePicker.filePicker !== this || this.gettingFiles || this.fading)
			return;

		const list = this.list;

		let selected = false;

		for (let i = list.length - 1; i >= 0; i--) {
			if (!list.item(i).selected) {
				selected = true;
				break;
			}
		}

		for (let i = list.length - 1; i >= 0; i--)
			list.item(i).selected = selected;

		this.listControl.refreshVisibleItems();
	}

	private modalShown(): HTMLElement | null {
		this.navigate(this.path);

		return this.listControl.element;
	}

	private modalHiding(): boolean {
		if (FilePicker.filePicker !== this)
			return true;

		FilePicker.filePicker = null;

		if (this.provider)
			this.provider.destroy();

		return true;
	}

	private modalHidden(): void {
		const resolve = this.resolve,
			selectedFiles = this.selectedFiles;

		this.selectedFiles = null;

		zeroObject(this);

		if (resolve)
			resolve(selectedFiles);
	}

	private modalOk(play: boolean): void {
		if (FilePicker.filePicker !== this || this.gettingFiles || this.fading)
			return;

		const selectedDirectories: FilePickerListItem[] = [],
			selectedFiles: FilePickerListItem[] = [],
			list = this.list,
			length = list.length;

		if (this.path) {
			for (let i = 0; i < length; i++) {
				const item = list.item(i);

				if (item.selected)
					(item.dir ? selectedDirectories : selectedFiles).push(item);
			}
		}

		if (!this.path || (!selectedDirectories.length && !selectedFiles.length)) {
			Alert.show(Strings.NothingSelected);
			return;
		}

		FilePicker.lastPath = this.path;
		FilePicker.lastRootLength = this.rootLength;

		this.gettingFiles = true;

		this.providerVersion++;
		const providerVersion = this.providerVersion;

		this.updateIconLoading(true);

		this.provider.getFiles(selectedDirectories, selectedFiles).then((files) => {
			if (FilePicker.filePicker !== this || !this.provider || providerVersion !== this.providerVersion)
				return;

			if (this.callback) {
				const list = this.list;

				for (let i = list.length - 1; i >= 0; i--)
					list.item(i).selected = false;

				this.listControl.refreshVisibleItems();

				this.updateIconLoading(false);

				this.gettingFiles = false;

				this.callback({
					play,
					files
				});

				return;
			}

			this.selectedFiles = files;

			Modal.hide();
		}, (reason) => {
			if (FilePicker.filePicker !== this || !this.provider || providerVersion !== this.providerVersion)
				return;

			this.updateIconLoading(false);

			this.gettingFiles = false;

			Alert.show(reason.message || (((typeof reason.error) === "string") ? reason.error : ((reason.error && reason.error.message) || reason.toString())), true);
		});
	}
}
