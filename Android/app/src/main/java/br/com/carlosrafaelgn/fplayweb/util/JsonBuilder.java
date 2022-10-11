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
package br.com.carlosrafaelgn.fplayweb.util;

import android.support.annotation.NonNull;

import java.util.Stack;

@SuppressWarnings({"unused", "WeakerAccess", "UnusedReturnValue"})
public final class JsonBuilder {
	private final StringBuilder builder;
	private final Stack<Boolean> scopeHasValues;

	public static JsonBuilder nullJson() {
		JsonBuilder builder = new JsonBuilder(4);
		builder.builder.append("null");
		return builder;
	}

	public JsonBuilder() {
		builder = new StringBuilder(32 * 1024);
		scopeHasValues = new Stack<>();
		scopeHasValues.push(false);
	}

	public JsonBuilder(int capacity) {
		builder = new StringBuilder(Math.max(capacity, 16));
		scopeHasValues = new Stack<>();
		scopeHasValues.push(false);
	}

	@Override
	@NonNull
	public String toString() {
		return builder.toString();
	}

	private void write(String value) {
		final int tot = value.length();

		builder.ensureCapacity(builder.length() + tot);

		for (int i = 0; i < tot; i++) {
			final char c = value.charAt(i);
			switch (c) {
			case '\"':
				builder.append("\\\"");
				break;
			case '\\':
				builder.append("\\\\");
				break;
			default:
				if (c < 0x20) {
					switch (c) {
					case '\b':
						builder.append("\\b");
						break;
					case '\n':
						builder.append("\\n");
						break;
					case '\r':
						builder.append("\\r");
						break;
					case '\t':
						builder.append("\\t");
						break;
					default:
						builder.append("\\u00");
						builder.append((char)((c >> 4) + '0'));
						int tmp = (c & 0x0F);
						builder.append((char)(tmp < 10 ? (tmp + '0') : (tmp - 10 + 'A')));
						break;
					}
				} else {
					builder.append(c);
				}
				break;
			}
		}
	}

	public JsonBuilder appendRawString(String rawString) {
		builder.append(rawString);
		return this;
	}

	public JsonBuilder clear() {
		builder.delete(0, builder.length());
		scopeHasValues.clear();
		scopeHasValues.push(false);
		return this;
	}

	public JsonBuilder array() {
		if (scopeHasValues.peek()) {
			builder.append(',');
		} else {
			scopeHasValues.pop();
			scopeHasValues.push(true);
		}
		scopeHasValues.push(false);
		builder.append('[');
		return this;
	}

	public JsonBuilder array(String name) {
		if (scopeHasValues.peek()) {
			// Se esse não é o primeiro objeto desse escopo (array ou objeto),
			// adiciona uma vírgula para separar
			builder.append(',');
		} else {
			// Se esse era o primeiro objeto do escopo, apenas indica que
			// agora já existe alguém, para que os próximos adicionem uma vírgula
			scopeHasValues.pop();
			scopeHasValues.push(true);
		}
		scopeHasValues.push(false);
		builder.append('\"');
		builder.append(name);
		builder.append("\":[");
		return this;
	}

	public JsonBuilder endArray() {
		scopeHasValues.pop();
		builder.append(']');
		return this;
	}

	public JsonBuilder object() {
		if (scopeHasValues.peek()) {
			builder.append(',');
		} else {
			scopeHasValues.pop();
			scopeHasValues.push(true);
		}
		scopeHasValues.push(false);
		builder.append('{');
		return this;
	}

	public JsonBuilder object(String name) {
		if (scopeHasValues.peek()) {
			builder.append(',');
		} else {
			scopeHasValues.pop();
			scopeHasValues.push(true);
		}
		scopeHasValues.push(false);
		builder.append('\"');
		builder.append(name);
		builder.append("\":{");
		return this;
	}

	public JsonBuilder endObject() {
		scopeHasValues.pop();
		builder.append('}');
		return this;
	}

	public JsonBuilder propRaw(String name, String value) {
		if (scopeHasValues.peek()) {
			builder.append(',');
		} else {
			scopeHasValues.pop();
			scopeHasValues.push(true);
		}
		builder.append('\"');
		builder.append(name);
		if (value == null) {
			builder.append("\":null");
		} else {
			builder.append("\":");
			builder.append(value);
		}
		return this;
	}

	public JsonBuilder prop(String name, String value) {
		return prop(name, value, false);
	}

	public JsonBuilder prop(String name, String value, boolean safeString) {
		if (scopeHasValues.peek()) {
			builder.append(',');
		} else {
			scopeHasValues.pop();
			scopeHasValues.push(true);
		}
		builder.append('\"');
		builder.append(name);
		if (value == null) {
			builder.append("\":null");
		} else {
			builder.append("\":\"");
			if (safeString)
				builder.append(value);
			else
				write(value);
			builder.append('\"');
		}
		return this;
	}

	public JsonBuilder prop(String name, boolean value) {
		if (scopeHasValues.peek()) {
			builder.append(',');
		} else {
			scopeHasValues.pop();
			scopeHasValues.push(true);
		}
		builder.append('\"');
		builder.append(name);
		builder.append("\":");
		builder.append(value ? "true" : "false");
		return this;
	}

	public JsonBuilder prop(String name, int value) {
		if (scopeHasValues.peek()) {
			builder.append(',');
		} else {
			scopeHasValues.pop();
			scopeHasValues.push(true);
		}
		builder.append('\"');
		builder.append(name);
		builder.append("\":");
		builder.append(value);
		return this;
	}

	public JsonBuilder prop(String name, long value) {
		if (scopeHasValues.peek()) {
			builder.append(',');
		} else {
			scopeHasValues.pop();
			scopeHasValues.push(true);
		}
		builder.append('\"');
		builder.append(name);
		builder.append("\":");
		builder.append(value);
		return this;
	}

	public JsonBuilder prop(String name, float value) {
		if (scopeHasValues.peek()) {
			builder.append(',');
		} else {
			scopeHasValues.pop();
			scopeHasValues.push(true);
		}
		builder.append('\"');
		builder.append(name);
		builder.append("\":");
		builder.append(value);
		return this;
	}

	public JsonBuilder prop(String name, double value) {
		if (scopeHasValues.peek()) {
			builder.append(',');
		} else {
			scopeHasValues.pop();
			scopeHasValues.push(true);
		}
		builder.append('\"');
		builder.append(name);
		builder.append("\":");
		builder.append(value);
		return this;
	}

	public JsonBuilder valueRaw(String value) {
		if (scopeHasValues.peek()) {
			builder.append(',');
		} else {
			scopeHasValues.pop();
			scopeHasValues.push(true);
		}
		builder.append((value == null) ? "null" : value);
		return this;
	}

	public JsonBuilder value(String value) {
		return value(value, false);
	}

	public JsonBuilder value(String value, boolean safeString) {
		if (scopeHasValues.peek()) {
			builder.append(',');
		} else {
			scopeHasValues.pop();
			scopeHasValues.push(true);
		}
		if (value == null) {
			builder.append("null");
		} else {
			builder.append('\"');
			if (safeString)
				builder.append(value);
			else
				write(value);
			builder.append('\"');
		}
		return this;
	}

	public JsonBuilder value(boolean value) {
		if (scopeHasValues.peek()) {
			builder.append(',');
		} else {
			scopeHasValues.pop();
			scopeHasValues.push(true);
		}
		builder.append(value ? "true" : "false");
		return this;
	}

	public JsonBuilder value(int value) {
		if (scopeHasValues.peek()) {
			builder.append(',');
		} else {
			scopeHasValues.pop();
			scopeHasValues.push(true);
		}
		builder.append(value);
		return this;
	}

	public JsonBuilder value(long value) {
		if (scopeHasValues.peek()) {
			builder.append(',');
		} else {
			scopeHasValues.pop();
			scopeHasValues.push(true);
		}
		builder.append(value);
		return this;
	}

	public JsonBuilder value(float value) {
		if (scopeHasValues.peek()) {
			builder.append(',');
		} else {
			scopeHasValues.pop();
			scopeHasValues.push(true);
		}
		builder.append(value);
		return this;
	}

	public JsonBuilder value(double value) {
		if (scopeHasValues.peek()) {
			builder.append(',');
		} else {
			scopeHasValues.pop();
			scopeHasValues.push(true);
		}
		builder.append(value);
		return this;
	}
}
