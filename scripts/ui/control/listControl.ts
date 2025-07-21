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

class ListControlItem<T> {
	private static _internalId = 0;

	// index is only used when useVirtualItems is false
	public index: number;
	public selected: boolean;
	public current: boolean;
	public keyboard: boolean;
	// item is only used when useVirtualItems is false
	public item: T | null;
	public readonly element: HTMLElement;

	public constructor(element: HTMLElement) {
		this.index = -1;
		this.selected = false;
		this.current = false;
		this.keyboard = false;
		this.item = null;
		this.element = element;
		element.id = "listControlItem" + (ListControlItem._internalId++);
		element.role = "row";
		element.ariaSelected = "false";
		element.ariaReadOnly = "true";
	}

	public reset(): void {
		this.index = -1;
		this.selected = false;
		this.current = false;
		this.keyboard = false;
		this.item = null;
		if (this.element) {
			this.element.classList.remove("current", "selected", "keyboard");
			this.element.ariaSelected = "false";
		}
	}

	public zero(): void {
		this.index = -1;
		this.selected = false;
		this.current = false;
		this.keyboard = false;
		this.item = null;
		(this as any).element = null;
	}
}

class ListControl<T extends Object> extends HTMLElement {
	private readonly _container: HTMLDivElement;
	private readonly _emptyMessage: HTMLDivElement;
	private readonly _resizeObserver: ResizeObserver;
	private readonly _useVirtualItems: boolean;

	private _adapter: ListAdapter<T> | null;

	private _itemHeight: number;
	private _itemMargin: number;
	private _itemHeightAndMargin: number;
	private _ignoreFirstIndex: boolean;
	private _firstIndex: number;
	private _lastIndex: number;
	private _currentListItem: T | null;
	// currentItem and keyboardItem are only used when useVirtualItems is false
	private _currentItem: ListControlItem<T> | null;
	private _keyboardItem: ListControlItem<T> | null;
	private _clientHeight: number;
	private _containerHeight: number;
	private _scrollbarPadding: boolean;
	private _scrollbarPaddingScheduled: boolean;
	private _visibleCount: number;
	private _items: ListControlItem<T>[];
	private _refreshVisibleItemsEnqueued: boolean;
	private _notifyCurrentItemChangedEnqueued: boolean;
	private _emptyMessageAdded: boolean;

	private _initialized: boolean;
	private _focused: boolean;
	private _keyboardIndex: number;
	private _lastKeyboardIndex: number;

	private readonly _boundZoomChanged: any;
	private readonly _boundRefreshVisibleItemsInternal: any;
	private readonly _boundNotifyCurrentItemChangedInternal: any;
	private readonly _boundAdjustScrollbarPaddingFromResize: any;

	public deleteMode: boolean;
	public onitemclick: ((item: T, index: number, button: number) => void) | null;
	public onitemcontrolclick: ((item: T, index: number, button: number, target: HTMLElement) => void) | null;
	public onitemcontextmenu: ((item: T, index: number) => void) | null;

	public constructor() {
		super();

		// Not using virtual items makes mobile devices create a large
		// layer for the items if they actually overflow. Also, now that
		// the items are a child of the element, not the container, the
		// margin of the last item becomes noticeable, because it can be
		// seen when scrolling to the bottom of the list.
		this._useVirtualItems = true;

		this._adapter = null;

		this._boundZoomChanged = this.zoomChanged.bind(this);
		this._boundRefreshVisibleItemsInternal = this.refreshVisibleItemsInternal.bind(this);
		this._boundAdjustScrollbarPaddingFromResize = this.adjustScrollbarPaddingFromResize.bind(this);

		const container = document.createElement("div");
		container.className = "f-list-container";
		//container.role = "rowgroup";
		this._container = container;

		const emptyMessage = document.createElement("div");
		emptyMessage.className = "f-list-empty-message";
		this._emptyMessageAdded = false;
		this._emptyMessage = emptyMessage;

		if (!this._useVirtualItems)
			this._boundNotifyCurrentItemChangedInternal = this.notifyCurrentItemChangedInternal.bind(this);

		this._resizeObserver = new ResizeObserver(this.resize.bind(this));

		this._itemHeight = 1;
		this._itemMargin = 1;
		this._itemHeightAndMargin = 2;
		this._ignoreFirstIndex = false;
		this._firstIndex = 0;
		this._lastIndex = 0;
		this._currentListItem = null;
		this._currentItem = null;
		this._keyboardItem = null;
		this._clientHeight = 1;
		this._containerHeight = 0;
		this._scrollbarPadding = false;
		this._scrollbarPaddingScheduled = false;
		this._visibleCount = 1;
		this._items = [];
		this._refreshVisibleItemsEnqueued = false;
		this._notifyCurrentItemChangedEnqueued = false;

		this._initialized = false;
		this._focused = false;
		this._keyboardIndex = -1;
		this._lastKeyboardIndex = -1;

		this.deleteMode = false;
		this.onitemclick = null;
		this.onitemcontrolclick = null;
		this.onitemcontextmenu = null;
	}

	public destroy(): void {
		if (this._adapter)
			this._adapter.control = null;

		if (this._resizeObserver)
			this._resizeObserver.unobserve(this);

		if (this._items)
			(this._items as Array<any>).fill(null);

		if (this._boundZoomChanged)
			AppUI.removeZoomHandler(this._boundZoomChanged);

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

			if (!this._useVirtualItems) {
				if (adapter.list.length)
					this.notifyItemsAdded(0, adapter.list.length - 1);
			} else {
				this.ariaRowCount = adapter.list.length.toString();
			}
		}
	}

	public get emptyMessage(): string {
		return (this._emptyMessage ? this._emptyMessage.textContent : null) || "";
	}

	public set emptyMessage(message: string) {
		if (this._emptyMessage)
			this._emptyMessage.textContent = message;
	}

	private prepareAdapter(): void {
		const adapter = this._adapter;
		if (!adapter)
			return;

		this._itemHeight = adapter.itemHeight;
		this._itemMargin = AppUI.thickBorderPX;
		this._itemHeightAndMargin = this._itemHeight + this._itemMargin;
		this._currentListItem = adapter.list.currentItem;

		this.adjustContainerHeight();
		this.resize();
	}

	private zoomChanged(): void {
		const adapter = this._adapter;
		if (!adapter)
			return;

		this.prepareAdapter();

		const items = this._items;
		for (let i = items.length - 1; i >= 0; i--) {
			items[i].index = -1;
		}

		if (this._useVirtualItems)
			this.elementScroll();

		/*const items = this.items,
			length = adapter.list.length,
			itemHeightAndMargin = this.itemHeightAndMargin,
			visibleCount = this.visibleCount;

		for (let i = 0, firstIndex = this.firstIndex, top = firstIndex * itemHeightAndMargin; i < visibleCount && firstIndex < length; i++, firstIndex++, top += itemHeightAndMargin)
			items[i].element.style.top = top + "px";*/
	}

	private adjustScrollbarPadding(): void {
		const scrollbarPadding = ((this._containerHeight | 0) > this._clientHeight);

		if (this._scrollbarPadding !== scrollbarPadding) {
			this._scrollbarPadding = scrollbarPadding;
			if (this._useVirtualItems) {
				if (scrollbarPadding)
					this.classList.add("virtual-padding");
				else
					this.classList.remove("virtual-padding");
			} else {
				this.style.padding = (scrollbarPadding ? "" : "0");
			}
		}
	}

	private adjustScrollbarPaddingFromResize(): void {
		this._scrollbarPaddingScheduled = false;
		this.adjustScrollbarPadding();
	}

	private adjustContainerHeight(): void {
		const adapter = this._adapter,
			container = this._container;
		if (!adapter || !container)
			return;

		const itemCount = adapter.list.length,
			containerHeight = (itemCount ? ((itemCount * this._itemHeightAndMargin) - this._itemMargin) : 0);

		if (this._containerHeight !== containerHeight) {
			this._containerHeight = containerHeight;
			container.style.height = containerHeight + "px";

			this.adjustScrollbarPadding();

			if (itemCount) {
				if (this._emptyMessageAdded) {
					this._emptyMessageAdded = false;
					this.removeChild(this._emptyMessage);
				}
			} else if (!this._emptyMessageAdded) {
				this._emptyMessageAdded = true;
				this.appendChild(this._emptyMessage);
			}
		}
	}

	private clear(): void {
		const container = this._container;
		if (!container)
			return;

		const items = this._items;
		for (let i = items.length - 1; i >= 0; i--) {
			if (items[i].element) {
				const parentNode = items[i].element.parentNode;
				if (parentNode)
					parentNode.removeChild(items[i].element);
			}
		}

		if (this._useVirtualItems) {
			for (let i = items.length - 1; i >= 0; i--)
				items[i].reset();
		} else {
			for (let i = items.length - 1; i >= 0; i--)
				items[i].zero();
			items.splice(0);
		}

		this._firstIndex = 0;
		this._lastIndex = 0;
		this._currentListItem = null;
		this._currentItem = null;
		this._keyboardItem = null;
		this.scrollTop = 0;
		this._containerHeight = 0;
		this._container.style.height = "0";

		if (!this._emptyMessageAdded) {
			this._emptyMessageAdded = true;
			this.appendChild(this._emptyMessage);
		}

		if (this._keyboardIndex > 0) {
			this._keyboardIndex = 0;
			this._lastKeyboardIndex = 0;
		} else {
			this._lastKeyboardIndex = -1;
		}

		this.ariaRowCount = "0";
		this.removeAttribute("aria-activedescendant");

		this.adjustScrollbarPadding();
	}

	private elementScroll(): void {
		const adapter = this._adapter;
		if (!adapter)
			return;

		const items = this._items,
			itemHeightAndMargin = this._itemHeightAndMargin;

		// The +4 and -2 offsets are here to force the preparation of invisible
		// items, in order to try to prevent the the appearance of blank spaces
		// at the top and at the bottom of the list when the user scrolls it
		// faster than the browser can process the script.
		let oldFirstIndex = this._firstIndex - 2,
			firstIndex = ((this.scrollTop / itemHeightAndMargin) | 0);

		if (oldFirstIndex < 0)
			oldFirstIndex = 0;

		if (this._ignoreFirstIndex)
			this._ignoreFirstIndex = false;
		else if (this._firstIndex === firstIndex)
			return;

		this._firstIndex = firstIndex;

		let visibleCount = this._visibleCount + ((firstIndex === 0) ? 2 : ((firstIndex === 1) ? 3 : 4));
		if (visibleCount > items.length)
			visibleCount = items.length;

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
			currentListItem = adapter.list.currentItem,
			keyboardIndex = this._keyboardIndex;

		let i = 0;

		// This code has been copied here for the sake of performance... (?)
		for (let top = firstIndex * itemHeightAndMargin; i < visibleCount && firstIndex < length; i++, firstIndex++, top += itemHeightAndMargin) {
			const listItem = list.item(firstIndex),
				item = items[i];

			if (item.item !== listItem) {
				let tmp = (currentListItem === listItem);
				if (item.current !== tmp) {
					item.current = tmp;
					if (tmp)
						item.element.classList.add("current");
					else
						item.element.classList.remove("current");
				}

				tmp = (keyboardIndex === firstIndex);
				if (item.keyboard !== tmp) {
					item.keyboard = tmp;
					if (tmp) {
						item.element.classList.add("keyboard");
						item.element.ariaSelected = "true";
						this.setAttribute("aria-activedescendant", item.element.id);
					} else {
						if (this.getAttribute("aria-activedescendant") === item.element.id)
							this.removeAttribute("aria-activedescendant");
						item.element.classList.remove("keyboard");
						item.element.ariaSelected = "false";
					}
				}

				adapter.prepareElement(listItem, firstIndex, length, item.element);
				item.element.ariaRowIndex = firstIndex.toString();

				if (!item.item)
					this.appendChild(item.element);
				item.item = listItem;
			}

			if (item.index !== firstIndex) {
				item.index = firstIndex;
				item.element.style.transform = "translateY(" + top + "px)";
			}
		}

		const itemsLength = items.length;
		for (; i < itemsLength; i++) {
			const item = items[i];

			if (item.item) {
				item.item = null;
				this.removeChild(item.element);
			}
		}

		this._lastIndex = firstIndex - 1;
		if (this._lastIndex < this._firstIndex)
			this._lastIndex = this._firstIndex;
	}

	private refreshVisibleItemsInternal(): void {
		this._refreshVisibleItemsEnqueued = false;

		const adapter = this._adapter;
		if (!adapter)
			return;

		this.adjustContainerHeight();

		const items = this._items,
			itemHeightAndMargin = this._itemHeightAndMargin,
			list = adapter.list,
			length = list.length,
			currentListItem = adapter.list.currentItem,
			keyboardIndex = this._keyboardIndex;

		if (!this._useVirtualItems) {
			const visibleCount = this._visibleCount,
				newKeyboardItem = ((keyboardIndex >= 0 && keyboardIndex < items.length) ? items[keyboardIndex] : null);

			if (this._keyboardItem !== newKeyboardItem) {
				if (this._keyboardItem) {
					this._keyboardItem.element.classList.remove("keyboard");
					this._keyboardItem.element.ariaSelected = "false";
				}

				if (newKeyboardItem) {
					newKeyboardItem.element.classList.add("keyboard");
					newKeyboardItem.element.ariaSelected = "true";
					this.setAttribute("aria-activedescendant", newKeyboardItem.element.id);
				} else {
					this.removeAttribute("aria-activedescendant");
				}

				this._keyboardItem = newKeyboardItem;
			}

			for (let i = 0, firstIndex = this.indexFromY(0); i <= visibleCount && firstIndex < length; i++, firstIndex++) {
				const element = items[firstIndex].element;
				adapter.prepareElement(list.item(firstIndex), firstIndex, length, element);
				element.ariaRowIndex = firstIndex.toString();
			}

			return;
		}

		this._currentListItem = currentListItem;

		let i = 0,
			firstIndex = this._firstIndex;

		// The +4 and -2 offsets are here to force the preparation of invisible
		// items, in order to try to prevent the the appearance of blank spaces
		// at the top and at the bottom of the list when the user scrolls it
		// faster than the browser can process the script.
		let visibleCount = this._visibleCount + ((firstIndex === 0) ? 2 : ((firstIndex === 1) ? 3 : 4));
		if (visibleCount > items.length)
			visibleCount = items.length;

		if ((firstIndex = firstIndex - 2) < 0)
			firstIndex = 0;

		for (let top = firstIndex * itemHeightAndMargin; i < visibleCount && firstIndex < length; i++, firstIndex++, top += itemHeightAndMargin) {
			const listItem = list.item(firstIndex),
				item = items[i];

			let tmp = (currentListItem === listItem);
			if (item.current !== tmp) {
				item.current = tmp;
				if (tmp)
					item.element.classList.add("current");
				else
					item.element.classList.remove("current");
			}

			tmp = (keyboardIndex === firstIndex);
			if (item.keyboard !== tmp) {
				item.keyboard = tmp;
				if (tmp) {
					item.element.classList.add("keyboard");
					item.element.ariaSelected = "true";
					this.setAttribute("aria-activedescendant", item.element.id);
				} else {
					if (this.getAttribute("aria-activedescendant") === item.element.id)
						this.removeAttribute("aria-activedescendant");
					item.element.classList.remove("keyboard");
					item.element.ariaSelected = "false";
				}
			}

			adapter.prepareElement(listItem, firstIndex, length, item.element);
			item.element.ariaRowIndex = firstIndex.toString();

			if (!item.item)
				this.appendChild(item.element);
			item.item = listItem;

			if (item.index !== firstIndex) {
				item.index = firstIndex;
				item.element.style.transform = "translateY(" + top + "px)";
			}
		}

		const itemsLength = items.length;
		for (; i < itemsLength; i++) {
			const item = items[i];

			if (item.item) {
				item.item = null;
				this.removeChild(item.element);
			}
		}
	}

	private resize(): void {
		const adapter = this._adapter;
		if (!adapter)
			return;

		const oldClientHeight = this._clientHeight;

		let clientHeight = this.clientHeight;
		if (clientHeight < 0)
			clientHeight = 0;

		const visibleCount = Math.ceil(clientHeight / this._itemHeightAndMargin) + 1;
		if (this._visibleCount !== visibleCount) {
			this._visibleCount = visibleCount;

			if (this._useVirtualItems) {
				const items = this._items;

				// Check out the comments inside scroll() and refreshVisibleItemsInternal(),
				// for an explanation about this offset
				while ((visibleCount + 4) > items.length)
					items.push(new ListControlItem<T>(adapter.createEmptyElement("f-list-item virtual")));
			}
		}

		if (oldClientHeight !== clientHeight) {
			this._clientHeight = clientHeight;

			if (this._useVirtualItems) {
				this._ignoreFirstIndex = true;
				this.elementScroll();
			}

			// Changing the padding in response to the resize event of a ResizeObserver
			// could cause a "ResizeObserver - loop limit exceeded" error
			if (!this._scrollbarPaddingScheduled) {
				this._scrollbarPaddingScheduled = true;
				requestAnimationFrame(this._boundAdjustScrollbarPaddingFromResize);
			}
		}
	}

	private elementClick(e: MouseEvent): void {
		if (!this._adapter || !e.target) // || !(e.target as HTMLElement).classList.contains("f-list-item"))
			return;

		const rect = this.getBoundingClientRect(),
			index = this.indexFromY(e.clientY - rect.top);

		if (this._keyboardIndex >= 0) {
			this._keyboardIndex = -1;
			this.refreshVisibleItems();
		}

		if (index >= 0) {
			this._lastKeyboardIndex = index;

			const item = this._adapter.list.item(index);
			if (item) {
				if ((e.target as HTMLElement).classList.contains("f-list-item")) {
					if (this.deleteMode)
						this._adapter.list.removeItems(index, index);
					else if (this.onitemclick)
						this.onitemclick(item, index, e.button);
				} else if (this.onitemcontrolclick) {
					this.onitemcontrolclick(item, index, e.button, e.target as HTMLElement);
				}
			}
		}
	}

	private elementContextMenu(e: MouseEvent): boolean {
		if (!this._adapter || !this.onitemcontextmenu || !e.target) // || !(e.target as HTMLElement).classList.contains("f-list-item"))
			return cancelEvent(e);

		const rect = this.getBoundingClientRect(),
			index = this.indexFromY(e.clientY - rect.top);

		if (this._keyboardIndex >= 0) {
			this._keyboardIndex = -1;
			this.refreshVisibleItems();
		}

		if (index >= 0) {
			this._lastKeyboardIndex = index;

			const item = this._adapter.list.item(index);
			if (item)
				this.onitemcontextmenu(item, index);
		}

		return cancelEvent(e);
	}

	// The order (even on mobile) is: mousedown, focus, click
	// But... We cannot track focus that way, because if the user clicks
	// the scrollbar, neither mousedown nor click are generated
	//private containerMouseDown(): void {
	//	if (this.keyboardIndex >= 0) {
	//		this.keyboardIndex = -1;
	//		this.refreshVisibleItems();
	//	}
	//}

	private elementFocus(): void {
		this._focused = true;
	}

	public elementKeyDown(e: KeyboardEvent): any {
		const adapter = this._adapter;
		if (!adapter || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)
			return;

		let delta = 0, end = 0;

		switch (e.key) {
			case "ArrowDown":
			case "ArrowRight":
				delta = 1;
				break;
			case "ArrowUp":
			case "ArrowLeft":
				delta = -1;
				break;
			case "PageDown":
				delta = ((this._clientHeight / this._itemHeightAndMargin) | 0);
				break;
			case "PageUp":
				delta = -((this._clientHeight / this._itemHeightAndMargin) | 0);
				break;
			case "Home":
				end = -1;
				break;
			case "End":
				end = 1;
				break;
			case "Enter":
				if (!e.repeat)
					end = 2;
				break;
			case " ":
				if (!e.repeat)
					end = 3;
				break;
			default:
				return;
		}

		const length = adapter.list.length;

		if (length > 0) {
			let keyboardIndex = this._keyboardIndex;

			if (keyboardIndex < 0)
				keyboardIndex = this._lastKeyboardIndex;

			if (!this.isItemVisible(keyboardIndex)) {
				keyboardIndex = (this.isItemVisible(adapter.list.currentIndex) ?
					adapter.list.currentIndex :
					this.indexFromY(0));
			}

			keyboardIndex = Math.min(length - 1, Math.max(0, keyboardIndex));

			if (end === -1) {
				keyboardIndex = 0;
			} else if (end === 1) {
				keyboardIndex = length - 1;
			} else {
				const oldKeyboardIndex = keyboardIndex;

				keyboardIndex += delta;

				if (keyboardIndex < 0)
					keyboardIndex = (oldKeyboardIndex ? 0 : (length - 1));
				else if (keyboardIndex >= length)
					keyboardIndex = ((oldKeyboardIndex === (length - 1)) ? 0 : (length - 1));
			}

			this._keyboardIndex = keyboardIndex;

			this.bringItemIntoView(keyboardIndex);

			this.refreshVisibleItems();

			if (end > 1) {
				const item = adapter.list.item(keyboardIndex);
				if (item) {
					switch (end) {
						case 2:
							if (this.deleteMode)
								adapter.list.removeItems(keyboardIndex, keyboardIndex);
							else if (this.onitemclick)
								this.onitemclick(item, keyboardIndex, 0);
							break;
						case 3:
							if (this.deleteMode) {
								adapter.list.removeItems(keyboardIndex, keyboardIndex);
							} else if (this.onitemcontrolclick) {
								const listItem = this.listControlItemFromIndex(keyboardIndex);
								if (listItem)
									this.onitemcontrolclick(item, keyboardIndex, 0, listItem.element);
							}
							break;
					}
				}
			}
		} else {
			this._keyboardIndex = -1;
		}

		return cancelEvent(e);
	}

	private elementKeyUp(e: KeyboardEvent): any {
		// Apparently, onkeyup is called after onfocus (when the
		// user navigates to the control using Tab or Shift+Tab)
		const adapter = this._adapter;
		if (!adapter || e.ctrlKey || e.metaKey || e.altKey || e.key !== "Tab" || !this._focused)
			return;

		const length = adapter.list.length;

		if (!length)
			return;

		let keyboardIndex = Math.min(length - 1, Math.max(0, this._lastKeyboardIndex));

		if (!this.isItemVisible(keyboardIndex))
			keyboardIndex = (this.isItemVisible(adapter.list.currentIndex) ?
				adapter.list.currentIndex :
				this.indexFromY(0));

		this._keyboardIndex = keyboardIndex;
		this.bringItemIntoView(keyboardIndex);

		this.refreshVisibleItems();
	}

	private elementBlur(): void {
		this._focused = false;

		this._lastKeyboardIndex = this._keyboardIndex;

		if (this._keyboardIndex >= 0) {
			this._keyboardIndex = -1;
			this.refreshVisibleItems();
		}
	}

	private listControlItemFromIndex(index: number): ListControlItem<T> | null {
		if (!this._items)
			return null;

		const items = this._items;

		for (let i = items.length - 1; i >= 0; i--) {
			if (items[i].index === index && items[i].item && items[i].element)
				return items[i];
		}

		return null;
	}

	public yFromIndex(index: number): number {
		return ((index * this._itemHeightAndMargin) - this.scrollTop);
	}

	public indexFromY(y: number): number {
		if (!this._adapter)
			return -1;
		const index = ((y + this.scrollTop + 0.9) / this._itemHeightAndMargin) | 0;
		return ((index < 0 || index >= this._adapter.list.length) ? -1 : index);
	}

	public isItemVisible(index: number): boolean {
		const y = this.yFromIndex(index);
		return (y > -this._itemHeight && y < this._clientHeight);
	}

	public bringItemIntoView(index: number, center?: boolean): void {
		const y = this.yFromIndex(index);
		if (y < 0) {
			if (center)
				this.centerItemIntoView(index);
			else
				this.scrollTop += y;
		} else if (y > (this._clientHeight - this._itemHeight)) {
			if (center)
				this.centerItemIntoView(index);
			else
				this.scrollTop += y - (this._clientHeight - this._itemHeight);
		}
	}

	public centerItemIntoView(index: number): void {
		this.scrollTop = (index * this._itemHeightAndMargin) - ((this._clientHeight - this._itemHeight) >> 1);
	}

	public refreshVisibleItems(): void {
		if (!this._refreshVisibleItemsEnqueued) {
			this._refreshVisibleItemsEnqueued = true;
			queueMicrotask(this._boundRefreshVisibleItemsInternal);
		}
	}

	public notifyCleared(): void {
		this.clear();
	}

	public notifyItemsAdded(firstIndex: number, lastIndex: number): void {
		if (this._useVirtualItems) {
			this.refreshVisibleItems();
		} else {
			const adapter = this._adapter,
				count = lastIndex - firstIndex + 1;
			if (!adapter || count <= 0)
				return;

			const items = this._items,
				list = adapter.list,
				length = list.length,
				currentListItem = list.currentItem,
				newItems: ListControlItem<T>[] = new Array(count);

			for (let i = lastIndex; i >= firstIndex; i--) {
				const listItem = list.item(i),
					item = new ListControlItem<T>(adapter.createEmptyElement("f-list-item real"));

				adapter.prepareElement(listItem, i, length, item.element);
				item.element.ariaRowIndex = i.toString();
				newItems[i - firstIndex] = item;

				if (currentListItem === listItem) {
					if (this._currentItem) {
						this._currentItem.current = false;
						this._currentItem.element.classList.remove("current");
					}

					this._currentItem = item;
					item.current = true;
					item.element.classList.add("current");
				}
			}

			const insertBeforeReference = (firstIndex >= items.length ? null : items[firstIndex].element);

			if (firstIndex >= items.length)
				items.push(...newItems);
			else
				items.splice(firstIndex, 0, ...newItems);

			if (this._items.length !== list.length)
				throw new Error("Assertion error: this.items.length !== list.length");

			this.adjustContainerHeight();

			for (let i = 0; i < count; i++)
				this.insertBefore(newItems[i].element, insertBeforeReference);

			for (let i = items.length - 1; i > lastIndex; i--) {
				const element = items[i].element;
				adapter.prepareElementIndexOrLengthChanged(list.item(i), i, length, element);
				element.ariaRowIndex = i.toString();
			}

			for (let i = firstIndex - 1; i >= 0; i--) {
				const element = items[i].element;
				adapter.prepareElementIndexOrLengthChanged(list.item(i), i, length, element);
				element.ariaRowIndex = i.toString();
			}
		}

		if (this._adapter)
			this.ariaRowCount = this._adapter.list.length.toString();
	}

	public notifyItemsRemoved(firstIndex: number, lastIndex: number): void {
		if (this._useVirtualItems) {
			this.refreshVisibleItems();
		} else {
			const adapter = this._adapter,
				count = lastIndex - firstIndex + 1;
			if (!adapter || count <= 0)
				return;

			const items = this._items,
				list = adapter.list,
				length = list.length,
				removedItems = items.splice(firstIndex, count);

			for (let i = removedItems.length - 1; i >= 0; i--) {
				const item = removedItems[i];

				if (item.current)
					this._currentItem = null;

				this.removeChild(item.element);
				item.zero();
			}

			if (this._items.length !== list.length)
				throw new Error("Assertion error: this.items.length !== list.length");

			for (let i = items.length - 1; i >= 0; i--) {
				const element = items[i].element;
				adapter.prepareElementIndexOrLengthChanged(list.item(i), i, length, element);
				element.ariaRowIndex = i.toString();
			}

			this.adjustContainerHeight();
		}

		if (this._adapter)
			this.ariaRowCount = this._adapter.list.length.toString();
	}

	public notifyCurrentItemChanged(oldIndex: number, newIdex: number): void {
		if (this._useVirtualItems) {
			this.refreshVisibleItems();
		} else if (!this._notifyCurrentItemChangedEnqueued) {
			this._notifyCurrentItemChangedEnqueued = true;
			queueMicrotask(this._boundNotifyCurrentItemChangedInternal);
		}
	}

	private notifyCurrentItemChangedInternal(): void {
		this._notifyCurrentItemChangedEnqueued = false;

		const adapter = this._adapter;
		if (!adapter)
			return;

		if (this._currentItem) {
			this._currentItem.current = false;
			this._currentItem.element.classList.remove("current");
		}

		const currentIndex = adapter.list.currentIndex;

		if (currentIndex >= 0 && currentIndex < this._items.length) {
			this._currentItem = this._items[currentIndex];
			this._currentItem.current = true;
			this._currentItem.element.classList.add("current");
		} else {
			this._currentItem = null;
		}
	}

	public connectedCallback(): void {
		if (this._initialized)
			return;

		this._initialized = true;

		this.classList.add("scrollable");
		this.style.padding = "0";
		this.role = "grid";
		this.ariaReadOnly = "true";
		this.ariaRowCount = "0";
		this.removeAttribute("aria-activedescendant");
		if (!this.tabIndex || this.tabIndex <= 0)
			this.tabIndex = 0;

		if (this._useVirtualItems)
			this.appendChild(this._container);

		if (!this._emptyMessageAdded) {
			this._emptyMessageAdded = true;
			this.appendChild(this._emptyMessage);
		}

		this.addEventListener("focus", this.elementFocus.bind(this));
		this.addEventListener("keydown", this.elementKeyDown.bind(this));
		this.addEventListener("keyup", this.elementKeyUp.bind(this));
		this.addEventListener("blur", this.elementBlur.bind(this));

		if (this._useVirtualItems)
			this.addEventListener("scroll", this.elementScroll.bind(this), { passive: true });

		this._resizeObserver.observe(this, { box: "border-box" });

		this.addEventListener("click", this.elementClick.bind(this));
		this.addEventListener("contextmenu", this.elementContextMenu.bind(this));

		this.resize();

		AppUI.addZoomHandler(this._boundZoomChanged);
	}
}

customElements.define("f-list", ListControl);
