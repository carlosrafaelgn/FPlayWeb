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
	(id: string | undefined, button: HTMLButtonElement): void;
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
	private static internalId = 0;

	private static modal: Modal | null = null;

	public static get visible(): boolean {
		return !!Modal.modal;
	}

	public static get currentModalElement() : HTMLFormElement | null {
		return (Modal.modal ? Modal.modal.modalElement : null);
	}

	public static get currentModalHeaderElement() : HTMLDivElement | null {
		return (Modal.modal ? Modal.modal.modalHeaderElement : null);
	}

	public static get currentModalBodyElement() : HTMLDivElement | null {
		return (Modal.modal ? Modal.modal.modalBodyElement : null);
	}

	public static get currentModalFooterElement() : HTMLDivElement | null {
		return (Modal.modal ? Modal.modal.modalFooterElement : null);
	}

	public static show(options: ModalOptions): boolean {
		if (Modal.modal)
			return false;

		if (options.okCancel) {
			options.buttons = [
				{
					id: "cancel",
					defaultCancel: true,
					icon: "icon-clear",
					text: options.cancelText || Strings.Cancel,
					color: "red",
					onclick: (options.oncancel || Modal.hide)
				},
				{
					id: "ok",
					defaultSubmit: options.okCancelSubmit,
					icon: "icon-check",
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
					icon: "icon-clear",
					text: Strings.Close,
					color: "red",
					onclick: Modal.hide
				}
			];
		}

		Modal.modal = new Modal(options);

		return true;
	}

	public static hide(): void {
		if (Modal.modal)
			Modal.modal.hideInternal();
	}

	public static defaultCancelAction(): boolean {
		return (Modal.modal ? Modal.modal.defaultCancelActionInternal() : false);
	}

	public static historyStatePopped(): boolean | null {
		if (!Modal.modal)
			return null;

		if (!Modal.modal.fading)
			Modal.defaultCancelAction();

		return false;
	}

	private readonly options: ModalOptions;
	private readonly containerElement: HTMLDivElement;
	private readonly modalElement: HTMLFormElement;
	private readonly modalHeaderElement: HTMLDivElement;
	private readonly modalBodyElement: HTMLDivElement;
	private readonly modalFooterElement: HTMLDivElement;
	private readonly defaultCancelButton: HTMLButtonElement | null;
	private readonly defaultSubmitButton: HTMLButtonElement | null;
	private readonly focusBlocker: FocusBlocker;

	private readonly boundDocumentKeyDown: any;

	private fading: boolean;

	private constructor(options: ModalOptions) {
		this.options = options;

		this.focusBlocker = new FocusBlocker();
		this.focusBlocker.block();

		HistoryHandler.pushState();

		// I decided to stop using the actual dialog element + showModal() method,
		// along with the ::backdrop pseudo-element, because of lack of support in
		// Firefox and Safari (as of march 2021)
		// https://developer.mozilla.org/en-US/docs/Web/CSS/::backdrop
		// https://caniuse.com/mdn-api_htmldialogelement_showmodal
		const containerElement = document.createElement("div");
		this.containerElement = containerElement;
		containerElement.className = (!options.transparentBackground ? "modal-container fade background" : "modal-container fade");

		const headerId = "modalHeader" + Modal.internalId,
			modalElement = document.createElement("form");
		this.modalElement = modalElement;
		modalElement.setAttribute("tabindex", "-1");
		modalElement.setAttribute("role", "dialog");
		modalElement.setAttribute("aria-modal", "true");
		modalElement.setAttribute("aria-labelledby", headerId);
		modalElement.className = "modal" + (options.fullHeight ? " full-height" : "");
		modalElement.onsubmit = this.submit.bind(this);

		const modalHeaderElement = document.createElement("div");
		this.modalHeaderElement = modalHeaderElement;
		(options.titleHeader || modalHeaderElement).setAttribute("id", headerId);
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
		this.modalBodyElement = modalBodyElement;
		modalBodyElement.className = "modal-body padding" + (options.leftBody ? " left" : "");

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

		const buttons = modalBodyElement.getElementsByTagName("button");
		if (buttons && buttons.length) {
			for (let i = buttons.length - 1; i >= 0; i--) {
				const button = buttons[i];
				ButtonControl.prepare(button);
				button.onclick = () => {
					if (this.fading)
						return;

					if (this.options.onbuttonclick)
						this.options.onbuttonclick(button.id, button);
				};
			}
		}

		const modalFooterElement = document.createElement("div");
		this.modalFooterElement = modalFooterElement;
		modalFooterElement.className = "modal-footer padding left-margin right-margin";

		this.defaultCancelButton = null;
		this.defaultSubmitButton = null;

		if (options.buttons) {
			for (let i = 0; i < options.buttons.length; i++) {
				const currentButton = options.buttons[i];

				const button = ButtonControl.create(currentButton, true);
				if (currentButton.defaultCancel)
					this.defaultCancelButton = button;
				if (currentButton.defaultSubmit)
					this.defaultSubmitButton = button;
				//if (i)
				//	button.style.float = "right";
				button.onclick = () => {
					if (this.fading)
						return;

					if (currentButton.onclick)
						currentButton.onclick(currentButton.id, button);

					if (this.options.onbuttonclick)
						this.options.onbuttonclick(currentButton.id, button);
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

		this.boundDocumentKeyDown = this.documentKeyDown.bind(this);
		document.addEventListener("keydown", this.boundDocumentKeyDown, true);

		this.fading = true;

		DelayControl.delayShortCB(() => {
			if (options.onshowing)
				options.onshowing();

			this.containerElement.classList.add("in");

			DelayControl.delayFadeCB(() => {
				this.fading = false;

				const element = ((this.options.onshown && this.options.onshown()) || this.modalElement);

				try {
					element.focus();
				} catch (ex: any) {
					// Just ignore...
				}
			});
		});
	}

	private hideInternal(): void {
		if (Modal.modal !== this || this.fading)
			return;

		if (this.options.onhiding && this.options.onhiding() === false)
			return;

		document.removeEventListener("keydown", this.boundDocumentKeyDown, true);

		this.fading = true;
		this.containerElement.classList.remove("in");

		DelayControl.delayFadeCB(() => {
			Modal.modal = null;

			if (this.options.returnFocusElement) {
				try {
					this.options.returnFocusElement.focus();
				} catch (ex: any) {
					// Just ignore...
				}
			}

			if (this.options.onhidden)
				this.options.onhidden();

			document.body.removeChild(this.containerElement);

			HistoryHandler.popState();

			if (this.focusBlocker)
				this.focusBlocker.unblock();
	
			if (this.options.buttons) {
				for (let i = this.options.buttons.length - 1; i >= 0; i--)
					zeroObject(this.options.buttons[i]);
			}
			zeroObject(this.options);
			zeroObject(this);
		});
	}

	private documentKeyDown(e: KeyboardEvent): void {
		if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && !e.repeat && e.key === "Escape")
			this.defaultCancelActionInternal();
	}

	private defaultCancelActionInternal(): boolean {
		if (this.defaultCancelButton) {
			this.defaultCancelButton.click();
			return true;
		}
		return false;
	}

	private submit(e: Event): boolean {
		cancelEvent(e);

		if (this.defaultSubmitButton)
			this.defaultSubmitButton.click();

		return false;
	}
}
