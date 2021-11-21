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

class DataReader {
	private readonly arrayBuffer: ArrayBuffer;
	private readonly dataView: DataView;
	private readonly textDecoder: TextDecoder;
	private _position: number;

	public readonly length: number;

	public constructor(arrayBuffer: ArrayBuffer) {
		this.arrayBuffer = arrayBuffer;
		this.dataView = new DataView(arrayBuffer);
		this.textDecoder = new TextDecoder("utf-8", { ignoreBOM: true });
		this._position = 0;
		this.length = arrayBuffer.byteLength;
	}

	public get position(): number {
		return this._position;
	}

	public get available(): number {
		return this.length - this._position;
	}

	public destroy(): void {
		zeroObject(this);
	}

	public readInt8(): number {
		return this.dataView.getInt8(this._position++);
	}

	public readUint8(): number {
		return this.dataView.getUint8(this._position++);
	}

	public readInt16(): number {
		const r = this.dataView.getInt16(this._position, true);
		this._position += 2;
		return r;
	}

	public readUint16(): number {
		const r = this.dataView.getUint16(this._position, true);
		this._position += 2;
		return r;
	}

	public readInt32(): number {
		const r = this.dataView.getInt32(this._position, true);
		this._position += 4;
		return r;
	}

	public readFloat32(): number {
		const r = this.dataView.getFloat32(this._position, true);
		this._position += 4;
		return r;
	}

	public readFloat64(): number {
		const r = this.dataView.getFloat64(this._position, true);
		this._position += 8;
		return r;
	}

	public readString(): string {
		const len = this.dataView.getUint16(this._position, true);
		this._position += 2;
		return (len ? this.textDecoder.decode(this.arrayBuffer.slice(this._position, this._position += len)) : "");
	}
}
