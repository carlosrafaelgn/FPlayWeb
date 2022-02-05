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

class Formatter {
	public static readonly zero = "0:00";
	public static readonly none = "-";
	public static readonly noneInt = -1;

	public static formatTimeMS(timeMS: number): string {
		if (timeMS < 0)
			return Formatter.none;

		let timeS = (timeMS / 1000) | 0;
		let r = ((timeS / 60) | 0) + ":";
		timeS %= 60;
		if (timeS < 10) r += "0";
		return r + timeS;
	}

	public static formatTimeS(timeS: number): string {
		if (timeS < 0)
			return Formatter.none;

		let r = ((timeS / 60) | 0) + ":";
		timeS %= 60;
		if (timeS < 10) r += "0";
		return r + timeS;
	}

	public static formatDB(dB: number): string {
		return ((dB < 0) ? Strings.toFixed(dB, 1) : ((dB === 0) ? "-" + Strings.toFixed(dB, 1) : "+" + Strings.toFixed(dB, 1)));
	}
}
