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
package br.com.carlosrafaelgn.fplayweb;

import android.app.Activity;
import android.content.SharedPreferences;

public class SharedSettings {
	private static final String PREF_NAME = "fplay_web_prefs";
	private static final String PREF_KEY_FLOAT_VIEW_Y = "float_view_y";

	private static boolean loaded;

	private static int initialFloatViewY;
	public static int floatViewY;

	public static void load(Activity activity) {
		if (loaded)
			return;

		try {
			final SharedPreferences preferences = activity.getSharedPreferences(PREF_NAME, Activity.MODE_PRIVATE);
			floatViewY = preferences.getInt(PREF_KEY_FLOAT_VIEW_Y, -1);
		} catch (Throwable th) {
			// Just ignore...
		}

		initialFloatViewY = floatViewY;

		loaded = true;
	}

	public static void save(Activity activity) {
		if (floatViewY == initialFloatViewY)
			return;

		try {
			final SharedPreferences preferences = activity.getSharedPreferences(PREF_NAME, Activity.MODE_PRIVATE);
			final SharedPreferences.Editor editor = preferences.edit();

			if (floatViewY != initialFloatViewY) {
				editor.putInt(PREF_KEY_FLOAT_VIEW_Y, floatViewY);
				initialFloatViewY = floatViewY;
			}

			editor.apply();
		} catch (Throwable th) {
			// Just ignore...
		}
	}
}
