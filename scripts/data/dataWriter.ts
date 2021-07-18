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

class DataWriter {
	private arrayBuffer: ArrayBuffer;
	private dataView: DataView;
	private readonly textEncoder: TextEncoder;
	private _length: number;
	private _capacity: number;

	constructor(initialCapacity?: number) {
		this._capacity = ((initialCapacity && initialCapacity > 0) ? initialCapacity : 16384);
		this.arrayBuffer = new ArrayBuffer(this._capacity);
		this.dataView = new DataView(this.arrayBuffer);
		this.textEncoder = new TextEncoder();
		this._length = 0;
	}

	public get trimmedArrayBuffer(): ArrayBuffer {
		return this.arrayBuffer.slice(0, this._length);
	}

	public get length(): number {
		return this._length;
	}

	public get capacity(): number {
		return this._capacity;
	}

	public destroy(): void {
		zeroObject(this);
	}

	private ensureCapacity(extraLength: number): void {
		const desired = this._length + extraLength;
		if (desired <= this._capacity)
			return;

		const arrayBuffer = new ArrayBuffer(desired + (desired >> 2));
		(new Uint8Array(arrayBuffer)).set(new Uint8Array(this.arrayBuffer));
		this.arrayBuffer = arrayBuffer;
		this.dataView = new DataView(this.arrayBuffer);
		this._capacity = arrayBuffer.byteLength;
	}

	public writeInt8(value: number): DataWriter {
		this.ensureCapacity(1);
		this.dataView.setInt8(this._length++, value);
		return this;
	}

	public writeUint8(value: number): DataWriter {
		this.ensureCapacity(1);
		this.dataView.setUint8(this._length++, value);
		return this;
	}

	public writeInt16(value: number): DataWriter {
		this.ensureCapacity(2);
		this.dataView.setInt16(this._length, value, true);
		this._length += 2;
		return this;
	}

	public writeUint16(value: number): DataWriter {
		this.ensureCapacity(2);
		this.dataView.setUint16(this._length, value, true);
		this._length += 2;
		return this;
	}

	public writeInt32(value: number): DataWriter {
		this.ensureCapacity(4);
		this.dataView.setInt32(this._length, value, true);
		this._length += 4;
		return this;
	}

	public writeFloat32(value: number): DataWriter {
		this.ensureCapacity(4);
		this.dataView.setFloat32(this._length, value, true);
		this._length += 4;
		return this;
	}

	public writeFloat64(value: number): DataWriter {
		this.ensureCapacity(8);
		this.dataView.setFloat64(this._length, value, true);
		this._length += 8;
		return this;
	}

	public writeString(value: string | null): DataWriter {
		if (!value)
			return this.writeInt16(0);

		this.ensureCapacity(2 + (value.length * 6));

		const r = this.textEncoder.encodeInto(value, new Uint8Array(this.arrayBuffer, this._length + 2));
		if (!r.written)
			throw new Error("String encoding error");

		if (r.written > 0xFFFF)
			throw new Error("String too large");

		this.dataView.setUint16(this._length, r.written, true);
		this._length += 2 + r.written;

		return this;
	}
}
