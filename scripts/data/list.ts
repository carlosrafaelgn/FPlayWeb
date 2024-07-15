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

interface SerializableListItem {
	estimateSerializedLength(): number;
	serialize(writer: DataWriter): DataWriter;
	serializeWeb(): any;
}

abstract class ListAdapter<T extends Object> {
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

	public itemsChanged(newLength: number): void {
		if (this.control) {
			this.control.notifyCleared();
			this.control.notifyItemsAdded(0, newLength - 1);
		}
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

class List<T extends Object> {
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

	public get nextItem(): T | null {
		let nextIndex = this._currentIndex + 1;
		if (nextIndex >= this.items.length)
			nextIndex = this.items.length - 1;
		if (nextIndex < 0)
			nextIndex = 0;

		return ((nextIndex < this.items.length) ? this.items[nextIndex] : null);
	}

	public item(index: number): T {
		return this.items[index];
	}

	public estimateSerializedLength(): number {
		const items = this.items;

		if (!items || !items[0] || !("estimateSerializedLength" in items[0]))
			return 0;

		let total = 0;
		for (let i = items.length - 1; i >= 0; i--)
			total += (items[i] as any).estimateSerializedLength();

		return total + 128;
	}

	protected get version(): number {
		return 0;
	}

	protected serializeExtraProperties(writer: DataWriter, count: number): DataWriter {
		return writer;
	}

	protected serializeExtraPropertiesWeb(serializedObject: any): any {
		return serializedObject;
	}

	public serialize(writer?: DataWriter | null): DataWriter {
		if (!writer)
			writer = new DataWriter(this.estimateSerializedLength());

		const items = this.items,
			count = ((items && items[0] && ("serialize" in items[0])) ? items.length : 0);

		writer.writeUint8(this.version)
			.writeInt32(count)
			.writeInt32(this._currentIndex);

		this.serializeExtraProperties(writer, count);

		for (let i = 0; i < count; i++)
			(items[i] as any).serialize(writer);

		return writer;
	}

	public serializeWeb(): any {
		const items = this.items,
			count = ((items && items[0] && ("serializeWeb" in items[0])) ? items.length : 0),
			tmp = new Array(count);

		for (let i = 0; i < count; i++)
			tmp[i] = (items[i] as any).serializeWeb();

		return this.serializeExtraPropertiesWeb({
			currentIndex: this._currentIndex,
			items: tmp
		});
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

	public changeItems(items: T[] | null): void {
		if (!items || !items.length) {
			this.clear();
			return;
		}

		if (this.items)
			(this.items as Array<any>).fill(null);

		this.modified = true;

		this.items = items.slice();
		this._currentIndex = -1;
		this._currentItem = null;

		if (this._adapter)
			this._adapter.itemsChanged(items.length);
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

		if (lastIndex === undefined || lastIndex >= this.items.length)
			lastIndex = this.items.length - 1;
		else if (lastIndex < firstIndex)
			lastIndex = firstIndex;

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
