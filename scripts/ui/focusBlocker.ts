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

class FocusBlocker {
	private _changedElements: { element: HTMLElement, tabIndex: number | null }[] | null;
	private _oldBodyOverflow: string | null;
	private _parentContainer: HTMLElement | null;
	private _cover: HTMLDivElement | null;
	private _coverTimeout: number;

	public constructor() {
		this._changedElements = null;
		this._oldBodyOverflow = null;
		this._parentContainer = null;
		this._cover = null;
		this._coverTimeout = 0;
	}

	public block(parentContainer?: HTMLElement | null): void {
		this.unblock();

		const elementsToDisable = (parentContainer || document).querySelectorAll("button,input,select,textarea,f-button,f-slider,f-list"),
			changedElements: { element: HTMLElement, tabIndex: number | null }[] = new Array();

		for (let i = elementsToDisable.length - 1; i >= 0; i--) {
			const element = elementsToDisable[i] as HTMLElement,
				tabIndex = element.tabIndex;

			if (tabIndex !== -1) {
				element.tabIndex = -1;
				changedElements.push({ element, tabIndex });
			}
		}

		this._changedElements = changedElements;

		if (parentContainer) {
			this._parentContainer = parentContainer;
			this._cover = document.createElement("div");
			this._cover.className = "blocker fade";
			parentContainer.appendChild(this._cover);
			this._coverTimeout = DelayControl.delayShortCB(() => {
				if (this._coverTimeout && this._cover)
					this._cover.classList.add("in");
			});
		} else {
			this._oldBodyOverflow = document.body.style.overflow;
			document.body.style.overflow = "hidden";
		}
	}

	public unblock(): void {
		const changedElements = this._changedElements;
		if (changedElements) {
			this._changedElements = null;

			for (let i = changedElements.length - 1; i >= 0; i--) {
				const changedElement = changedElements[i],
					tabIndex = changedElement.tabIndex;

				if (tabIndex !== null)
					changedElement.element.tabIndex = tabIndex;
				else
					changedElement.element.removeAttribute("tabindex");
			}
		}

		if (this._oldBodyOverflow) {
			document.body.style.overflow = this._oldBodyOverflow;
			this._oldBodyOverflow = null;
		}

		if (this._coverTimeout) {
			clearTimeout(this._coverTimeout);
			this._coverTimeout = 0;
		}

		if (this._parentContainer) {
			const parentContainer = this._parentContainer,
				cover = this._cover;

			this._parentContainer = null;
			this._cover = null;

			if (cover) {
				cover.classList.remove("in");
				DelayControl.delayFadeCB(function () { parentContainer.removeChild(cover); });
			}
		}
	}
}
