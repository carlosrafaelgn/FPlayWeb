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
	private static readonly shortDelayMS = 2500;
	private static readonly longDelayMS = 4500;

	private static timeout = 0;
	private static element: HTMLDivElement | null = null;

	private static removeElement(): void {
		if (!Alert.element)
			return;

		const timeout = parseInt(Alert.element.getAttribute("data-timeout") as string);
		if (timeout !== Alert.timeout)
			return;

		document.body.removeChild(Alert.element);

		Alert.timeout = 0;
		Alert.element = null;
	}

	private static hideByTimeout(): void {
		if (!Alert.element)
			return;

		const timeout = parseInt(Alert.element.getAttribute("data-timeout") as string);
		if (timeout !== Alert.timeout)
			return;

		Alert.timeout = 0;

		Alert.hide();
	}

	public static hide(): void {
		if (!Alert.element || !Alert.element.classList.contains("in"))
			return;

		if (Alert.timeout)
			clearTimeout(Alert.timeout);

		Alert.element.classList.remove("in");

		Alert.timeout = DelayControl.delayUICB(Alert.removeElement);

		Alert.element.setAttribute("data-timeout", Alert.timeout.toString());
	}

	public static show(text: string, important?: boolean): void {
		if (Alert.timeout) {
			clearTimeout(Alert.timeout);
			Alert.timeout = 0;
		}

		if (!Alert.element) {
			Alert.element = document.createElement("div");
			Alert.element.className = "alert fade";
			Alert.element.onclick = Alert.hide;

			document.body.appendChild(Alert.element);

			DelayControl.delayShortCB(function () { Alert.show(text, important); });
			return;
		}

		Strings.changeText(Alert.element, text);

		Alert.element.classList.add("in");

		Alert.timeout = setTimeout(Alert.hideByTimeout, DelayControl.uiDelayMS + (important ? Alert.longDelayMS : Alert.shortDelayMS));

		Alert.element.setAttribute("data-timeout", Alert.timeout.toString());
	}
}
