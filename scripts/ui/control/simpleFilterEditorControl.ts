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

class SimpleFilterEditorControl {
	public readonly element: HTMLDivElement;
	public readonly editor: GraphicalFilterEditorControl;

	private readonly sliders: SliderControl[];

	private static sliderToDB(sliderValue: number): string {
		return Formatter.formatDB(sliderValue * 0.5);
	}

	private static sliderToY(sliderValue: number): number {
		return GraphicalFilterEditor.zeroChannelValueY - (sliderValue << 1);
	}

	private static yToSlider(y: number): number {
		return Math.max(-30, Math.min(30, -(y - GraphicalFilterEditor.zeroChannelValueY) >> 1));
	}

	public constructor(element: HTMLDivElement, editor: GraphicalFilterEditorControl) {
		this.element = element;
		this.editor = editor;

		element.classList.add("simple-filter");

		const sliders = new Array(GraphicalFilterEditor.shelfEquivalentZoneCount);
		this.sliders = sliders;
		for (let i = 0; i < sliders.length; i++) {
			const span = document.createElement("span"),
				freq = document.createElement("span"),
				gain = document.createElement("span"),
				sliderValue = this.filterToSlider(i);

			freq.className = "simple-filter-freq small-bottom-margin";
			switch (i) {
				case 0:
					freq.innerHTML = '31<br/>62';
					break;
				case 1:
					freq.innerHTML = '<br/>125';
					break;
				case 2:
					freq.innerHTML = '<br/>250';
					break;
				case 3:
					freq.innerHTML = '500<br/>1k';
					break;
				case 4:
					freq.innerHTML = '2k<br/>4k';
					break;
				case 5:
					freq.innerHTML = '<br/>8k';
					break;
				case 6:
					freq.innerHTML = '<br/>16k';
					break;
			}

			Strings.changeText(gain, SimpleFilterEditorControl.sliderToDB(sliderValue));
			gain.className = "small-top-margin";

			span.className = "simple-filter-slider";
			element.appendChild(span);
			sliders[i] = new SliderControl(span, true, true, -30, 30, sliderValue, gain, freq);
			this.createHandler(sliders[i], i);
		}
	}

	private filterToSlider(sliderIndex: number): number {
		return SimpleFilterEditorControl.yToSlider(this.editor.getShelfZoneY(sliderIndex));
	}

	private createHandler(slider: SliderControl, sliderIndex: number): void {
		const editor = this.editor;

		slider.onvaluechanged = function (value) {
			Strings.changeText(slider.leftChild as HTMLElement, SimpleFilterEditorControl.sliderToDB(value));
		};

		const commitChanges = function (value: number): void {
			editor.changeShelfZoneY(sliderIndex, SimpleFilterEditorControl.sliderToY(value));
			editor.commitChanges();
		};

		slider.ondragended = commitChanges;
		slider.onkeyboardchanged = commitChanges;
	}

	public updateSliders(): void {
		const sliders = this.sliders;
		for (let i = 0; i < sliders.length; i++)
			sliders[i].value = this.filterToSlider(i);
	}
}
