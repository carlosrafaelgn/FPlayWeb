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

abstract class ListAdapter<T extends ListItem> {
	public readonly list: List<T>;

	public control: ListControl<T> | null;

	public constructor(list: List<T>, control?: ListControl<T> | null) {
		this.list = list;

		this.control = (control || null);

		list.adapter = this;
	}

	public destroy(): void {
		const oldList = this.list,
			oldControl = this.control;

		if (!oldList)
			return;

		zeroObject(this);

		oldList.adapter = null;

		if (oldControl)
			oldControl.adapter = null;
	}

	public cleared(): void {
		if (this.control)
			this.control.notifyCleared();
	}

	public itemsAdded(firstIndex: number, lastIndex: number): void {
		if (this.control)
			this.control.notifyItemsAdded(firstIndex, lastIndex);
	}

	public itemsRemoved(firstIndex: number, lastIndex: number): void {
		if (this.control)
			this.control.notifyItemsRemoved(firstIndex, lastIndex);
	}

	public currentItemChanged(oldIndex: number, newIdex: number): void {
		if (this.control)
			this.control.notifyCurrentItemChanged(oldIndex, newIdex);
	}

	public abstract get itemHeight(): number;

	public abstract createEmptyElement(baseClass: string): HTMLElement;

	public abstract prepareElement(item: T, index: number, length: number, element: HTMLElement): void;

	public abstract prepareElementIndexOrLengthChanged(item: T, index: number, length: number, element: HTMLElement): void;
}

abstract class List<T extends ListItem> {
	protected items: T[];

	private _currentIndex: number;
	private _currentItem: T | null;

	private _adapter: ListAdapter<T> | null;

	public modified: boolean;

	public constructor(items?: T[] | null, currentIndex?: number) {
		this.items = (items || []);

		this._currentIndex = (currentIndex === undefined ? -1 : currentIndex);

		this._adapter = null;

		this.modified = false;

		if (!this.items.length) {
			this._currentIndex = -1;
			this._currentItem = null;
		} else {
			if (this._currentIndex < 0)
				this._currentIndex = -1;
			else if (this._currentIndex >= this.items.length)
				this._currentIndex = this.items.length - 1;

			this._currentItem = (this._currentIndex >= 0 ? this.items[this._currentIndex] : null);
		}
	}

	public destroy(): void {
		if (!this.items)
			return;

		(this.items as Array<any>).fill(null);

		const oldAdapter = this._adapter;

		zeroObject(this);

		if (oldAdapter)
			oldAdapter.destroy();
	}

	public get adapter(): ListAdapter<T> | null {
		return this._adapter;
	}

	public set adapter(adapter: ListAdapter<T> | null) {
		if (!this.items || this._adapter === adapter)
			return;

		if (this._adapter)
			this._adapter.destroy();

		this._adapter = adapter;
	}

	public get length(): number {
		return (this.items ? this.items.length : 0);
	}

	public get currentIndex(): number {
		return (this._currentItem ? this._currentIndex : -1);
	}

	public set currentIndex(currentIndex: number) {
		if (currentIndex >= this.items.length)
			currentIndex = this.items.length - 1;
		if (currentIndex < 0)
			currentIndex = 0;

		const newItem = ((currentIndex < this.items.length) ? this.items[currentIndex] : null),
			oldIndex = this._currentIndex,
			oldItem = this._currentItem;

		this._currentIndex = (newItem ? currentIndex : -1);

		if (oldIndex !== currentIndex || oldItem !== newItem) {
			this.modified = true;

			this._currentItem = newItem;

			if (this._adapter)
				this._adapter.currentItemChanged(oldItem ? oldIndex : -1, this._currentIndex);
		}
	}

	public get currentItem(): T | null {
		return this._currentItem;
	}

	public item(index: number): T {
		return this.items[index];
	}

	public abstract estimateSerializedLength(): number;

	public serialize(writer?: DataWriter | null): DataWriter {
		const items = this.items,
			count = items.length;

		if (!writer)
			writer = new DataWriter(this.estimateSerializedLength());

		writer.writeUint8(0) // version
			.writeInt32(count)
			.writeInt32(this._currentIndex);

		for (let i = 0; i < count; i++)
			items[i].serialize(writer);

		return writer;
	}

	public serializeWeb(): any {
		const items = this.items,
			count = items.length,
			tmp = new Array(count);

		for (let i = 0; i < count; i++)
			tmp[i] = items[i].serializeWeb();

		return {
			currentIndex: this._currentIndex,
			items: tmp
		};
	}

	public moveCurrentToPrevious(): number {
		this.currentIndex = (!this._currentItem ? this._currentIndex : (this._currentIndex <= 0 ? (this.items.length - 1) : (this._currentIndex - 1)));
		return this._currentIndex;
	}

	public moveCurrentToNext(): number {
		this.currentIndex = (!this._currentItem ? this._currentIndex : (this._currentIndex >= (this.items.length - 1) ? 0 : (this._currentIndex + 1)));
		return this._currentIndex;
	}

	public clear(): void {
		const oldCurrentIndex = this._currentIndex,
			oldCurrentItem = this._currentItem;

		if (this.items)
			(this.items as Array<any>).fill(null);

		this.modified = true;

		this.items = [];
		this._currentIndex = -1;
		this._currentItem = null;

		if (this._adapter) {
			this._adapter.cleared();

			if (oldCurrentItem)
				this._adapter.currentItemChanged(oldCurrentIndex, -1);
		}
	}

	public addItem(item: T, index?: number): number {
		if (!this.items || !item)
			return -1;

		if (index === undefined || index < 0 || index >= this.items.length) {
			index = this.items.length;
			this.items.push(item as T);
		} else {
			this.items.splice(index, 0, item);
		}

		this.modified = true;

		if (this._adapter)
			this._adapter.itemsAdded(index, index);

		if (this._currentIndex >= 0 && index <= this._currentIndex)
			this._currentIndex++;

		return index;
	}

	public addItems(items: T[], index?: number): number {
		if (!this.items || !items || !items.length)
			return -1;

		if (index === undefined || index < 0 || index >= this.items.length) {
			index = this.items.length;
			this.items.push(...items);
		} else {
			this.items.splice(index, 0, ...items);
		}

		this.modified = true;

		if (this._adapter)
			this._adapter.itemsAdded(index, index + items.length - 1);

		if (this._currentIndex >= 0 && index <= this._currentIndex)
			this._currentIndex += items.length;

		return index;
	}

	public removeItems(firstIndex: number, lastIndex?: number): number {
		if (!this.items || firstIndex < 0 || firstIndex >= this.items.length)
			return 0;

		if (lastIndex === undefined || lastIndex < firstIndex)
			lastIndex = firstIndex;
		else if (lastIndex >= this.items.length)
			lastIndex = this.items.length - 1;

		const count = lastIndex - firstIndex + 1;

		this.items.splice(firstIndex, count);

		this.modified = true;

		if (this._currentIndex >= 0) {
			if (lastIndex < this._currentIndex) {
				this._currentIndex -= count;
			} else if (firstIndex <= this._currentIndex && this._currentItem) {
				// Clear _currentItem but leave _currentIndex as is to make
				// moveCurrentToPrevious() and moveCurrentToNext() work nicely
				this._currentItem = null;

				if (this._adapter)
					this._adapter.currentItemChanged(this._currentIndex, -1);
			}
		}

		if (this._adapter)
			this._adapter.itemsRemoved(firstIndex, lastIndex);

		return count;
	}
}
