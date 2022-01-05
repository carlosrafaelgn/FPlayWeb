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

class HistoryHandler {
	private static readonly state = { id: Strings.AppName };

	private static poppedInternally = false;
	private static handlers: (() => boolean | null)[];

	public static init(...handlers: (() => boolean | null)[]): void {
		HistoryHandler.handlers = handlers || [];

		window.addEventListener("popstate", HistoryHandler.historyStatePopped);
	}

	private static historyStatePopped(ev: PopStateEvent): void {
		if (HistoryHandler.poppedInternally) {
			HistoryHandler.poppedInternally = false;
			return;
		}

		const handlers = HistoryHandler.handlers;
		if (!handlers)
			return;

		for (let i = 0; i < handlers.length; i++) {
			const r = handlers[i]();

			if (r === null)
				continue;

			if (!r)
				HistoryHandler.pushState();

			break;
		}
	}

	public static pushState(): void {
		window.history.pushState(HistoryHandler.state, Strings.AppName);
	}

	public static popState(): void {
		if (window.history.state && window.history.state.id === Strings.AppName) {
			HistoryHandler.poppedInternally = true;
			window.history.back();
		}
	}
}
