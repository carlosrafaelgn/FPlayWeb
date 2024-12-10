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

class Alert {
	private static readonly _shortDelayMS = 2500;
	private static readonly _longDelayMS = 4500;

	private static _timeout = 0;
	private static _element: HTMLDivElement | null = null;

	private static removeElement(): void {
		if (!Alert._element)
			return;

		const timeout = parseInt(Alert._element.dataset["timeout"] as string);
		if (timeout !== Alert._timeout)
			return;

		document.body.removeChild(Alert._element);

		Alert._timeout = 0;
		Alert._element = null;
	}

	private static hideByTimeout(): void {
		if (!Alert._element)
			return;

		const timeout = parseInt(Alert._element.dataset["timeout"] as string);
		if (timeout !== Alert._timeout)
			return;

		Alert._timeout = 0;

		Alert.hide();
	}

	public static hide(): void {
		if (!Alert._element || !Alert._element.classList.contains("in"))
			return;

		if (Alert._timeout)
			clearTimeout(Alert._timeout);

		Alert._element.classList.remove("in");

		Alert._timeout = DelayControl.delayFadeCB(Alert.removeElement);

		Alert._element.dataset["timeout"] = Alert._timeout.toString();
	}

	public static show(text: string, important?: boolean): void {
		if (Alert._timeout) {
			clearTimeout(Alert._timeout);
			Alert._timeout = 0;
		}

		if (!Alert._element) {
			Alert._element = document.createElement("div");
			Alert._element.role = "alert";
			Alert._element.className = "alert fade";
			Alert._element.onclick = Alert.hide;

			document.body.appendChild(Alert._element);

			DelayControl.delayShortCB(function () { Alert.show(text, important); });
			return;
		}

		Strings.changeText(Alert._element, text);

		Alert._element.classList.add("in");

		Alert._timeout = setTimeout(Alert.hideByTimeout, DelayControl.fadeDelayMS + (important ? Alert._longDelayMS : Alert._shortDelayMS));

		Alert._element.dataset["timeout"] = Alert._timeout.toString();
	}
}
