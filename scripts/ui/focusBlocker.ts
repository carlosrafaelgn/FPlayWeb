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
	private changedElements: { element: HTMLElement, tabindex: string | null }[] | null;
	private oldBodyOverflow: string | null;
	private parentContainer: HTMLElement | null;
	private cover: HTMLDivElement | null;
	private coverTimeout: number;

	public constructor() {
		this.changedElements = null;
		this.oldBodyOverflow = null;
		this.parentContainer = null;
		this.cover = null;
		this.coverTimeout = 0;
	}

	public block(parentContainer?: HTMLElement | null): void {
		this.unblock();

		const elementsToDisable = (parentContainer || document).querySelectorAll("button,input,select,textarea,.slider-control"),
			changedElements: { element: HTMLElement, tabindex: string | null }[] = new Array();

		for (let i = elementsToDisable.length - 1; i >= 0; i--) {
			const element = elementsToDisable[i] as HTMLElement,
				tabindex = element.getAttribute("tabindex");

			if (tabindex !== "-1") {
				element.setAttribute("tabindex", "-1");
				changedElements.push({ element, tabindex });
			}
		}

		this.changedElements = changedElements;

		if (parentContainer) {
			this.parentContainer = parentContainer;
			this.cover = document.createElement("div");
			this.cover.className = "blocker fade";
			parentContainer.appendChild(this.cover);
			this.coverTimeout = DelayControl.delayShortCB(() => {
				if (this.coverTimeout && this.cover)
					this.cover.classList.add("in");
			});
		} else {
			this.oldBodyOverflow = document.body.style.overflow;
			document.body.style.overflow = "hidden";
		}
	}

	public unblock(): void {
		const changedElements = this.changedElements;
		if (changedElements) {
			this.changedElements = null;

			for (let i = changedElements.length - 1; i >= 0; i--) {
				const changedElement = changedElements[i],
					tabindex = changedElement.tabindex;

				if (tabindex)
					changedElement.element.setAttribute("tabindex", tabindex);
				else
					changedElement.element.removeAttribute("tabindex");
			}
		}

		if (this.oldBodyOverflow) {
			document.body.style.overflow = this.oldBodyOverflow;
			this.oldBodyOverflow = null;
		}

		if (this.coverTimeout) {
			clearTimeout(this.coverTimeout);
			this.coverTimeout = 0;
		}

		if (this.parentContainer) {
			const parentContainer = this.parentContainer,
				cover = this.cover;

			this.parentContainer = null;
			this.cover = null;

			if (cover) {
				cover.classList.remove("in");
				DelayControl.delayFadeCB(function () { parentContainer.removeChild(cover); });
			}
		}
	}
}
