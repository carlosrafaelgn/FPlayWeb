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

class StereoPannerControl extends ConnectableNode {
	public static readonly maxAbsoluteValue = 20;

	private readonly _channelSplitter: ChannelSplitterNode | null;
	private readonly _gain: GainNode | null;
	private readonly _channelMerger: ChannelMergerNode | null;
	private readonly _slider: SliderControl;

	private _pan: number;
	private _appliedGain: number;
	private _leftGain: boolean;
	private _rightGain: boolean;

	public onappliedgainchange: ((appliedGain: number) => void) | null;

	public constructor(slider: SliderControl, audioContext: AudioContext) {
		super();

		this._pan = InternalStorage.loadStereoPannerSettings();
		this._appliedGain = 1;

		this._channelSplitter = audioContext.createChannelSplitter(2);
		this._gain = audioContext.createGain();
		this._channelMerger = audioContext.createChannelMerger(2);
		this._leftGain = false;
		this._rightGain = false;

		this.onappliedgainchange = null;

		const boundCommitChanges = this.commitChanges.bind(this);

		const label = document.createElement("span");
		label.className = "db-label large small-left-margin";

		// I decided to use the word "fade" instead of "panning" because it's more accurate,
		// since there is no merging of channels, only a change in the volume of each channel.
		slider.ariaLabel = Strings.Fade;
		slider.min = -StereoPannerControl.maxAbsoluteValue;
		slider.max = StereoPannerControl.maxAbsoluteValue;
		slider.value = this._pan;
		slider.mapper = function (value) {
			return (!value ? "-0" : ((value < 0 ? Strings.RightAbbrev : Strings.LeftAbbrev) + " " + ((value = Math.abs(value)) >= StereoPannerControl.maxAbsoluteValue ? GraphicalFilterEditorStrings.MinusInfinity : ("-" + value)))) + " dB";
		};
		slider.valueChild = SliderControlValueChild.RightChild;
		slider.rightChild = label;
		slider.ondragchangecommit = boundCommitChanges;
		slider.onkeyboardchange = boundCommitChanges;
		this._slider = slider;

		this.commitChanges(this._pan);
	}

	protected get input(): AudioNode | null {
		return this._channelSplitter;
	}

	protected get output(): AudioNode | null {
		return this._channelMerger;
	}

	private commitChanges(pan: number): void {
		const channelSplitter = this._channelSplitter,
			gain = this._gain,
			channelMerger = this._channelMerger;

		if (!channelSplitter || !gain || !channelMerger)
			return;

		const absPan = Math.abs(pan),
			absPanChanged = (Math.abs(this._pan) !== absPan);

		this._pan = pan;

		if (!absPan) {
			this._appliedGain = 1;
			this._leftGain = false;
			this._rightGain = false;
			gain.disconnect();
			channelSplitter.disconnect();
			channelSplitter.connect(channelMerger, 0, 0);
			channelSplitter.connect(channelMerger, 1, 1);
		} else {
			const leftGain = (pan > 0),
				rightGain = !leftGain;

			this._appliedGain = (absPan >= StereoPannerControl.maxAbsoluteValue ? 0 : Math.pow(10, -absPan / 20));
			gain.gain.value = this._appliedGain;

			if (leftGain !== this._leftGain || rightGain !== this._rightGain) {
				channelSplitter.disconnect();
				gain.disconnect();

				this._leftGain = leftGain;
				this._rightGain = rightGain;

				if (leftGain) {
					channelSplitter.connect(gain, 0, 0);
					gain.connect(channelMerger, 0, 0);
					channelSplitter.connect(channelMerger, 1, 1);
				} else {
					channelSplitter.connect(gain, 1, 0);
					gain.connect(channelMerger, 0, 1);
					channelSplitter.connect(channelMerger, 0, 0);
				}
			}
		}

		if (absPanChanged && this.enabled && this.onappliedgainchange)
			this.onappliedgainchange(this._appliedGain);
	}

	public get enabled(): boolean {
		// Overriding only the getter, or only the setter, does not work in all browsers
		return super.enabled;
	}

	public set enabled(enabled: boolean) {
		if (enabled === this.enabled)
			return;

		super.enabled = enabled;

		if (this.onappliedgainchange)
			this.onappliedgainchange(this.appliedGain);
	}

	public get appliedGain(): number {
		return (this.enabled ? this._appliedGain : 1);
	}

	public get pan(): number {
		return this._pan;
	}

	public set pan(pan: number) {
		pan = Math.max(-StereoPannerControl.maxAbsoluteValue, Math.min(StereoPannerControl.maxAbsoluteValue, pan | 0));

		if (this._pan === pan)
			return;

		this._slider.value = pan;

		this.commitChanges(pan);
	}

	public saveSettings(): void {
		InternalStorage.saveStereoPannerSettings(this._pan);
	}
}
