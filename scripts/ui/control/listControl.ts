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

class ListControlItem<T extends ListItem> {
	public index: number;
	public selected: boolean;
	public current: boolean;
	public item: T | null;
	public readonly element: HTMLElement;

	constructor(element: HTMLElement) {
		this.index = -1;
		this.selected = false;
		this.current = false;
		this.item = null;
		this.element = element;
	}

	public reset(): void {
		this.index = -1;
		this.selected = false;
		this.current = false;
		this.item = null;
		if (this.element)
			this.element.classList.remove("current", "selected");
	}
}

class ListControl<T extends ListItem> {
	public readonly element: HTMLElement;

	private readonly container: HTMLDivElement;

	private readonly resizeObserver: ResizeObserver;

	private _adapter: ListAdapter<T> | null;

	private itemHeight: number;
	private itemMargin: number;
	private itemHeightAndMargin: number;
	private firstIndex: number;
	private lastIndex: number;
	private currentItem: T | null;
	private clientHeight: number;
	private containerHeight: number;
	private visibleCount: number;
	private items: ListControlItem<T>[];
	private refreshItemsEnqueued: boolean;

	private readonly boundZoomChanged: any;
	private readonly boundRefreshItems: any;

	public onitemclicked: ((item: T, index: number) => void) | null;
	public onitemcontextmenu: ((item: T, index: number) => void) | null;

	constructor(element: string | HTMLElement) {
		this.element = (((typeof element) === "string") ? document.getElementById(element as string) : element) as HTMLElement;
		this.element.classList.add("list", "scrollable");
		if (!this.element.getAttribute("tabindex"))
			this.element.setAttribute("tabindex", "0");

		const container = document.createElement("div");
		container.className = "list-container";
		this.container = container;
		this.element.appendChild(container);

		this._adapter = null;

		this.boundZoomChanged = this.zoomChanged.bind(this);
		this.boundRefreshItems = this.refreshVisibleItemsInternal.bind(this);

		this.element.addEventListener("scroll", this.scroll.bind(this), { passive: true });

		this.resizeObserver = new ResizeObserver(this.resize.bind(this));
		this.resizeObserver.observe(this.element);

		this.itemHeight = 1;
		this.itemMargin = 1;
		this.itemHeightAndMargin = 2;
		this.firstIndex = 0;
		this.lastIndex = 0;
		this.currentItem = null;
		this.clientHeight = 1;
		this.containerHeight = 0;
		this.visibleCount = 1;
		this.items = [];
		this.refreshItemsEnqueued = false;

		this.onitemclicked = null;
		this.onitemcontextmenu = null;

		container.onclick = this.containerClick.bind(this);
		container.oncontextmenu = this.containerContextMenu.bind(this);

		this.resize();

		AppUI.addZoomHandler(this.boundZoomChanged);
	}

	public destroy(): void {
		if (this._adapter)
			this._adapter.control = null;

		if (this.resizeObserver)
			this.resizeObserver.unobserve(this.element);

		if (this.items)
			(this.items as Array<any>).fill(null);

		if (this.boundZoomChanged)
			AppUI.removeZoomHandler(this.boundZoomChanged);

		zeroObject(this);
	}

	public get adapter(): ListAdapter<T> | null {
		return this._adapter;
	}

	public set adapter(adapter: ListAdapter<T> | null) {
		if (this._adapter === adapter)
			return;

		if (this._adapter)
			this._adapter.control = null;

		this._adapter = adapter;

		this.clear();

		if (adapter) {
			adapter.control = this;

			this.prepareAdapter();
		}
	}

	private prepareAdapter(): void {
		const adapter = this._adapter;
		if (!adapter)
			return;

		this.itemHeight = adapter.itemHeight;
		this.itemMargin = AppUI.thickBorderPX;
		this.itemHeightAndMargin = this.itemHeight + this.itemMargin;
		this.currentItem = adapter.list.currentItem;

		this.adjustContainerHeight();
		this.resize();
	}

	private zoomChanged(): void {
		const adapter = this._adapter;
		if (!adapter)
			return;

		this.prepareAdapter();

		const items = this.items;
		for (let i = items.length - 1; i >= 0; i--) {
			items[i].index = -1;
		}

		this.scroll();

		/*const items = this.items,
			length = adapter.list.length,
			itemHeightAndMargin = this.itemHeightAndMargin,
			visibleCount = this.visibleCount;

		for (let i = 0, firstIndex = this.firstIndex, top = firstIndex * itemHeightAndMargin; i < visibleCount && firstIndex < length; i++, firstIndex++, top += itemHeightAndMargin)
			items[i].element.style.top = top + "px";*/
	}

	private adjustContainerHeight(): void {
		const adapter = this._adapter,
			container = this.container;
		if (!adapter || !container)
			return;

		const itemCount = adapter.list.length,
			containerHeight = (itemCount ? ((itemCount * this.itemHeightAndMargin) - this.itemMargin) : 0);

		if (this.containerHeight !== containerHeight) {
			this.containerHeight = containerHeight;
			container.style.height = containerHeight + "px";
		}
	}

	private clear(): void {
		const container = this.container;
		if (!container)
			return;

		while (container.firstChild)
			container.removeChild(container.firstChild);

		const items = this.items;
		for (let i = items.length - 1; i >= 0; i--)
			items[i].reset();

		this.firstIndex = 0;
		this.lastIndex = 0;
		this.currentItem = null;
		this.element.scrollTop = 0;
		this.containerHeight = 0;
		this.container.style.height = "0";
	}

	private scroll(): void {
		const adapter = this._adapter,
			element = this.element;
		if (!adapter || !element)
			return;

		const items = this.items,
			itemHeightAndMargin = this.itemHeightAndMargin;

		// The +4 and -2 offsets are here to force the preparation of invisible
		// items, in order to try to prevent the the appearance of blank spaces
		// at the top and at the bottom of the list when the user scrolls it
		// faster than the browser can process the script.
		let oldFirstIndex = this.firstIndex - 2,
			firstIndex = ((element.scrollTop / itemHeightAndMargin) | 0);

		if (oldFirstIndex < 0)
			oldFirstIndex = 0;

		this.firstIndex = firstIndex;

		const visibleCount = this.visibleCount + ((firstIndex === 0) ? 2 : ((firstIndex === 1) ? 3 : 4));

		if ((firstIndex = firstIndex - 2) < 0)
			firstIndex = 0;

		// Since there is no such function as memcpy() or Array.set(),
		// we would need to manually copy the objects to a temporary array
		// to store them during the process of rearranging the objects.
		// Also, Array.splice(), Array.shift() and all other Array methods
		// either create temporary arrays, or change the length of the array
		// or both!
		// Therefore, given that visibleCount is usually somewhere between 5
		// and 20, I decided to simply switch the items which avoids resizing
		// the array, creating new arrays and creating new objects!
		if (firstIndex > oldFirstIndex) {
			const delta = firstIndex - oldFirstIndex;
			if (delta && delta < visibleCount) {
				const count = visibleCount - delta;
				for (let src = delta, dst = 0; src < visibleCount; src++, dst++) {
					const temp = items[dst];
					items[dst] = items[src];
					items[src] = temp;
				}
			}
		} else {
			const delta = oldFirstIndex - firstIndex;
			if (delta && delta < visibleCount) {
				for (let dst = visibleCount - 1, src = dst - delta; src >= 0; src--, dst--) {
					const temp = items[dst];
					items[dst] = items[src];
					items[src] = temp;
				}
			}
		}

		const list = adapter.list,
			length = list.length,
			currentItem = adapter.list.currentItem,
			container = this.container;

		let i = 0;

		// This code has been copied here for the sake of performance... (?)
		for (let top = firstIndex * itemHeightAndMargin; i < visibleCount && firstIndex < length; i++, firstIndex++, top += itemHeightAndMargin) {
			const listItem = list.item(firstIndex),
				item = items[i];

			if (item.item !== listItem) {
				const current = (currentItem === listItem);
				if (item.current !== current) {
					item.current = current;
					if (current)
						item.element.classList.add("current");
					else
						item.element.classList.remove("current");
				}

				adapter.prepareElement(listItem, firstIndex, length, item.element);

				if (!item.item)
					container.appendChild(item.element);
				item.item = listItem;
			}

			if (item.index !== firstIndex) {
				item.index = firstIndex;
				item.element.style.top = top + "px";
			}
		}

		const itemsLength = items.length;
		for (; i < itemsLength; i++) {
			const item = items[i];

			if (item.item) {
				item.item = null;
				container.removeChild(item.element);
			}
		}

		this.lastIndex = firstIndex - 1;
		if (this.lastIndex < this.firstIndex)
			this.lastIndex = this.firstIndex;
	}

	private refreshVisibleItemsInternal(): void {
		this.refreshItemsEnqueued = false;

		const adapter = this._adapter,
			element = this.element;
		if (!adapter || !element)
			return;

		this.adjustContainerHeight();

		const items = this.items,
			itemHeightAndMargin = this.itemHeightAndMargin,
			list = adapter.list,
			length = list.length,
			currentItem = adapter.list.currentItem,
			container = this.container;

		this.currentItem = currentItem;

		let i = 0,
			firstIndex = this.firstIndex;

		// The +4 and -2 offsets are here to force the preparation of invisible
		// items, in order to try to prevent the the appearance of blank spaces
		// at the top and at the bottom of the list when the user scrolls it
		// faster than the browser can process the script.
		const visibleCount = this.visibleCount + ((firstIndex === 0) ? 2 : ((firstIndex === 1) ? 3 : 4));

		if ((firstIndex = firstIndex - 2) < 0)
			firstIndex = 0;

		for (let top = firstIndex * itemHeightAndMargin; i < visibleCount && firstIndex < length; i++, firstIndex++, top += itemHeightAndMargin) {
			const listItem = list.item(firstIndex),
				item = items[i];

			const current = (currentItem === listItem);
			if (item.current !== current) {
				item.current = current;
				if (current)
					item.element.classList.add("current");
				else
					item.element.classList.remove("current");
			}

			adapter.prepareElement(listItem, firstIndex, length, item.element);

			if (!item.item)
				container.appendChild(item.element);
			item.item = listItem;

			if (item.index !== firstIndex) {
				item.index = firstIndex;
				item.element.style.top = top + "px";
			}
		}

		const itemsLength = items.length;
		for (; i < itemsLength; i++) {
			const item = items[i];

			if (item.item) {
				item.item = null;
				container.removeChild(item.element);
			}
		}
	}

	private resize(): void {
		const adapter = this._adapter,
			element = this.element;
		if (!adapter || !element)
			return;

		const oldClientHeight = this.clientHeight;

		let clientHeight = element.clientHeight;
		if (clientHeight < 0)
			clientHeight = 0;

		const visibleCount = Math.ceil(clientHeight / this.itemHeightAndMargin) + 1;
		if (this.visibleCount !== visibleCount) {
			this.visibleCount = visibleCount;

			const items = this.items;

			// Check out the comments inside scroll() and refreshVisibleItemsInternal(),
			// for an explanation about this offset
			while ((visibleCount + 4) > items.length)
				items.push(new ListControlItem(adapter.createEmptyElement()));
		}

		if (oldClientHeight !== clientHeight) {
			this.clientHeight = clientHeight;
			this.scroll();
		}
	}

	private containerClick(e: MouseEvent): void {
		if (!this.element || !this.adapter || !e.target || !(e.target as HTMLElement).classList.contains("list-item") || !this.onitemclicked)
			return;

		const rect = this.element.getBoundingClientRect(),
			index = this.indexFromY(e.clientY - rect.top);

		if (index >= 0) {
			const item = this.adapter.list.item(index);
			if (item)
				this.onitemclicked(item, index);
		}
	}

	private containerContextMenu(e: MouseEvent): void {
		if (!this.element || !this.adapter || !e.target || !(e.target as HTMLElement).classList.contains("list-item") || !this.onitemcontextmenu)
			return;

		const rect = this.element.getBoundingClientRect(),
			index = this.indexFromY(e.clientY - rect.top);

		if (index >= 0) {
			const item = this.adapter.list.item(index);
			if (item)
				this.onitemcontextmenu(item, index);
		}
	}

	public yFromIndex(index: number): number {
		return (this.element ? ((index * this.itemHeightAndMargin) - this.element.scrollTop) : 0);
	}

	public indexFromY(y: number): number {
		if (!this.element || !this.adapter)
			return -1;
		const index = ((y + this.element.scrollTop) / this.itemHeightAndMargin) | 0;
		return ((index < 0 || index >= this.adapter.list.length) ? -1 : index);
	}

	public isItemVisible(index: number): boolean {
		const y = this.yFromIndex(index);
		return (y >= 0 && y <= (this.clientHeight - this.itemHeight));
	}

	public bringItemIntoView(index: number, center?: boolean): void {
		const y = this.yFromIndex(index);
		if (y < 0) {
			if (center)
				this.centerItemIntoView(index);
			else
				this.element.scrollTop += y;
		} else if (y > (this.clientHeight - this.itemHeight)) {
			if (center)
				this.centerItemIntoView(index);
			else
				this.element.scrollTop += y - (this.clientHeight - this.itemHeight);
		}
	}

	public centerItemIntoView(index: number): void {
		this.element.scrollTop = (index * this.itemHeightAndMargin) - ((this.clientHeight - this.itemHeight) >> 1);
	}

	public refreshVisibleItems(): void {
		if (!this.refreshItemsEnqueued) {
			this.refreshItemsEnqueued = true;
			queueMicrotask(this.boundRefreshItems);
		}
	}

	public notifyCleared(): void {
		this.clear();
	}

	public notifyItemsAdded(firstIndex: number, lastIndex: number): void {
		this.refreshVisibleItems();
	}

	public notifyItemsRemoved(firstIndex: number, lastIndex: number): void {
		this.refreshVisibleItems();
	}

	public notifyCurrentItemChanged(): void {
		this.refreshVisibleItems();
	}
}
