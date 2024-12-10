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

interface SliderControlValueMapper {
	(value: number): string
}

enum SliderControlValueChild {
	None = 0,
	LeftChild = 1,
	RightChild = 2
}

class SliderControl extends HTMLElement {
	public static readonly disabledFeatures = ["shadow"];
	public static readonly observedAttributes = ["disabled", "unfocusable", "value-child", "vertical", "manual-aria", "min", "max", "value"];

	public static create(label: string, mapper: SliderControlValueMapper | null, valueChild: SliderControlValueChild, unfocusable: boolean, vertical: boolean, min: number, max: number, value?: number, className?: string, leftChild?: HTMLElement | null, rightChild?: HTMLElement | null, manualAria?: boolean): SliderControl {
		const sliderControl = document.createElement("f-slider") as SliderControl;

		if (label)
			sliderControl.ariaLabel = label;

		if (className)
			sliderControl.className = className;

		sliderControl.leftChild = leftChild || null;
		sliderControl.rightChild = rightChild || null;
		sliderControl.mapper = mapper;
		sliderControl.valueChild = valueChild;
		sliderControl.unfocusable = unfocusable;
		sliderControl.vertical = vertical;
		sliderControl.manualAria = !!manualAria;
		min |= 0;
		max |= 0;
		if (max < min)
			max = min;
		sliderControl.min = min;
		sliderControl.max = max;
		sliderControl.value = Math.max(min, Math.min(max, (value === undefined) ? min : (value | 0)));

		return sliderControl;
	}

	private _leftChild: HTMLElement | null;
	private _rightChild: HTMLElement | null;

	private _innerElements: {
		focusContainer: HTMLSpanElement;
		container: HTMLSpanElement;
		innerContainer: HTMLSpanElement;
		ruler: HTMLSpanElement;
		filledRuler: HTMLSpanElement;
		thumb: HTMLSpanElement;
	} | null;

	private _pointerHandler: PointerHandler | null;

	private _onvaluechangeEnabled: boolean;
	private _mapper: SliderControlValueMapper | null;
	private _disabled: boolean;
	private _unfocusable: boolean;
	private _valueChild: SliderControlValueChild;
	private _vertical: boolean;
	private _manualAria: boolean;
	private _min: number;
	private _max: number;
	private _value: number;
	private _delta: number;
	private _percent: number;
	private _forcedDragging: boolean;
	private _valueChangedDragging: boolean;

	private readonly _boundKeyDown: any;
	private readonly _boundFocus: any;
	private readonly _boundBlur: any;

	public onvaluechange: ((value: number) => void) | null;
	public ondragchangecommit: ((value: number) => void) | null;
	public onkeyboardchange: ((value: number) => void) | null;

	public constructor() {
		super();

		this._leftChild = null;
		this._rightChild = null;

		this._innerElements = null;

		this._pointerHandler = null;

		this._onvaluechangeEnabled = true;
		this._mapper = null;
		this._disabled = false;
		this._unfocusable = false;
		this._valueChild = SliderControlValueChild.None;
		this._vertical = false;
		this._manualAria = false;
		this._min = 0;
		this._max = 1;
		this._value = 0;
		this._delta = 1;
		this._percent = 0;
		this._forcedDragging = false;
		this._valueChangedDragging = false;

		this._boundKeyDown = this.elementKeyDown.bind(this);
		this._boundFocus = this.elementFocus.bind(this);
		this._boundBlur = this.elementBlur.bind(this);

		this.onvaluechange = null;
		this.ondragchangecommit = null;
		this.onkeyboardchange = null;
	}

	public get leftChild(): HTMLElement | null {
		return this._leftChild;
	}

	public set leftChild(leftChild: HTMLElement | null) {
		if (!this._innerElements) {
			this._leftChild = leftChild;
			return;
		}

		if (this._leftChild === leftChild)
			return;

		const focusContainer = this._innerElements.focusContainer;

		if (leftChild) {
			if (this._leftChild)
				focusContainer.replaceChild(leftChild, this._leftChild);
			else
				focusContainer.insertBefore(leftChild, focusContainer.firstChild);
		} else if (this._leftChild) {
			focusContainer.removeChild(this._leftChild);
		}

		this._leftChild = leftChild;

		if (leftChild && this._valueChild === SliderControlValueChild.LeftChild && !this._manualAria)
			Strings.changeText(leftChild, this.ariaValueText || this.ariaValueNow);
	}

	public get rightChild(): HTMLElement | null {
		return this._rightChild;
	}

	public set rightChild(rightChild: HTMLElement | null) {
		if (!this._innerElements) {
			this._rightChild = rightChild;
			return;
		}

		if (this._rightChild === rightChild)
			return;

		const focusContainer = this._innerElements.focusContainer;

		if (rightChild) {
			if (this._rightChild)
				focusContainer.replaceChild(rightChild, this._rightChild);
			else
				focusContainer.appendChild(rightChild);
		} else if (this._rightChild) {
			focusContainer.removeChild(this._rightChild);
		}

		this._rightChild = rightChild;

		if (rightChild && this._valueChild === SliderControlValueChild.RightChild && !this._manualAria)
			Strings.changeText(rightChild, this.ariaValueText || this.ariaValueNow);
	}

	public get dragging(): boolean {
		return (this._forcedDragging || (this._pointerHandler ? this._pointerHandler.captured : false));
	}

	public get mapper(): SliderControlValueMapper | null {
		return this._mapper;
	}

	public set mapper(mapper: SliderControlValueMapper | null) {
		if (!this._innerElements) {
			this._mapper = mapper;
			return;
		}

		if (this._mapper === mapper)
			return;

		this._mapper = mapper;

		this._onvaluechangeEnabled = false;
		const value = this._value;
		this._value = this._min - 1;
		this.value = value;
		this._onvaluechangeEnabled = true;
	}

	public get disabled(): boolean {
		return this._disabled;
	}

	public set disabled(disabled: boolean) {
		if (disabled)
			this.setAttribute("disabled", "");
		else
			this.removeAttribute("disabled");
	}

	public get unfocusable(): boolean {
		return this._unfocusable;
	}

	public set unfocusable(unfocusable: boolean) {
		if (unfocusable)
			this.setAttribute("unfocusable", "");
		else
			this.removeAttribute("unfocusable");
	}

	public get valueChild(): SliderControlValueChild {
		return this._valueChild;
	}

	public set valueChild(valueChild: SliderControlValueChild) {
		this.setAttribute("value-child", valueChild.toString());
	}

	public get vertical(): boolean {
		return this._vertical;
	}

	public set vertical(vertical: boolean) {
		if (vertical)
			this.setAttribute("vertical", "");
		else
			this.removeAttribute("vertical");
	}

	public get manualAria(): boolean {
		return this._manualAria;
	}

	public set manualAria(manualAria: boolean) {
		if (manualAria)
			this.setAttribute("manual-aria", "");
		else
			this.removeAttribute("manual-aria");
	}

	public get min(): number {
		return this._min;
	}

	public set min(min: number) {
		this.setAttribute("min", min.toString());
	}

	public get max(): number {
		return this._max;
	}

	public set max(max: number) {
		this.setAttribute("max", max.toString());
	}

	public get value(): number {
		return this._value;
	}

	public set value(value: number) {
		// Just like input's value, this IDL attribute is not synchronized with the content attribute
		// https://developer.mozilla.org/en-US/docs/Glossary/IDL

		value |= 0;

		if (!this._innerElements) {
			this._value = value;
			return;
		}

		if (value < this._min)
			value = this._min;
		else if (value > this._max)
			value = this._max;

		const oldValue = this._value;

		this._value = value;

		this._percent = 100 * (value - this._min) / this._delta;

		const p = this._percent + "%";

		const innerElements = this._innerElements;

		if (innerElements) {
			if (this.vertical)
				innerElements.filledRuler.style.top = (100 - this._percent) + "%";
			else
				innerElements.filledRuler.style.right = (100 - this._percent) + "%";

			if (this.vertical)
				innerElements.ruler.style.bottom = p;
			else
				innerElements.ruler.style.left = p;

			if (this.vertical)
				innerElements.thumb.style.bottom = p;
			else
				innerElements.thumb.style.left = p;
		}

		if (value === oldValue)
			return;

		if (!this._manualAria) {
			let valueText: string;

			if (this._mapper) {
				valueText = this._mapper(value);
				this.ariaValueText = valueText;
				this.ariaValueNow = value.toString();
			} else {
				valueText = value.toString();
				this.ariaValueNow = valueText;
			}

			switch (this._valueChild) {
				case SliderControlValueChild.LeftChild:
					if (this._leftChild)
						Strings.changeText(this._leftChild, valueText);
					break;
				case SliderControlValueChild.RightChild:
					if (this._rightChild)
						Strings.changeText(this._rightChild, valueText);
					break;
			}
		}

		if (this.dragging)
			this._valueChangedDragging = true;

		if (this.onvaluechange && this._onvaluechangeEnabled)
			this.onvaluechange(value);
	}

	private elementMouseDown(e: MouseEvent): boolean {
		if (e.button || this._disabled || !this._innerElements)
			return false;

		this._innerElements.focusContainer.focus();

		// Firefox ignores :active pseudo-class when event.preventDefault() is called
		this._innerElements.container.classList.add("active");

		this._forcedDragging = true;
		this._valueChangedDragging = false;

		this.elementMouseMove(e);

		this._forcedDragging = false;

		return true;
	}

	private elementMouseMove(e: MouseEvent): void {
		if (!this._innerElements)
			return;

		const rect = this._innerElements.innerContainer.getBoundingClientRect();

		let dx: number, x: number;
		if (this.vertical) {
			dx = rect.bottom - rect.top,
			x = dx - (e.clientY - (rect.top - 3));
		} else {
			dx = rect.right - rect.left,
			x = e.clientX - (rect.left + 4);
		}

		this.value = ((dx <= 0) ? this._min : (this._min + (this._delta * x / dx)));
	}

	private elementMouseUp(e: MouseEvent): void {
		if (!this._innerElements)
			return;

		// Firefox ignores :active pseudo-class when event.preventDefault() is called
		this._innerElements.container.classList.remove("active");

		if (this.ondragchangecommit && this._valueChangedDragging)
			this.ondragchangecommit(this._value);

		this._valueChangedDragging = false;
	}

	private elementKeyDown(e: KeyboardEvent): any {
		if ((this._pointerHandler && this._pointerHandler.captured) || this._disabled || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)
			return;

		const oldValue = this._value;

		switch (e.key) {
			case "ArrowDown":
			case "ArrowLeft":
				this.value = oldValue - 1;
				if (this.onkeyboardchange && this._value !== oldValue)
					this.onkeyboardchange(this._value);
				break;
			case "ArrowUp":
			case "ArrowRight":
				this.value = oldValue + 1;
				if (this.onkeyboardchange && this._value !== oldValue)
					this.onkeyboardchange(this._value);
				break;
			case "PageDown":
				this.value = oldValue - (this._delta * 0.1);
				if (this.onkeyboardchange && this._value !== oldValue)
					this.onkeyboardchange(this._value);
				break;
			case "PageUp":
				this.value = oldValue + (this._delta * 0.1);
				if (this.onkeyboardchange && this._value !== oldValue)
					this.onkeyboardchange(this._value);
				break;
			default:
				return;
		}

		return cancelEvent(e);
	}

	private elementFocus(): void {
		this._innerElements?.container.classList.add("active");
	}

	private elementBlur(): void {
		this._innerElements?.container.classList.remove("active");
	}

	public manuallyChangeAll(value: number, valueText: string, valueChild: SliderControlValueChild): void {
		this.value = value;
		this.manuallyChangeAria(valueText, valueChild);
	}

	public manuallyChangeAria(valueText: string, valueChild: SliderControlValueChild): void {
		this.ariaValueText = valueText;
		this.ariaValueNow = this._value.toString();

		switch (valueChild) {
			case SliderControlValueChild.LeftChild:
				if (this._leftChild)
					Strings.changeText(this._leftChild, valueText);
				break;
			case SliderControlValueChild.RightChild:
				if (this._rightChild)
					Strings.changeText(this._rightChild, valueText);
				break;
		}
	}

	public connectedCallback(): void {
		if (this._innerElements)
			return;

		this.role = "slider";

		const classSuffix = (this._vertical ? " vertical" : "");

		const focusContainer = document.createElement("span");
		focusContainer.className = "f-slider-focus-container" + classSuffix;
		focusContainer.tabIndex = -1;
		//focusContainer.ariaHidden = "true";

		const container = document.createElement("span");
		container.className = "f-slider-container" + classSuffix;
		focusContainer.appendChild(container);

		const innerContainer = document.createElement("span");
		innerContainer.className = "f-slider-inner-container" + classSuffix;
		container.appendChild(innerContainer);

		const ruler = document.createElement("span");
		ruler.className = "f-slider-ruler" + classSuffix;
		innerContainer.appendChild(ruler);

		const filledRuler = document.createElement("span");
		filledRuler.className = "f-slider-color f-slider-filled-ruler" + classSuffix;
		innerContainer.appendChild(filledRuler);

		const thumb = document.createElement("span");
		thumb.className = "f-slider-color f-slider-thumb" + classSuffix;
		innerContainer.appendChild(thumb);

		this._innerElements = {
			focusContainer,
			container,
			innerContainer,
			ruler,
			filledRuler,
			thumb
		};

		this.appendChild(focusContainer);

		this._pointerHandler = new PointerHandler(container, this.elementMouseDown.bind(this), this.elementMouseMove.bind(this), this.elementMouseUp.bind(this));

		this._disabled = !this._disabled;
		this.attributeChangedCallback("disabled", null, this._disabled ? null : "");

		this._unfocusable = !this._unfocusable;
		this.attributeChangedCallback("unfocusable", null, this._unfocusable ? null : "");

		this.ariaValueMin = this._min.toString();
		this.ariaValueMax = this._max.toString();
		this._delta = this._max - this._min;
		if (!this._delta)
			this._delta = 1;

		this._vertical = !this._vertical;
		this.attributeChangedCallback("vertical", null, this._vertical ? null : "");

		const leftChild = this._leftChild;
		if (leftChild) {
			this._leftChild = null;
			this.leftChild = leftChild;
		}

		const rightChild = this._rightChild;
		if (rightChild) {
			this._rightChild = null;
			this.rightChild = rightChild;
		}
	}

	public attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
		const innerElements = this._innerElements;

		switch (name) {
			case "disabled":
				const disabled = (newValue !== null);

				if (this._disabled === disabled)
					return;

				this._disabled = disabled;

				if (!innerElements)
					return;

				if (disabled)
					this.removeAttribute("tabindex");
				else if (!this._unfocusable)
					this.tabIndex = 0;

				if (disabled)
					this.classList.add("disabled");
				else
					this.classList.remove("disabled");
				break;

			case "unfocusable":
				const unfocusable = (newValue !== null);

				if (this._unfocusable === unfocusable)
					return;

				this._unfocusable = unfocusable;

				if (!innerElements)
					return;

				if (unfocusable) {
					this.removeAttribute("tabindex");
					this.removeEventListener("keydown", this._boundKeyDown);
					this.removeEventListener("focus", this._boundFocus);
					this.removeEventListener("blur", this._boundBlur);
				} else {
					if (!this._disabled)
						this.tabIndex = 0;
					this.addEventListener("keydown", this._boundKeyDown);
					this.addEventListener("focus", this._boundFocus);
					this.addEventListener("blur", this._boundBlur);
				}
				break;

			case "value-child":
				let valueChild = parseInt(newValue as string) || 0;
				if (valueChild < 1 || valueChild > 2)
					valueChild = SliderControlValueChild.None;

				if (this._valueChild === valueChild)
					return;

				this._valueChild = valueChild;

				if (!this._manualAria) {
					if (this._leftChild && this._valueChild === SliderControlValueChild.LeftChild)
						Strings.changeText(this._leftChild, this.ariaValueText || this.ariaValueNow);
					else if (this._rightChild && this._valueChild === SliderControlValueChild.RightChild)
						Strings.changeText(this._rightChild, this.ariaValueText || this.ariaValueNow);
				}
				break;

			case "vertical":
				const vertical = (newValue !== null);

				if (this._vertical === vertical)
					return;

				this._vertical = vertical;

				if (!innerElements)
					return;

				if (vertical) {
					this.classList.add("vertical");
					innerElements.focusContainer.classList.add("vertical");
					innerElements.container.classList.add("vertical");
					innerElements.innerContainer.classList.add("vertical");
					innerElements.ruler.classList.add("vertical");
					innerElements.filledRuler.classList.add("vertical");
					innerElements.thumb.classList.add("vertical");
					innerElements.filledRuler.style.right = "";
					innerElements.ruler.style.left = "";
					innerElements.thumb.style.left = "";
				} else {
					this.classList.remove("vertical");
					innerElements.focusContainer.classList.remove("vertical");
					innerElements.container.classList.remove("vertical");
					innerElements.innerContainer.classList.remove("vertical");
					innerElements.ruler.classList.remove("vertical");
					innerElements.filledRuler.classList.remove("vertical");
					innerElements.thumb.classList.remove("vertical");
					innerElements.filledRuler.style.top = "";
					innerElements.ruler.style.bottom = "";
					innerElements.thumb.style.bottom = "";
				}

				this.ariaOrientation = (vertical ? "vertical" : "horizontal");

				this._onvaluechangeEnabled = false;
				const value = this._value;
				this._value = this._min - 1;
				this.value = value;
				this._onvaluechangeEnabled = true;
				break;

			case "manual-aria":
				this._manualAria = (newValue != null);
				break;

			case "min":
				const min = parseInt(newValue as string) || 0;

				if (this._min === min)
					return;

				this._min = min;

				if (!innerElements) {
					if (this._max < min)
						this._max = min;
					return;
				}

				if (this._max < min) {
					this._max = min;

					this.ariaValueMax = min.toString();
				}

				this._delta = this._max - min;
				if (!this._delta)
					this._delta = 1;

				this.ariaValueMin = min.toString();

				this.value = this._value;
				break;

			case "max":
				const max = parseInt(newValue as string) || 0;

				if (this._max === max)
					return;

				this._max = max;

				if (!innerElements) {
					if (this._min > max)
						this._min = max;
					return;
				}

				if (this._min > max) {
					this._min = max;

					this.ariaValueMin = max.toString();
				}

				this._delta = max - this._min;
				if (!this._delta)
					this._delta = 1;

				this.ariaValueMax = max.toString();

				this.value = this._value;
				break;

			case "value":
				this.value = parseInt(newValue as string) || 0;
				break;
		}
	}
}

customElements.define("f-slider", SliderControl);
