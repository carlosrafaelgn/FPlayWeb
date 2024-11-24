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
// A lot of this code came from my other project: https://github.com/carlosrafaelgn/FPlayAndroid

package br.com.carlosrafaelgn.fplayweb;

import android.app.Notification;
import android.app.Service;
import android.content.Intent;
import android.os.IBinder;

import br.com.carlosrafaelgn.fplayweb.callback.HostMediaSession;

public final class MainService extends Service {
	@Override
	public void onCreate() {
		final MainApplication application = (MainApplication)getApplication();
		if (application.webViewHost != null) {
			final HostMediaSession hostMediaSession = application.webViewHost.getHostMediaSession();
			if (hostMediaSession != null) {
				final Notification notification = hostMediaSession.getNotification();
				if (notification != null)
					startForeground(1, notification);
			}
		}
		super.onCreate();
	}

	@Override
	public int onStartCommand(Intent intent, int flags, int startId) {
		return START_STICKY;
	}

	@Override
	public IBinder onBind(Intent intent) {
		return null;
	}

	@Override
	public void onDestroy() {
		stopForeground(true);
		super.onDestroy();
	}
}
