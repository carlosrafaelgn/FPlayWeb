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

class DelayControl {
	public static readonly shortDelayMS = 10;
	public static readonly uiDelayMS = 310;

	public static delayShortCB(callback: () => void): number {
		return setTimeout(callback, DelayControl.shortDelayMS);
	}

	public static delayUICB(callback: () => void): number {
		return setTimeout(callback, DelayControl.uiDelayMS);
	}

	public static delayShort(): Promise<void> {
		return new Promise(function (resolve) { setTimeout(resolve, DelayControl.shortDelayMS); });
	}

	public static delayUI(): Promise<void> {
		return new Promise(function (resolve) { setTimeout(resolve, DelayControl.uiDelayMS); });
	}
}
