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
	private static internalId = 0;

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
		element.setAttribute("id", "listControlItem" + (ListControlItem.internalId++));
		element.setAttribute("role", "row");
		element.setAttribute("aria-selected", "false");
		element.setAttribute("aria-readonly", "true");
	}

	public reset(): void {
		this.index = -1;
		this.selected = false;
		this.current = false;
		this.keyboard = false;
		this.item = null;
		if (this.element) {
			this.element.classList.remove("current", "selected", "keyboard");
			this.element.setAttribute("aria-selected", "false");
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

class ListControl<T> {
	public readonly element: HTMLElement;

	private readonly container: HTMLDivElement;
	private readonly resizeObserver: ResizeObserver;
	private readonly useVirtualItems: boolean;

	private _adapter: ListAdapter<T> | null;

	private itemHeight: number;
	private itemMargin: number;
	private itemHeightAndMargin: number;
	private ignoreFirstIndex: boolean;
	private firstIndex: number;
	private lastIndex: number;
	private currentListItem: T | null;
	// currentItem and keyboardItem are only used when useVirtualItems is false
	private currentItem: ListControlItem<T> | null;
	private keyboardItem: ListControlItem<T> | null;
	private clientHeight: number;
	private containerHeight: number;
	private scrollbarPadding: boolean;
	private scrollbarPaddingScheduled: boolean;
	private visibleCount: number;
	private items: ListControlItem<T>[];
	private refreshVisibleItemsEnqueued: boolean;
	private notifyCurrentItemChangedEnqueued: boolean;

	private focused: boolean;
	private keyboardIndex: number;
	private lastKeyboardIndex: number;

	private readonly boundZoomChanged: any;
	private readonly boundRefreshVisibleItemsInternal: any;
	private readonly boundNotifyCurrentItemChangedInternal: any;
	private readonly boundAdjustScrollbarPaddingFromResize: any;

	public deleteMode: boolean;
	public onitemclick: ((item: T, index: number, button: number) => void) | null;
	public onitemcontrolclick: ((item: T, index: number, button: number, target: HTMLElement) => void) | null;
	public onitemcontextmenu: ((item: T, index: number) => void) | null;

	public constructor(element: string | HTMLElement, label: string, useVirtualItems: boolean) {
		this.element = (((typeof element) === "string") ? document.getElementById(element as string) : element) as HTMLElement;
		this.element.classList.add("list", "scrollable");
		this.element.style.padding = "0";
		this.element.setAttribute("role", "grid");
		this.element.setAttribute("aria-label", label);
		this.element.setAttribute("aria-readonly", "true");
		this.element.setAttribute("aria-rowcount", "0");
		this.element.removeAttribute("aria-activedescendant");
		if (!this.element.getAttribute("tabindex"))
			this.element.setAttribute("tabindex", "0");

		// Not using virtual items makes mobile devices create a large
		// layer for the items if they actually overflow. Also, now that
		// the items are a child of the element, not the container, the
		// margin of the last item becomes noticeable, because it can be
		// seen when scrolling to the bottom of the list.
		this.useVirtualItems = useVirtualItems;

		const container = document.createElement("div");
		container.className = "list-container";
		//container.setAttribute("role", "rowgroup");
		this.container = container;
		if (useVirtualItems)
			this.element.appendChild(container);

		this._adapter = null;

		this.boundZoomChanged = this.zoomChanged.bind(this);
		this.boundRefreshVisibleItemsInternal = this.refreshVisibleItemsInternal.bind(this);
		this.boundAdjustScrollbarPaddingFromResize = this.adjustScrollbarPaddingFromResize.bind(this);

		this.element.addEventListener("focus", this.elementFocus.bind(this));
		this.element.addEventListener("keydown", this.elementKeyDown.bind(this));
		this.element.addEventListener("keyup", this.elementKeyUp.bind(this));
		this.element.addEventListener("blur", this.elementBlur.bind(this));

		if (useVirtualItems)
			this.element.addEventListener("scroll", this.elementScroll.bind(this), { passive: true });
		else
			this.boundNotifyCurrentItemChangedInternal = this.notifyCurrentItemChangedInternal.bind(this);

		this.resizeObserver = new ResizeObserver(this.resize.bind(this));
		this.resizeObserver.observe(this.element, { box: "border-box" });

		this.itemHeight = 1;
		this.itemMargin = 1;
		this.itemHeightAndMargin = 2;
		this.ignoreFirstIndex = false;
		this.firstIndex = 0;
		this.lastIndex = 0;
		this.currentListItem = null;
		this.currentItem = null;
		this.keyboardItem = null;
		this.clientHeight = 1;
		this.containerHeight = 0;
		this.scrollbarPadding = false;
		this.scrollbarPaddingScheduled = false;
		this.visibleCount = 1;
		this.items = [];
		this.refreshVisibleItemsEnqueued = false;
		this.notifyCurrentItemChangedEnqueued = false;

		this.focused = false;
		this.keyboardIndex = -1;
		this.lastKeyboardIndex = -1;

		this.deleteMode = false;
		this.onitemclick = null;
		this.onitemcontrolclick = null;
		this.onitemcontextmenu = null;

		this.element.onclick = this.elementClick.bind(this);
		this.element.oncontextmenu = this.elementContextMenu.bind(this);

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

			if (!this.useVirtualItems) {
				if (adapter.list.length)
					this.notifyItemsAdded(0, adapter.list.length - 1);
			} else {
				this.element.setAttribute("aria-rowcount", adapter.list.length.toString());
			}
		}
	}

	private prepareAdapter(): void {
		const adapter = this._adapter;
		if (!adapter)
			return;

		this.itemHeight = adapter.itemHeight;
		this.itemMargin = AppUI.thickBorderPX;
		this.itemHeightAndMargin = this.itemHeight + this.itemMargin;
		this.currentListItem = adapter.list.currentItem;

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

		if (this.useVirtualItems)
			this.elementScroll();

		/*const items = this.items,
			length = adapter.list.length,
			itemHeightAndMargin = this.itemHeightAndMargin,
			visibleCount = this.visibleCount;

		for (let i = 0, firstIndex = this.firstIndex, top = firstIndex * itemHeightAndMargin; i < visibleCount && firstIndex < length; i++, firstIndex++, top += itemHeightAndMargin)
			items[i].element.style.top = top + "px";*/
	}

	private adjustScrollbarPadding(): void {
		const scrollbarPadding = ((this.containerHeight | 0) > this.clientHeight);

		if (this.scrollbarPadding !== scrollbarPadding) {
			this.scrollbarPadding = scrollbarPadding;
			const element = this.element;
			if (this.useVirtualItems) {
				if (scrollbarPadding)
					element.classList.add("virtual-padding");
				else
					element.classList.remove("virtual-padding");
			} else {
				element.style.padding = (scrollbarPadding ? "" : "0");
			}
		}
	}

	private adjustScrollbarPaddingFromResize(): void {
		this.scrollbarPaddingScheduled = false;
		this.adjustScrollbarPadding();
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

			this.adjustScrollbarPadding();
		}
	}

	private clear(): void {
		const container = this.container;
		if (!container)
			return;

		const items = this.items;
		for (let i = items.length - 1; i >= 0; i--) {
			if (items[i].element) {
				const parentNode = items[i].element.parentNode;
				if (parentNode)
					parentNode.removeChild(items[i].element);
			}
		}

		if (this.useVirtualItems) {
			for (let i = items.length - 1; i >= 0; i--)
				items[i].reset();
		} else {
			for (let i = items.length - 1; i >= 0; i--)
				items[i].zero();
			items.splice(0);
		}

		this.firstIndex = 0;
		this.lastIndex = 0;
		this.currentListItem = null;
		this.currentItem = null;
		this.keyboardItem = null;
		this.element.scrollTop = 0;
		this.containerHeight = 0;
		this.container.style.height = "0";

		if (this.keyboardIndex > 0) {
			this.keyboardIndex = 0;
			this.lastKeyboardIndex = 0;
		} else {
			this.lastKeyboardIndex = -1;
		}

		this.element.setAttribute("aria-rowcount", "0");
		this.element.removeAttribute("aria-activedescendant");

		this.adjustScrollbarPadding();
	}

	private elementScroll(): void {
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

		if (this.ignoreFirstIndex)
			this.ignoreFirstIndex = false;
		else if (this.firstIndex === firstIndex)
			return;

		this.firstIndex = firstIndex;

		let visibleCount = this.visibleCount + ((firstIndex === 0) ? 2 : ((firstIndex === 1) ? 3 : 4));
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
			keyboardIndex = this.keyboardIndex;

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
						item.element.setAttribute("aria-selected", "true");
						this.element.setAttribute("aria-activedescendant", item.element.getAttribute("id") as string);
					} else {
						if (this.element.getAttribute("aria-activedescendant") === item.element.getAttribute("id"))
							this.element.removeAttribute("aria-activedescendant");
						item.element.classList.remove("keyboard");
						item.element.setAttribute("aria-selected", "false");
					}
				}

				adapter.prepareElement(listItem, firstIndex, length, item.element);
				item.element.setAttribute("aria-rowindex", firstIndex.toString());

				if (!item.item)
					element.appendChild(item.element);
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
				element.removeChild(item.element);
			}
		}

		this.lastIndex = firstIndex - 1;
		if (this.lastIndex < this.firstIndex)
			this.lastIndex = this.firstIndex;
	}

	private refreshVisibleItemsInternal(): void {
		this.refreshVisibleItemsEnqueued = false;

		const adapter = this._adapter,
			element = this.element;
		if (!adapter || !element)
			return;

		this.adjustContainerHeight();

		const items = this.items,
			itemHeightAndMargin = this.itemHeightAndMargin,
			list = adapter.list,
			length = list.length,
			currentListItem = adapter.list.currentItem,
			keyboardIndex = this.keyboardIndex;

		if (!this.useVirtualItems) {
			const visibleCount = this.visibleCount,
				newKeyboardItem = ((keyboardIndex >= 0 && keyboardIndex < items.length) ? items[keyboardIndex] : null);

			if (this.keyboardItem !== newKeyboardItem) {
				if (this.keyboardItem) {
					this.keyboardItem.element.classList.remove("keyboard");
					this.keyboardItem.element.setAttribute("aria-selected", "false");
				}

				if (newKeyboardItem) {
					newKeyboardItem.element.classList.add("keyboard");
					newKeyboardItem.element.setAttribute("aria-selected", "true");
					this.element.setAttribute("aria-activedescendant", newKeyboardItem.element.getAttribute("id") as string);
				} else {
					this.element.removeAttribute("aria-activedescendant");
				}

				this.keyboardItem = newKeyboardItem;
			}

			for (let i = 0, firstIndex = this.indexFromY(0); i <= visibleCount && firstIndex < length; i++, firstIndex++) {
				const element = items[firstIndex].element;
				adapter.prepareElement(list.item(firstIndex), firstIndex, length, element);
				element.setAttribute("aria-rowindex", firstIndex.toString());
			}

			return;
		}

		this.currentListItem = currentListItem;

		let i = 0,
			firstIndex = this.firstIndex;

		// The +4 and -2 offsets are here to force the preparation of invisible
		// items, in order to try to prevent the the appearance of blank spaces
		// at the top and at the bottom of the list when the user scrolls it
		// faster than the browser can process the script.
		let visibleCount = this.visibleCount + ((firstIndex === 0) ? 2 : ((firstIndex === 1) ? 3 : 4));
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
					item.element.setAttribute("aria-selected", "true");
					this.element.setAttribute("aria-activedescendant", item.element.getAttribute("id") as string);
				} else {
					if (this.element.getAttribute("aria-activedescendant") === item.element.getAttribute("id"))
						this.element.removeAttribute("aria-activedescendant");
					item.element.classList.remove("keyboard");
					item.element.setAttribute("aria-selected", "false");
				}
			}

			adapter.prepareElement(listItem, firstIndex, length, item.element);
			item.element.setAttribute("aria-rowindex", firstIndex.toString());

			if (!item.item)
				element.appendChild(item.element);
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
				element.removeChild(item.element);
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

			if (this.useVirtualItems) {
				const items = this.items;

				// Check out the comments inside scroll() and refreshVisibleItemsInternal(),
				// for an explanation about this offset
				while ((visibleCount + 4) > items.length)
					items.push(new ListControlItem<T>(adapter.createEmptyElement("list-item virtual")));
			}
		}

		if (oldClientHeight !== clientHeight) {
			this.clientHeight = clientHeight;

			if (this.useVirtualItems) {
				this.ignoreFirstIndex = true;
				this.elementScroll();
			}

			// Changing the padding in response to the resize event of a ResizeObserver
			// could cause a "ResizeObserver - loop limit exceeded" error
			if (!this.scrollbarPaddingScheduled) {
				this.scrollbarPaddingScheduled = true;
				requestAnimationFrame(this.boundAdjustScrollbarPaddingFromResize);
			}
		}
	}

	private elementClick(e: MouseEvent): void {
		if (!this.element || !this._adapter || !e.target) // || !(e.target as HTMLElement).classList.contains("list-item"))
			return;

		const rect = this.element.getBoundingClientRect(),
			index = this.indexFromY(e.clientY - rect.top);

		if (this.keyboardIndex >= 0) {
			this.keyboardIndex = -1;
			this.refreshVisibleItems();
		}

		if (index >= 0) {
			this.lastKeyboardIndex = index;

			const item = this._adapter.list.item(index);
			if (item) {
				if ((e.target as HTMLElement).classList.contains("list-item")) {
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
		if (!this.element || !this._adapter || !this.onitemcontextmenu || !e.target) // || !(e.target as HTMLElement).classList.contains("list-item"))
			return cancelEvent(e);

		const rect = this.element.getBoundingClientRect(),
			index = this.indexFromY(e.clientY - rect.top);

		if (this.keyboardIndex >= 0) {
			this.keyboardIndex = -1;
			this.refreshVisibleItems();
		}

		if (index >= 0) {
			this.lastKeyboardIndex = index;

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
		this.focused = true;
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
				delta = ((this.clientHeight / this.itemHeightAndMargin) | 0);
				break;
			case "PageUp":
				delta = -((this.clientHeight / this.itemHeightAndMargin) | 0);
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
			let keyboardIndex = this.keyboardIndex;

			if (keyboardIndex < 0)
				keyboardIndex = this.lastKeyboardIndex;

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

			this.keyboardIndex = keyboardIndex;

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
			this.keyboardIndex = -1;
		}

		return cancelEvent(e);
	}

	private elementKeyUp(e: KeyboardEvent): any {
		// Apparently, onkeyup is called after onfocus (when the
		// user navigates to the control using Tab or Shift+Tab)
		const adapter = this._adapter;
		if (!adapter || e.ctrlKey || e.metaKey || e.altKey || e.key !== "Tab" || !this.focused)
			return;

		const length = adapter.list.length;

		if (!length)
			return;

		let keyboardIndex = Math.min(length - 1, Math.max(0, this.lastKeyboardIndex));

		if (!this.isItemVisible(keyboardIndex))
			keyboardIndex = (this.isItemVisible(adapter.list.currentIndex) ?
				adapter.list.currentIndex :
				this.indexFromY(0));

		this.keyboardIndex = keyboardIndex;
		this.bringItemIntoView(keyboardIndex);

		this.refreshVisibleItems();
	}

	private elementBlur(): void {
		this.focused = false;

		this.lastKeyboardIndex = this.keyboardIndex;

		if (this.keyboardIndex >= 0) {
			this.keyboardIndex = -1;
			this.refreshVisibleItems();
		}
	}

	private listControlItemFromIndex(index: number): ListControlItem<T> | null {
		if (!this.items)
			return null;

		const items = this.items;

		for (let i = items.length - 1; i >= 0; i--) {
			if (items[i].index === index && items[i].item && items[i].element)
				return items[i];
		}

		return null;
	}

	public yFromIndex(index: number): number {
		return (this.element ? ((index * this.itemHeightAndMargin) - this.element.scrollTop) : 0);
	}

	public indexFromY(y: number): number {
		if (!this.element || !this._adapter)
			return -1;
		const index = ((y + this.element.scrollTop + 0.9) / this.itemHeightAndMargin) | 0;
		return ((index < 0 || index >= this._adapter.list.length) ? -1 : index);
	}

	public isItemVisible(index: number): boolean {
		const y = this.yFromIndex(index);
		return (y > -this.itemHeight && y < this.clientHeight);
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
		if (!this.refreshVisibleItemsEnqueued) {
			this.refreshVisibleItemsEnqueued = true;
			queueMicrotask(this.boundRefreshVisibleItemsInternal);
		}
	}

	public notifyCleared(): void {
		this.clear();
	}

	public notifyItemsAdded(firstIndex: number, lastIndex: number): void {
		if (this.useVirtualItems) {
			this.refreshVisibleItems();
		} else {
			const adapter = this._adapter,
				count = lastIndex - firstIndex + 1,
				element = this.element;

			if (!adapter || count <= 0 || !element)
				return;

			const items = this.items,
				list = adapter.list,
				length = list.length,
				currentListItem = list.currentItem,
				newItems: ListControlItem<T>[] = new Array(count);

			for (let i = lastIndex; i >= firstIndex; i--) {
				const listItem = list.item(i),
					item = new ListControlItem<T>(adapter.createEmptyElement("list-item real"));

				adapter.prepareElement(listItem, i, length, item.element);
				item.element.setAttribute("aria-rowindex", i.toString());
				newItems[i - firstIndex] = item;

				if (currentListItem === listItem) {
					if (this.currentItem) {
						this.currentItem.current = false;
						this.currentItem.element.classList.remove("current");
					}

					this.currentItem = item;
					item.current = true;
					item.element.classList.add("current");
				}
			}

			const insertBeforeReference = (firstIndex >= items.length ? null : items[firstIndex].element);

			if (firstIndex >= items.length)
				items.push(...newItems);
			else
				items.splice(firstIndex, 0, ...newItems);

			if (this.items.length !== list.length)
				throw new Error("Assertion error: this.items.length !== list.length");

			this.adjustContainerHeight();

			for (let i = 0; i < count; i++)
				element.insertBefore(newItems[i].element, insertBeforeReference);

			for (let i = items.length - 1; i > lastIndex; i--) {
				const element = items[i].element;
				adapter.prepareElementIndexOrLengthChanged(list.item(i), i, length, element);
				element.setAttribute("aria-rowindex", i.toString());
			}

			for (let i = firstIndex - 1; i >= 0; i--) {
				const element = items[i].element;
				adapter.prepareElementIndexOrLengthChanged(list.item(i), i, length, element);
				element.setAttribute("aria-rowindex", i.toString());
			}
		}

		if (this.element && this._adapter)
			this.element.setAttribute("aria-rowcount", this._adapter.list.length.toString());
	}

	public notifyItemsRemoved(firstIndex: number, lastIndex: number): void {
		if (this.useVirtualItems) {
			this.refreshVisibleItems();
		} else {
			const adapter = this._adapter,
				count = lastIndex - firstIndex + 1,
				element = this.element;

			if (!adapter || count <= 0 || !element)
				return;

			const items = this.items,
				list = adapter.list,
				length = list.length,
				removedItems = items.splice(firstIndex, count);

			for (let i = removedItems.length - 1; i >= 0; i--) {
				const item = removedItems[i];

				if (item.current)
					this.currentItem = null;

				element.removeChild(item.element);
				item.zero();
			}

			if (this.items.length !== list.length)
				throw new Error("Assertion error: this.items.length !== list.length");

			for (let i = items.length - 1; i >= 0; i--) {
				const element = items[i].element;
				adapter.prepareElementIndexOrLengthChanged(list.item(i), i, length, element);
				element.setAttribute("aria-rowindex", i.toString());
			}

			this.adjustContainerHeight();
		}

		if (this.element && this._adapter)
			this.element.setAttribute("aria-rowcount", this._adapter.list.length.toString());
	}

	public notifyCurrentItemChanged(oldIndex: number, newIdex: number): void {
		if (this.useVirtualItems) {
			this.refreshVisibleItems();
		} else if (!this.notifyCurrentItemChangedEnqueued) {
			this.notifyCurrentItemChangedEnqueued = true;
			queueMicrotask(this.boundNotifyCurrentItemChangedInternal);
		}
	}

	private notifyCurrentItemChangedInternal(): void {
		this.notifyCurrentItemChangedEnqueued = false;

		const adapter = this._adapter;

		if (!adapter)
			return;

		if (this.currentItem) {
			this.currentItem.current = false;
			this.currentItem.element.classList.remove("current");
		}

		const currentIndex = adapter.list.currentIndex;

		if (currentIndex >= 0 && currentIndex < this.items.length) {
			this.currentItem = this.items[currentIndex];
			this.currentItem.current = true;
			this.currentItem.element.classList.add("current");
		} else {
			this.currentItem = null;
		}
	}
}
