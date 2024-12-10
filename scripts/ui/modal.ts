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

//
// This file came from my other project: https://github.com/carlosrafaelgn/pixel
//
interface ModalButtonCallback {
	(id: string | undefined, button: ButtonControl): void;
}

interface ModalButtonOptions extends CommonButtonControlOptions {
	id: string;
	defaultCancel?: boolean;
	defaultSubmit?: boolean;
	onclick?: ModalButtonCallback;
}

interface ModalOptions {
	text?: string;
	html?: string | HTMLElement | HTMLElement[];
	title?: string | HTMLElement;
	titleHeader?: HTMLElement;
	titleStringKey?: string;
	returnFocusElement?: HTMLElement | null;
	transparentBackground?: boolean;
	rightHeader?: boolean;
	leftBody?: boolean;
	skipBody?: boolean;
	fullHeight?: boolean;
	okText?: string | null;
	cancelText?: string | null;
	okCancel?: boolean;
	okCancelSubmit?: boolean;
	buttons?: ModalButtonOptions[];
	onbuttonclick?: ModalButtonCallback;
	onshowing?: () => void;
	onshown?: () => HTMLElement | null;
	onhiding?: () => boolean;
	onhidden?: () => void;
	onok?: () => void;
	oncancel?: () => void;
}

class Modal {
	private static _internalId = 0;

	private static _modal: Modal | null = null;

	public static get visible(): boolean {
		return !!Modal._modal;
	}

	public static get currentModalElement() : HTMLFormElement | null {
		return (Modal._modal ? Modal._modal._modalElement : null);
	}

	public static get currentModalHeaderElement() : HTMLDivElement | null {
		return (Modal._modal ? Modal._modal._modalHeaderElement : null);
	}

	public static get currentModalBodyElement() : HTMLDivElement | null {
		return (Modal._modal ? Modal._modal._modalBodyElement : null);
	}

	public static get currentModalFooterElement() : HTMLDivElement | null {
		return (Modal._modal ? Modal._modal._modalFooterElement : null);
	}

	public static show(options: ModalOptions): boolean {
		if (Modal._modal)
			return false;

		if (options.okCancel) {
			options.buttons = [
				{
					id: "cancel",
					defaultCancel: true,
					iconName: "icon-clear",
					text: options.cancelText || Strings.Cancel,
					color: "red",
					onclick: (options.oncancel || Modal.hide)
				},
				{
					id: "ok",
					defaultSubmit: options.okCancelSubmit,
					iconName: "icon-check",
					text: options.okText || Strings.OK,
					color: "green",
					onclick: (options.onok || Modal.hide)
				}
			];
		} else if (!options.buttons || !options.buttons.length) {
			options.buttons = [
				{
					id: "cancel",
					defaultCancel: true,
					iconName: "icon-clear",
					text: Strings.Close,
					color: "red",
					onclick: Modal.hide
				}
			];
		}

		Modal._modal = new Modal(options);

		return true;
	}

	public static hide(): void {
		if (Modal._modal)
			Modal._modal.hideInternal();
	}

	public static defaultCancelAction(): boolean {
		return (Modal._modal ? Modal._modal.defaultCancelActionInternal() : false);
	}

	public static historyStatePopped(): boolean | null {
		if (!Modal._modal)
			return null;

		if (!Modal._modal._fading)
			Modal.defaultCancelAction();

		return false;
	}

	private readonly _options: ModalOptions;
	private readonly _containerElement: HTMLDivElement;
	private readonly _modalElement: HTMLFormElement;
	private readonly _modalHeaderElement: HTMLHeadingElement;
	private readonly _modalBodyElement: HTMLDivElement;
	private readonly _modalFooterElement: HTMLDivElement;
	private readonly _defaultCancelButton: ButtonControl | null;
	private readonly _defaultSubmitButton: ButtonControl | null;
	private readonly _focusBlocker: FocusBlocker;

	private readonly _boundDocumentKeyDown: any;

	private _fading: boolean;

	private constructor(options: ModalOptions) {
		this._options = options;

		this._focusBlocker = new FocusBlocker();
		this._focusBlocker.block();

		HistoryHandler.pushState();

		// I decided to stop using the actual dialog element + showModal() method,
		// along with the ::backdrop pseudo-element, because of lack of support in
		// Firefox and Safari (as of march 2021)
		// https://developer.mozilla.org/en-US/docs/Web/CSS/::backdrop
		// https://caniuse.com/mdn-api_htmldialogelement_showmodal
		const containerElement = document.createElement("div");
		this._containerElement = containerElement;
		containerElement.className = (!options.transparentBackground ? "modal-container fade background" : "modal-container fade");

		const headerId = "modalHeader" + Modal._internalId,
			modalElement = document.createElement("form");
		this._modalElement = modalElement;
		modalElement.tabIndex = -1;
		modalElement.role = "dialog";
		modalElement.ariaModal = "true";
		modalElement.setAttribute("aria-labelledby", headerId);
		modalElement.className = "modal" + (options.fullHeight ? " full-height" : "");
		modalElement.onsubmit = this.submit.bind(this);

		const modalHeaderElement = document.createElement("h1");
		this._modalHeaderElement = modalHeaderElement;
		(options.titleHeader || modalHeaderElement).id = headerId;
		modalHeaderElement.className = "modal-header padding" + (options.rightHeader ? " right" : "");
		if (options.title) {
			if ((typeof options.title) === "string")
				modalHeaderElement.innerHTML = options.title as string;
			else
				modalHeaderElement.appendChild(options.title as HTMLElement);
		} else {
			modalHeaderElement.innerHTML = (options.titleStringKey ? Strings.translate(options.titleStringKey) : Strings.Oops);
		}

		const modalBodyElement = document.createElement("div");
		this._modalBodyElement = modalBodyElement;
		modalBodyElement.className = "modal-body scrollable padding top-margin" + (options.leftBody ? " left" : "");

		if (!options.html) {
			options.html = document.createElement("div");
			if (options.text)
				Strings.changeText(options.html, options.text);
		}

		if ((typeof options.html) === "string") {
			modalBodyElement.innerHTML = options.html as string;
		} else if (Array.isArray(options.html)) {
			const elements = options.html as HTMLElement[];
			for (let i = 0; i < elements.length; i++)
				modalBodyElement.appendChild(elements[i]);
		} else {
			modalBodyElement.appendChild(options.html as HTMLElement);
		}

		const modalFooterElement = document.createElement("div");
		this._modalFooterElement = modalFooterElement;
		modalFooterElement.className = "modal-footer padding top-border left-margin right-margin";

		this._defaultCancelButton = null;
		this._defaultSubmitButton = null;

		if (options.buttons) {
			for (let i = 0; i < options.buttons.length; i++) {
				const currentButton = options.buttons[i];

				const button = ButtonControl.create(currentButton, true);
				if (currentButton.defaultCancel)
					this._defaultCancelButton = button;
				if (currentButton.defaultSubmit)
					this._defaultSubmitButton = button;
				//if (i)
				//	button.style.float = "right";
				button.onclick = () => {
					if (this._fading)
						return;

					if (currentButton.onclick)
						currentButton.onclick(currentButton.id, button);

					if (this._options.onbuttonclick)
						this._options.onbuttonclick(currentButton.id, button);
				};

				modalFooterElement.appendChild(button);
			}
		}

		modalElement.appendChild(modalHeaderElement);
		if (options.skipBody) {
			while (modalBodyElement.firstChild) {
				const child = modalBodyElement.firstChild;
				modalBodyElement.removeChild(child);
				modalElement.appendChild(child);
			}
		} else {
			modalElement.appendChild(modalBodyElement);
		}
		modalElement.appendChild(modalFooterElement);
		containerElement.appendChild(modalElement);
		document.body.appendChild(containerElement);

		this._boundDocumentKeyDown = this.documentKeyDown.bind(this);
		document.addEventListener("keydown", this._boundDocumentKeyDown, true);

		this._fading = true;

		DelayControl.delayShortCB(() => {
			if (options.onshowing)
				options.onshowing();

			this._containerElement.classList.add("in");

			DelayControl.delayFadeCB(() => {
				this._fading = false;

				const element = ((this._options.onshown && this._options.onshown()) || this._modalElement);

				try {
					element.focus();
				} catch (ex: any) {
					// Just ignore...
				}
			});
		});
	}

	private hideInternal(): void {
		if (Modal._modal !== this || this._fading)
			return;

		if (this._options.onhiding && this._options.onhiding() === false)
			return;

		document.removeEventListener("keydown", this._boundDocumentKeyDown, true);

		this._fading = true;
		this._containerElement.classList.remove("in");

		DelayControl.delayFadeCB(() => {
			Modal._modal = null;

			if (this._options.returnFocusElement) {
				try {
					this._options.returnFocusElement.focus();
				} catch (ex: any) {
					// Just ignore...
				}
			}

			if (this._options.onhidden)
				this._options.onhidden();

			document.body.removeChild(this._containerElement);

			HistoryHandler.popState();

			if (this._focusBlocker)
				this._focusBlocker.unblock();
	
			if (this._options.buttons) {
				for (let i = this._options.buttons.length - 1; i >= 0; i--)
					zeroObject(this._options.buttons[i]);
			}
			zeroObject(this._options);
			zeroObject(this);
		});
	}

	private documentKeyDown(e: KeyboardEvent): void {
		if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && !e.repeat && e.key === "Escape")
			this.defaultCancelActionInternal();
	}

	private defaultCancelActionInternal(): boolean {
		if (this._defaultCancelButton) {
			this._defaultCancelButton.click();
			return true;
		}
		return false;
	}

	private submit(e: Event): boolean {
		cancelEvent(e);

		if (this._defaultSubmitButton)
			this._defaultSubmitButton.click();

		return false;
	}
}
