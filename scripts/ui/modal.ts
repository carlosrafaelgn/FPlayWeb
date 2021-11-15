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
	html: string | HTMLElement;
	title?: string;
	titleStringKey?: string;
	transparentBackground?: boolean;
	oktext?: string | null;
	canceltext?: string | null;
	okcancel?: boolean;
	okcancelsubmit?: boolean;
	buttons?: ModalButtonOptions[];
	onbuttonclick?: ModalButtonCallback;
	onshowing?: () => void;
	onshown?: () => void;
	onhiding?: () => boolean;
	onhidden?: () => void;
	onok?: () => void;
	oncancel?: () => void;
}

class Modal {
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

		if (options.okcancel) {
			options.buttons = [
				{
					id: "cancel",
					defaultCancel: true,
					icon: "icon-clear",
					text: options.canceltext || Strings.Cancel,
					color: "red",
					onclick: (options.oncancel || Modal.hide),
				},
				{
					id: "ok",
					defaultSubmit: options.okcancelsubmit,
					icon: "icon-check",
					text: options.oktext || Strings.OK,
					color: "green",
					onclick: (options.onok || Modal.hide),
				}
			];
		} else if (!options.buttons || !options.buttons.length) {
			options.buttons = [
				{
					id: "cancel",
					defaultCancel: true,
					icon: "icon-clear",
					text: Strings.Close,
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

	public static defaultCancelAction(): void {
		if (Modal.modal)
			Modal.modal.defaultCancelActionInternal();
	}

	private readonly options: ModalOptions;
	private readonly containerElement: HTMLDivElement;
	private readonly modalElement: HTMLFormElement;
	private readonly modalHeaderElement: HTMLDivElement;
	private readonly modalBodyElement: HTMLDivElement;
	private readonly modalFooterElement: HTMLDivElement;
	private readonly defaultCancelButton: HTMLButtonElement | null;
	private readonly defaultSubmitButton: HTMLButtonElement | null;
	private readonly oldBodyOverflow: string;
	private readonly changedElements: { element: HTMLElement, tabindex: string | null }[];

	private readonly boundDocumentKeyDown: any;

	private fading: boolean;

	private constructor(options: ModalOptions) {
		this.options = options;

		const elementsToDisable = document.querySelectorAll("button,input,select,textarea,.slider-control"),
			changedElements: { element: HTMLElement, tabindex: string | null }[] = new Array(elementsToDisable.length);
		for (let i = elementsToDisable.length - 1; i >= 0; i--) {
			const element = elementsToDisable[i] as HTMLElement,
				tabindex = element.getAttribute("tabindex");
			element.setAttribute("tabindex", "-1");
			changedElements[i] = { element, tabindex };
		}
		this.changedElements = changedElements;
		this.oldBodyOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		// I decided to stop using the actual dialog element + showModal() method,
		// along with the ::backdrop pseudo-element, because of lack of support in
		// Firefox and Safari (as of march 2021)
		// https://developer.mozilla.org/en-US/docs/Web/CSS/::backdrop
		// https://caniuse.com/mdn-api_htmldialogelement_showmodal
		this.containerElement = document.createElement("div");
		this.containerElement.className = (!options.transparentBackground ? "modal-container background" : "modal-container");

		this.modalElement = document.createElement("form");
		this.modalElement.className = "modal slide";
		this.modalElement.onsubmit = this.submit.bind(this);

		this.modalHeaderElement = document.createElement("div");
		this.modalHeaderElement.className = "modal-header";
		this.modalHeaderElement.innerHTML = options.title || (options.titleStringKey ? Strings.translate(options.titleStringKey) : Strings.Oops);

		this.modalBodyElement = document.createElement("div");
		this.modalBodyElement.className = "modal-body";
		if ((typeof options.html) === "string")
			this.modalBodyElement.innerHTML = options.html as string;
		else
			this.modalBodyElement.appendChild(options.html as HTMLElement);

		const buttons = this.modalBodyElement.getElementsByTagName("button");
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

		this.modalFooterElement = document.createElement("div");
		this.modalFooterElement.className = ((options.buttons && options.buttons.length === 1) ? "modal-footer right" : "modal-footer");

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
				if (i)
					button.style.float = "right";
				button.onclick = () => {
					if (this.fading)
						return;

					if (currentButton.onclick)
						currentButton.onclick(currentButton.id, button);

					if (this.options.onbuttonclick)
						this.options.onbuttonclick(currentButton.id, button);
				};

				this.modalFooterElement.appendChild(button);
			}
		}

		this.modalElement.appendChild(this.modalHeaderElement);
		this.modalElement.appendChild(this.modalBodyElement);
		this.modalElement.appendChild(this.modalFooterElement);
		this.containerElement.appendChild(this.modalElement);
		document.body.appendChild(this.containerElement);

		this.boundDocumentKeyDown = this.documentKeyDown.bind(this);
		document.addEventListener("keydown", this.boundDocumentKeyDown, true);

		this.fading = true;

		setTimeout(() => {
			if (options.onshowing)
				options.onshowing();

			this.containerElement.classList.add("in");
			this.modalElement.classList.add("in");

			setTimeout(() => {
				this.fading = false;

				if (this.options.onshown)
					this.options.onshown();
			}, 320);
		}, 20);
	}

	private hideInternal(): void {
		if (Modal.modal !== this || this.fading)
			return;

		if (this.options.onhiding && this.options.onhiding() === false)
			return;

		document.removeEventListener("keydown", this.boundDocumentKeyDown, true);

		const changedElements = this.changedElements;
		for (let i = changedElements.length - 1; i >= 0; i--) {
			const element = changedElements[i].element,
				tabindex = changedElements[i].tabindex;
			if (tabindex)
				element.setAttribute("tabindex", tabindex);
			else
				element.removeAttribute("tabindex");
		}
		document.body.style.overflow = this.oldBodyOverflow;

		this.fading = true;
		this.containerElement.classList.remove("in");
		this.modalElement.classList.remove("in");

		setTimeout(() => {
			Modal.modal = null;

			if (this.options.onhidden)
				this.options.onhidden();

			document.body.removeChild(this.containerElement);

			if (this.options.buttons) {
				for (let i = this.options.buttons.length - 1; i >= 0; i--)
					zeroObject(this.options.buttons[i]);
			}
			zeroObject(this.options);
			zeroObject(this);
		}, 320);
	}

	private documentKeyDown(e: KeyboardEvent): void {
		if (e.key === "Escape")
			this.defaultCancelActionInternal();
	}

	private defaultCancelActionInternal(): void {
		if (this.defaultCancelButton)
			this.defaultCancelButton.click();
	}

	private submit(e: Event): boolean {
		cancelEvent(e);

		if (this.defaultSubmitButton)
			this.defaultSubmitButton.click();

		return false;
	}
}
