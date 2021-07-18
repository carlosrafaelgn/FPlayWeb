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

class SliderControl {
	private readonly _element: HTMLElement;

	private _leftChild: Node | null;
	private _rightChild: Node | null;

	private focusContainer: HTMLSpanElement;
	private container: HTMLSpanElement;
	private innerContainer: HTMLSpanElement;
	private ruler: HTMLSpanElement;
	private filledRuler: HTMLSpanElement;
	private thumb: HTMLSpanElement;

	private pointerHandler: PointerHandler;

	private _disabled: boolean;
	private _min: number;
	private _max: number;
	private _value: number;
	private delta: number;
	private percent: number;

	public readonly keyboardFocusable: boolean;

	public onvaluechanged: ((value: number) => void) | null;
	public ondragended: ((value: number) => void) | null;

	constructor(element: string | HTMLElement, keyboardFocusable: boolean, min: number, max: number, value?: number, leftChild?: HTMLElement | null, rightChild?: HTMLElement | null) {
		this._element = (((typeof element) === "string") ? document.getElementById(element as string) : element) as HTMLElement;
		this._element.classList.add("slider-control");
		this._element.setAttribute("role", "slider");
		if (keyboardFocusable)
			this._element.setAttribute("tabindex", "0");
		else
			this._element.setAttribute("aria-hidden", "true");

		this.keyboardFocusable = keyboardFocusable;

		const focusContainer = document.createElement("span");
		focusContainer.className = "slider-control-focus-container";
		focusContainer.setAttribute("tabindex", "-1");
		this.focusContainer = focusContainer;

		this.onvaluechanged = null;
		this.ondragended = null;

		const container = document.createElement("span");
		container.className = "slider-control-container";
		focusContainer.appendChild(container);
		this.container = container;

		const innerContainer = document.createElement("span");
		innerContainer.className = "slider-control-inner-container";
		container.appendChild(innerContainer);
		this.innerContainer = innerContainer;

		const ruler = document.createElement("span");
		ruler.className = "slider-control-ruler";
		innerContainer.appendChild(ruler);
		this.ruler = ruler;

		const filledRuler = document.createElement("span");
		filledRuler.className = "slider-control-color slider-control-filled-ruler";
		innerContainer.appendChild(filledRuler);
		this.filledRuler = filledRuler;

		const thumb = document.createElement("span");
		thumb.className = "slider-control-color slider-control-thumb";
		innerContainer.appendChild(thumb);
		this.thumb = thumb;

		this._element.appendChild(focusContainer);

		if (min > max) {
			this._min = max | 0;
			this._max = min | 0;
		} else {
			this._min = min | 0;
			this._max = max | 0;
		}

		this.delta = this._max - this._min;
		if (!this.delta)
			this.delta = 1;

		this._disabled = false;
		this._value = min - 1;
		this.percent = 0;
		this.value = (value === undefined ? min : value);

		this.pointerHandler = new PointerHandler(container, this.mouseDown.bind(this), this.mouseMove.bind(this), this.mouseUp.bind(this));

		if (keyboardFocusable) {
			this._element.setAttribute("aria-valuemin", min.toString());
			this._element.setAttribute("aria-valuemax", max.toString());
			this._element.addEventListener("keydown", this.keyDown.bind(this));
			this._element.addEventListener("focus", this.focus.bind(this));
			this._element.addEventListener("blur", this.blur.bind(this));
		}

		this._leftChild = null;
		this._rightChild = null;
		if (leftChild)
			this.leftChild = leftChild;
		if (rightChild)
			this.rightChild = rightChild;
	}

	public get element(): HTMLElement {
		return this._element;
	}

	public get leftChild(): Node | null {
		return this._leftChild;
	}

	public set leftChild(leftChild: Node | null) {
		if (!this.focusContainer)
			return;

		if (leftChild) {
			if (this._leftChild)
				this.focusContainer.replaceChild(leftChild, this._leftChild);
			else
				this.focusContainer.insertBefore(leftChild, this.focusContainer.firstChild);
		} else if (this._leftChild) {
			this.focusContainer.removeChild(this._leftChild);
		}

		this._leftChild = leftChild;
	}

	public get rightChild(): Node | null {
		return this._rightChild;
	}

	public set rightChild(rightChild: Node | null) {
		if (!this.focusContainer)
			return;

		if (rightChild) {
			if (this._rightChild)
				this.focusContainer.replaceChild(rightChild, this._rightChild);
			else
				this.focusContainer.appendChild(rightChild);
		} else if (this._rightChild) {
			this.focusContainer.removeChild(this._rightChild);
		}

		this._rightChild = rightChild;
	}

	public get dragging(): boolean {
		return (this.pointerHandler ? this.pointerHandler.captured : false);
	}

	public get disabled(): boolean {
		return this._disabled;
	}

	public set disabled(disabled: boolean) {
		if (this._disabled !== disabled) {
			this._disabled = disabled;

			if (this._element) {
				if (this.keyboardFocusable)
					this._element.setAttribute("tabindex", disabled ? "-1" : "0");

				this._element.style.pointerEvents = (disabled ? "none" : "");
			}
		}
	}

	public get min(): number {
		return this._min;
	}

	public set min(min: number) {
		min |= 0;

		this._min = min;

		if (min > this._max) {
			this._max = min;

			if (this.keyboardFocusable)
				this._element.setAttribute("aria-valuemax", min.toString());
		}

		this.delta = this._max - min;
		if (!this.delta)
			this.delta = 1;

		if (this.keyboardFocusable)
			this._element.setAttribute("aria-valuemin", min.toString());

		this.value = this._value;
	}

	public get max(): number {
		return this._max;
	}

	public set max(max: number) {
		max |= 0;

		this._max = max;

		if (max < this._min) {
			this._min = max;

			if (this.keyboardFocusable)
				this._element.setAttribute("aria-valuemin", max.toString());
		}

		this.delta = max - this._min;
		if (!this.delta)
			this.delta = 1;

		if (this.keyboardFocusable)
			this._element.setAttribute("aria-valuemax", max.toString());

		this.value = this._value;
	}

	public get value(): number {
		return this._value;
	}

	public set value(value: number) {
		value |= 0;

		if (value < this._min)
			value = this._min;
		else if (value > this._max)
			value = this._max;

		const oldValue = this._value;

		this._value = value;

		this.percent = 100 * (value - this._min) / this.delta;

		const p = this.percent + "%";

		if (this.filledRuler)
			this.filledRuler.style.right = (100 - this.percent) + "%";

		if (this.ruler)
			this.ruler.style.left = p;

		if (this.thumb)
			this.thumb.style.left = p;

		if (value !== oldValue) {
			if (this.keyboardFocusable)
				this._element.setAttribute("aria-valuenow", value.toString());

			if (this.onvaluechanged)
				this.onvaluechanged(value);
		}
	}

	private mouseDown(e: MouseEvent): boolean {
		if (e.button || this._disabled || !this._element)
			return false;

		this.focusContainer.focus();

		// Firefox ignores :active pseudo-class when event.preventDefault() is called
		this.container.classList.add("active");

		this.mouseMove(e);

		return true;
	}

	private mouseMove(e: MouseEvent): void {
		const rect = this.innerContainer.getBoundingClientRect(),
			dx = rect.right - rect.left,
			x = e.clientX - (rect.left + 4);

		this.value = ((dx <= 0) ? this._min : (this._min + (this.delta * x / dx)));
	}

	private mouseUp(e: MouseEvent): void {
		this.mouseMove(e);

		// Firefox ignores :active pseudo-class when event.preventDefault() is called
		this.container.classList.remove("active");

		if (this.ondragended)
			this.ondragended(this._value);
	}

	private keyDown(e: KeyboardEvent): any {
		switch (e.key) {
			case "ArrowDown":
			case "ArrowLeft":
				this.value = this._value - 1;
				break;
			case "ArrowUp":
			case "ArrowRight":
				this.value = this._value + 1;
				break;
			case "PageDown":
				this.value = this._value - (this.delta * 0.1);
				break;
			case "PageUp":
				this.value = this._value + (this.delta * 0.1);
				break;
		}
	}

	private focus(): void {
		this.container.classList.add("active");
	}

	private blur(): void {
		this.container.classList.remove("active");
	}
}
