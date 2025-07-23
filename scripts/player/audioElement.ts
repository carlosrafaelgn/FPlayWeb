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

abstract class AudioElement {
	public onabort: (() => void) | null;
	public oncanplay: (() => void) | null;
	public ondurationchange: (() => void) | null;
	public onemptied: (() => void) | null;
	public onended: (() => void) | null;
	public onerror: ((e: Event | string, source?: string, lineno?: number, colno?: number, error?: Error) => void) | null;
	public onloadstart: (() => void) | null;
	public onpause: (() => void) | null;
	public onplaying: (() => void) | null;
	public ontimeupdate: (() => void) | null;
	public onwaiting: (() => void) | null;

	public abstract get volume(): number;
	public abstract set volume(volume: number);

	public abstract get muted(): boolean;
	public abstract set muted(muted: boolean);

	public abstract get currentTime(): number;
	public abstract set currentTime(time: number);

	public abstract get duration(): number;
	public abstract get paused(): boolean;
	public abstract get seekable(): TimeRanges | null;

	public abstract load(): void;
	public abstract play(): Promise<void>;
	public abstract pause(): void;

	// Not present in HTMLAudioElement
	public abstract get customProvider(): CustomProvider;
	public abstract get audioNode(): AudioNode;

	public abstract destroy(): void;

	protected constructor() {
		this.onabort = null;
		this.oncanplay = null;
		this.ondurationchange = null;
		this.onemptied = null;
		this.onended = null;
		this.onerror = null;
		this.onloadstart = null;
		this.onpause = null;
		this.onplaying = null;
		this.ontimeupdate = null;
		this.onwaiting = null;
	}
}
