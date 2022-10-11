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
import android.content.Intent;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;

public class MainActivity extends Activity {
	private WebViewHost webViewHost;

	private void showOverlayPermissionRequest() {
		final Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName()));
		intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
		getApplication().startActivity(intent);
	}

	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);

		SharedSettings.load(this);

		setVolumeControlStream(AudioManager.STREAM_MUSIC);

		final MainApplication application = (MainApplication)getApplication();

		webViewHost = application.webViewHost;
		if (webViewHost == null) {
			webViewHost = new WebViewHost(application);
			application.webViewHost = webViewHost;
		}

		webViewHost.setActivity(this);
	}

	@Override
	public void onBackPressed() {
		if (webViewHost != null) {
			switch (webViewHost.onBackPressed()) {
			case WebViewHost.BACK_KEY_MOVE_TO_BACK:
				// Show the overlay permission request and let the activity finish instead of
				// keeping it running in the background.
				showOverlayPermissionRequest();

				break;

			case WebViewHost.BACK_KEY_PREVENT:
				return;
			}
		}

		super.onBackPressed();
	}

	@Override
	protected void onPause() {
		if (webViewHost != null)
			webViewHost.onPause();

		super.onPause();
	}

	@Override
	protected void onResume() {
		if (webViewHost != null) {
			webViewHost.setActivity(this);
			webViewHost.onResume();
		}

		super.onResume();
	}

	@Override
	protected void onStop() {
		// Try to differentiate a home button press from the screen being turned off
		final PowerManager powerManager = (PowerManager)getSystemService(POWER_SERVICE);
		if (powerManager != null && powerManager.isInteractive()) {
			if (webViewHost != null && !webViewHost.isPaused()) {
				// It is not possible to start a new activity in response to the home button,
				// because Android will show the home screen instead of the newly started activity!
				// So, if we were playing when the home button was pressed, just force the activity
				// to finish whether we managed to enter float mode or not.
				webViewHost.enterFloatModeIfPossible();
				finish();
			} else if (Build.VERSION.SDK_INT > Build.VERSION_CODES.R) {
				// https://developer.android.com/about/versions/12/behavior-changes-all#activity-lifecycle
				// https://stackoverflow.com/q/71365906/3569421
				finish();
			}
		}

		super.onStop();
	}

	@Override
	protected void onDestroy() {
		if (webViewHost != null) {
			SharedSettings.save(this);

			if (webViewHost.isFloating()) {
				webViewHost.setActivity(null);
			} else {
				webViewHost.onDestroy();
				((MainApplication)getApplication()).webViewHost = null;
			}

			webViewHost = null;
		}

		super.onDestroy();
	}

	@Override
	public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
		if (webViewHost != null)
			webViewHost.onRequestPermissionsResult(grantResults);
	}
}
