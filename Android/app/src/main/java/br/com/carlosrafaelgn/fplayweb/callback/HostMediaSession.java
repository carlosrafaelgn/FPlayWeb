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

package br.com.carlosrafaelgn.fplayweb.callback;

import android.app.PendingIntent;
import android.content.Intent;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.support.annotation.NonNull;
import android.view.KeyEvent;
import android.webkit.WebView;

import br.com.carlosrafaelgn.fplayweb.MainActivity;
import br.com.carlosrafaelgn.fplayweb.WebViewHost;

public final class HostMediaSession {
	// https://developer.android.com/guide/topics/media-apps/media-apps-overview
	// https://developer.android.com/guide/topics/media-apps/audio-app/building-a-mediabrowserservice
	// https://developer.android.com/guide/topics/media-apps/audio-app/building-a-mediabrowserservice#mediastyle-notifications

	private static final String NONE = "-";

	private static final int MSG_HEADSET_HOOK_TIMER = 0x0100;

	private final WebViewHost webViewHost;
	private final Handler handler;

	private boolean paused;
	private boolean loading;
	private boolean hasSong;
	private int headsetHookPressCount;

	private MediaSession mediaSession;
	private MediaMetadata.Builder mediaSessionMetadataBuilder;
	private PlaybackState.Builder mediaSessionPlaybackStateBuilder;

	public HostMediaSession(WebViewHost webViewHost) {
		this.webViewHost = webViewHost;
		this.handler = new Handler(Looper.getMainLooper(), msg -> {
			if (msg.what == MSG_HEADSET_HOOK_TIMER)
				processHeadsetHookTimer();
			return true;
		});

		this.paused = true;

		try {
			mediaSessionMetadataBuilder = new MediaMetadata.Builder();
			mediaSessionPlaybackStateBuilder = new PlaybackState.Builder();
			mediaSessionPlaybackStateBuilder.setActions(
				PlaybackState.ACTION_PLAY_FROM_MEDIA_ID |
				PlaybackState.ACTION_SKIP_TO_PREVIOUS |
				PlaybackState.ACTION_REWIND |
				PlaybackState.ACTION_PAUSE |
				PlaybackState.ACTION_PLAY |
				PlaybackState.ACTION_PLAY_PAUSE |
				PlaybackState.ACTION_STOP |
				PlaybackState.ACTION_FAST_FORWARD |
				PlaybackState.ACTION_SKIP_TO_NEXT |
				PlaybackState.ACTION_SEEK_TO
			);
			mediaSession = new MediaSession(webViewHost.application, "FPlayWeb");
			mediaSession.setCallback(new MediaSession.Callback() {
				@Override
				public boolean onMediaButtonEvent(@NonNull Intent mediaButtonIntent) {
					final Object o = mediaButtonIntent.getParcelableExtra(Intent.EXTRA_KEY_EVENT);
					if (!(o instanceof KeyEvent))
						return false;
					final KeyEvent e = (KeyEvent)o;
					if (e.getAction() == KeyEvent.ACTION_DOWN)
						handleMediaButton(e.getKeyCode());
					return true;
				}

				@Override
				public void onPlayFromMediaId(String mediaId, Bundle extras) {
					try {
						if (mediaId != null && mediaId.length() > 0)
							skipToQueueItem(Long.parseLong(mediaId));
					} catch (Throwable ex) {
						// Just ignore...
					}
				}

				@Override
				public void onSkipToQueueItem(long id) {
					skipToQueueItem(id);
				}

				@Override
				public void onSkipToPrevious() {
					handleMediaButton(KeyEvent.KEYCODE_MEDIA_PREVIOUS);
				}

				@Override
				public void onRewind() {
					handleMediaButton(KeyEvent.KEYCODE_MEDIA_REWIND);
				}

				@Override
				public void onPause() {
					handleMediaButton(KeyEvent.KEYCODE_MEDIA_PAUSE);
				}

				@Override
				public void onPlay() {
					handleMediaButton(KeyEvent.KEYCODE_MEDIA_PLAY);
				}

				@Override
				public void onStop() {
					handleMediaButton(KeyEvent.KEYCODE_MEDIA_STOP);
				}

				@Override
				public void onFastForward() {
					handleMediaButton(KeyEvent.KEYCODE_MEDIA_FAST_FORWARD);
				}

				@Override
				public void onSkipToNext() {
					handleMediaButton(KeyEvent.KEYCODE_MEDIA_NEXT);
				}

				@Override
				public void onSeekTo(long pos) {
					seekTo(pos);
				}
			});
			final Intent intent = new Intent(webViewHost.application, MainActivity.class);
			intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
			mediaSession.setSessionActivity(PendingIntent.getActivity(webViewHost.application, 0, intent, PendingIntent.FLAG_IMMUTABLE));
			mediaSession.setPlaybackState(mediaSessionPlaybackStateBuilder.setState(PlaybackState.STATE_STOPPED, 0, 1, SystemClock.elapsedRealtime()).build());
			mediaSession.setActive(true);
		} catch (Throwable ex) {
			ex.printStackTrace();
		}
	}

	private void resetHeadsetHook() {
		headsetHookPressCount = 0;
		handler.removeMessages(MSG_HEADSET_HOOK_TIMER);
	}

	private void processHeadsetHookTimer() {
		final WebView webView = webViewHost.webView;

		if (mediaSession == null || webView == null)
			return;

		final int headsetHookPressCount = this.headsetHookPressCount;
		resetHeadsetHook();

		switch (headsetHookPressCount) {
		case 1:
			webView.evaluateJavascript("App.player && App.player.playPause()", null);
			break;
		case 2:
			webView.evaluateJavascript("App.player && App.player.next()", null);
			break;
		default:
			webView.evaluateJavascript("App.player && App.player.previous()", null);
			break;
		}
	}

	private void setPlaybackState() {
		if (mediaSession == null)
			return;

		try {
			mediaSession.setPlaybackState(mediaSessionPlaybackStateBuilder.setState(hasSong ? (loading ? PlaybackState.STATE_BUFFERING : (paused ? PlaybackState.STATE_PAUSED : PlaybackState.STATE_PLAYING)) : PlaybackState.STATE_STOPPED, 0, 1, SystemClock.elapsedRealtime()).build());
		} catch (Throwable ex) {
			ex.printStackTrace();
		}
	}

	public void setPaused(boolean paused) {
		this.paused = paused;
		setPlaybackState();
	}

	public void setLoading(boolean loading) {
		this.loading = loading;
		setPlaybackState();
	}

	public void setMetadata(long id, String title, String artist, String album, int track, long lengthMS, int year) {
		if (mediaSession == null)
			return;

		hasSong = (id > 0);
		try {
			if (id > 0) {
				mediaSessionMetadataBuilder.putString(MediaMetadata.METADATA_KEY_MEDIA_ID, Long.toString(id));
				mediaSessionMetadataBuilder.putString(MediaMetadata.METADATA_KEY_TITLE, title);
				mediaSessionMetadataBuilder.putString(MediaMetadata.METADATA_KEY_ARTIST, artist);
				mediaSessionMetadataBuilder.putString(MediaMetadata.METADATA_KEY_ALBUM, album);
				mediaSessionMetadataBuilder.putLong(MediaMetadata.METADATA_KEY_TRACK_NUMBER, track);
				mediaSessionMetadataBuilder.putLong(MediaMetadata.METADATA_KEY_DURATION, lengthMS);
				mediaSessionMetadataBuilder.putLong(MediaMetadata.METADATA_KEY_YEAR, year);
			} else {
				mediaSessionMetadataBuilder.putString(MediaMetadata.METADATA_KEY_MEDIA_ID, NONE);
				mediaSessionMetadataBuilder.putString(MediaMetadata.METADATA_KEY_TITLE, NONE);
				mediaSessionMetadataBuilder.putString(MediaMetadata.METADATA_KEY_ARTIST, NONE);
				mediaSessionMetadataBuilder.putString(MediaMetadata.METADATA_KEY_ALBUM, NONE);
				mediaSessionMetadataBuilder.putLong(MediaMetadata.METADATA_KEY_TRACK_NUMBER, 0);
				mediaSessionMetadataBuilder.putLong(MediaMetadata.METADATA_KEY_DURATION, 0);
				mediaSessionMetadataBuilder.putLong(MediaMetadata.METADATA_KEY_YEAR, 0);
			}
			mediaSession.setMetadata(mediaSessionMetadataBuilder.build());
		} catch (Throwable ex) {
			ex.printStackTrace();
		}
		setPlaybackState();
	}

	private void handleMediaButton(int keyCode) {
		final WebView webView = webViewHost.webView;

		if (webView == null)
			return;

		switch (keyCode) {
		// There are a few weird bluetooth headsets that despite having only one physical
		// play/pause button, will try to simulate individual PLAY and PAUSE events,
		// instead of sending the proper event PLAY_PAUSE... The problem is, they are not
		// always synchronized with the actual player state, and therefore, the user ends
		// up having to press that button twice for something to happen! :(
		case KeyEvent.KEYCODE_MEDIA_PLAY:
		case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
		case KeyEvent.KEYCODE_MEDIA_PAUSE:
		case KeyEvent.KEYCODE_BREAK:
		case KeyEvent.KEYCODE_CALL:
			webView.evaluateJavascript("App.player && App.player.playPause()", null);
			break;
		case KeyEvent.KEYCODE_HEADSETHOOK:
			handler.removeMessages(MSG_HEADSET_HOOK_TIMER);
			headsetHookPressCount++;
			if (headsetHookPressCount >= 3)
				processHeadsetHookTimer();
			else
				handler.sendEmptyMessageAtTime(MSG_HEADSET_HOOK_TIMER, SystemClock.uptimeMillis() + 500);
			break;
		case KeyEvent.KEYCODE_MEDIA_PREVIOUS:
			webView.evaluateJavascript("App.player && App.player.previous()", null);
			break;
		case KeyEvent.KEYCODE_MEDIA_REWIND:
			webView.evaluateJavascript("App.player && App.player.seekBackward()", null);
			break;
		case KeyEvent.KEYCODE_MEDIA_STOP:
			webView.evaluateJavascript("App.player && App.player.stop()", null);
			break;
		case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
			webView.evaluateJavascript("App.player && App.player.seekForward()", null);
			break;
		case KeyEvent.KEYCODE_MEDIA_NEXT:
			webView.evaluateJavascript("App.player && App.player.next()", null);
			break;
		}
	}

	public void skipToQueueItem(long id) {
		final WebView webView = webViewHost.webView;

		if (webView != null && id > 0)
			webView.evaluateJavascript("App.player && App.player.playSongId(" + id + ")", null);
	}

	public void seekTo(long timeMS) {
		final WebView webView = webViewHost.webView;

		if (webView != null)
			webView.evaluateJavascript("App.player && App.player.seekTo(" + timeMS + ")", null);
	}

	public void destroy() {
		resetHeadsetHook();

		if (mediaSession != null) {
			try {
				mediaSession.setActive(false);
				mediaSession.setCallback(null);
				mediaSession.release();
			} catch (Throwable ex) {
				ex.printStackTrace();
			}
			mediaSession = null;
		}
		mediaSessionMetadataBuilder = null;
		mediaSessionPlaybackStateBuilder = null;
	}
}
