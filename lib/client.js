window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-artifact-preview",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");

		// -----------------------------------------------------------------------
		// 产物预览插件：对话内产物行（chips + 图片缩略图，点击进侧边预览）+
		// 侧边预览面板（Markdown / 代码 / CSV / JSON / 图片 / HTML 渲染，真分屏）。
		// 纯 DOM + React，零额外依赖，离线可用。
		// -----------------------------------------------------------------------

		const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".svg", ".bmp"]);
		const CODE_EXTS = new Set([".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".sh", ".bash", ".zsh", ".css", ".scss", ".less", ".json", ".yaml", ".yml", ".toml", ".ini", ".conf", ".cfg", ".env", ".xml", ".sql", ".rs", ".go", ".java", ".c", ".h", ".cpp", ".hpp", ".cs", ".rb", ".php", ".kt", ".swift", ".txt", ".gitignore", ".dockerfile", ".lock", ".log"]);
		/** 从扩展名推断预览方式：image/markdown/csv/json/code，null 走 iframe。 */
		function previewKindFor(path) {
			const m = /\.([A-Za-z0-9]+)$/.exec(String(path || ""));
			const ext = m ? "." + m[1].toLowerCase() : "";
			if (IMAGE_EXTS.has(ext)) return "image";
			if (ext === ".md" || ext === ".markdown") return "markdown";
			if (ext === ".csv") return "csv";
			if (ext === ".json") return "json";
			if (CODE_EXTS.has(ext)) return "code";
			return null;
		}
		/** 是否可站内预览（html 也走 iframe 预览）。 */
		function previewablePath(p) {
			const k = previewKindFor(p);
			return k !== null || /\.x?html?$/i.test(String(p || ""));
		}

		function basename(p) {
			const parts = String(p).split(/[\\/]/);
			return parts[parts.length - 1] || p;
		}
		function dirname(p) {
			const idx = Math.max(String(p).lastIndexOf("\\"), String(p).lastIndexOf("/"));
			return idx > 0 ? String(p).slice(0, idx) : "";
		}
		function escHtml(s) {
			return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
		}
		function staticUrlForPath(p) {
			const segs = String(p).replace(/\\/g, "/").split("/").filter(Boolean);
			return "/dsh-files/static/" + segs.map((s) => encodeURIComponent(s)).join("/");
		}
		function langFromPath(p) {
			const m = /\.([A-Za-z0-9]+)$/.exec(String(p || ""));
			const ext = m ? m[1].toLowerCase() : "";
			const map = { py: "python", js: "js", mjs: "js", cjs: "js", ts: "js", tsx: "js", jsx: "js", json: "json", yaml: "yaml", yml: "yaml", sh: "bash", bash: "bash", zsh: "bash", css: "css", scss: "css", sql: "sql", go: "go", java: "java", rs: "rust", c: "c", h: "c", cpp: "c", hpp: "c", rb: "ruby", md: "markdown", markdown: "markdown" };
			return map[ext] || "";
		}

		/** 行内 Markdown：先抽出行内代码保护，再转义、应用链接/图片/粗斜体/删除线。 */
		function mdInline(s) {
			const codes = [];
			let t = String(s).replace(/`([^`]+)`/g, (_, c) => {
				codes.push("<code>" + escHtml(c) + "</code>");
				return "\u0000" + (codes.length - 1) + "\u0000";
			});
			t = escHtml(t);
			t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, '<img src="$2" alt="$1" loading="lazy">');
			t = t.replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
			t = t.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
			t = t.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
			t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
			t = t.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
			return t.replace(/\u0000(\d+)\u0000/g, (_, n) => codes[Number(n)] || "");
		}

		/** 紧凑 Markdown → HTML：代码块/标题/引用/分隔线/列表/表格/段落/行内样式。 */
		function mdToHtml(src) {
			const lines = String(src || "").replace(/\r\n?/g, "\n").split("\n");
			let html = "", i = 0, listType = null;
			const closeList = () => {
				if (listType) { html += listType === "ul" ? "</ul>" : "</ol>"; listType = null; }
			};
			while (i < lines.length) {
				const line = lines[i];
				const trimmed = line.trim();
				if (!trimmed) { i++; continue; }
				const fence = /^```(\S*)\s*$/.exec(trimmed);
				if (fence) {
					closeList();
					const lang = fence[1];
					const buf = [];
					i++;
					while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) { buf.push(lines[i]); i++; }
					i++;
					html += '<pre class="dsh-apv-code"><code>' + highlightCode(buf.join("\n"), lang) + "</code></pre>";
					continue;
				}
				const h = /^(#{1,6})\s+(.*)$/.exec(trimmed);
				if (h) {
					closeList();
					const lv = h[1].length;
					html += "<h" + lv + ">" + mdInline(h[2]) + "</h" + lv + ">";
					i++;
					continue;
				}
				if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) { closeList(); html += "<hr>"; i++; continue; }
				if (/^>\s?/.test(trimmed)) {
					closeList();
					const buf = [];
					while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
					html += "<blockquote>" + buf.map((l) => mdInline(l)).join("<br>") + "</blockquote>";
					continue;
				}
				const ul = /^(\s*)[-*+]\s+(.*)$/.exec(line);
				const ol = /^(\s*)\d+\.\s+(.*)$/.exec(line);
				if (ul || ol) {
					const isUl = !!ul;
					const m = ul || ol;
					if (!listType) { listType = isUl ? "ul" : "ol"; html += "<" + listType + ">"; }
					else if ((isUl && listType !== "ul") || (!isUl && listType !== "ol")) { closeList(); listType = isUl ? "ul" : "ol"; html += "<" + listType + ">"; }
					html += "<li>" + mdInline(m[2]) + "</li>";
					i++;
					continue;
				}
				if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes("-")) {
					closeList();
					const headCells = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
					i += 2;
					html += "<table><thead><tr>" + headCells.map((c) => "<th>" + mdInline(c) + "</th>").join("") + "</tr></thead><tbody>";
					while (i < lines.length && /^\s*\|/.test(lines[i])) {
						const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
						html += "<tr>" + cells.map((c) => "<td>" + mdInline(c) + "</td>").join("") + "</tr>";
						i++;
					}
					html += "</tbody></table>";
					continue;
				}
				closeList();
				const para = [trimmed];
				i++;
				while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>\s?|[-*+]\s|\d+\.\s)/.test(lines[i])) {
					para.push(lines[i].trim());
					i++;
				}
				html += "<p>" + para.map(mdInline).join("<br>") + "</p>";
			}
			closeList();
			return html;
		}

		const TOKEN_STRING = '"""([\\s\\S]*?)"""|\'\'\'([\\s\\S]*?)\'\'\'|`(?:\\\\.|[^`\\\\])*`|"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'';
		const TOKEN_KEYWORD = '\\b(?:def|class|return|import|from|if|elif|else|for|while|try|except|finally|with|as|pass|break|continue|lambda|yield|global|nonlocal|raise|assert|and|or|not|in|is|None|True|False|self|async|await|del|const|let|var|function|new|typeof|instanceof|of|extends|super|this|export|default|throw|delete|void|null|undefined|static|get|set|case|switch|do|interface|implements|public|private|protected|package|struct|enum|fn|impl|use|mod|pub|match|go|func|select|range|chan|map|type|nil|true|false|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|TABLE|JOIN|GROUP|ORDER|BY|LIMIT|VALUES|AND|OR|NOT|NULL|echo|printf|include|require)\\b';
		const TOKEN_NUMBER = '\\b\\d+(?:\\.\\d+)?\\b';
		function commentSource(lang) {
			let src = '\\/\\/.*$|/\\*[\\s\\S]*?\\*/|<!--[\\s\\S]*?-->';
			if (lang === "python" || lang === "bash" || lang === "yaml" || lang === "ruby") src = '#.*$|' + src;
			return src;
		}
		/** 轻量语法高亮（通用 token 化：字符串/注释/关键字/数字），未知语言退化为纯文本。 */
		function highlightCode(code, lang) {
			const text = String(code || "");
			if (!text) return "";
			const all = new RegExp(TOKEN_STRING + "|" + commentSource(lang) + "|" + TOKEN_KEYWORD + "|" + TOKEN_NUMBER, "gm");
			const out = [];
			let last = 0, m;
			while ((m = all.exec(text))) {
				if (m.index > last) out.push(escHtml(text.slice(last, m.index)));
				const tok = m[0];
				const test = (src, flags) => { const r = new RegExp("^(?:" + src + ")$", flags); r.lastIndex = 0; return r.test(tok); };
				let cls = null;
				if (test(TOKEN_STRING)) cls = "dsh-apv-tok-s";
				else if (test(commentSource(lang), "m")) cls = "dsh-apv-tok-c";
				else if (test(TOKEN_KEYWORD)) cls = "dsh-apv-tok-k";
				else if (test(TOKEN_NUMBER)) cls = "dsh-apv-tok-n";
				out.push(cls ? '<span class="' + cls + '">' + escHtml(tok) + "</span>" : escHtml(tok));
				last = m.index + tok.length;
			}
			if (last < text.length) out.push(escHtml(text.slice(last)));
			return out.join("");
		}

		/** CSV → HTML 表格（处理引号包裹与逗号转义）。 */
		function csvToTable(text) {
			const rows = [];
			let row = [], cell = "", inQ = false;
			const s = String(text || "");
			for (let k = 0; k < s.length; k++) {
				const ch = s[k];
				if (inQ) {
					if (ch === '"') { if (s[k + 1] === '"') { cell += '"'; k++; } else inQ = false; }
					else cell += ch;
				} else if (ch === '"') inQ = true;
				else if (ch === ",") { row.push(cell); cell = ""; }
				else if (ch === "\n" || ch === "\r") {
					if (ch === "\r" && s[k + 1] === "\n") k++;
					row.push(cell); cell = ""; rows.push(row); row = [];
				} else cell += ch;
			}
			if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
			if (!rows.length) return '<p class="dsh-apv-empty">空文件</p>';
			const max = Math.max.apply(null, rows.map((r) => r.length));
			let html = '<div class="dsh-apv-table-wrap"><table class="dsh-apv-table">';
			rows.forEach((r, ri) => {
				html += "<tr>";
				for (let c = 0; c < max; c++) {
					const v = escHtml(r[c] === undefined ? "" : r[c]);
					html += ri === 0 ? "<th>" + v + "</th>" : "<td>" + v + "</td>";
				}
				html += "</tr>";
			});
			return html + "</table></div>";
		}

		function jsonInline(v) {
			if (v === null) return '<span class="dsh-apv-j-null">null</span>';
			const t = typeof v;
			if (t === "string") {
				const str = String(v);
				return '<span class="dsh-apv-j-str">"' + escHtml(str.length > 60 ? str.slice(0, 60) + "…" : str) + '"</span>';
			}
			if (t === "number" || t === "boolean") return '<span class="dsh-apv-j-' + (t === "number" ? "num" : "bool") + '">' + escHtml(String(v)) + "</span>";
			if (Array.isArray(v)) return '<span class="dsh-apv-j-meta">Array(' + v.length + ")</span>";
			if (t === "object") return '<span class="dsh-apv-j-meta">Object(' + Object.keys(v).length + ")</span>";
			return escHtml(String(v));
		}
		function jsonNode(v, key) {
			const isArr = Array.isArray(v);
			if (v === null || typeof v !== "object") {
				return '<div class="dsh-apv-j-row"><span class="dsh-apv-j-key">' + escHtml(key) + '</span>: ' + jsonInline(v) + "</div>";
			}
			const keys = Object.keys(v);
			const body = keys.map((k) => jsonNode(v[k], isArr ? "" : k)).join("");
			const label = escHtml(key || (isArr ? "[" + v.length + "]" : "{}"));
			return '<div class="dsh-apv-j-row"><details' + (keys.length <= 6 ? " open" : "") + "><summary>" + label + " " + jsonInline(v) + "</summary><div class=\"dsh-apv-j-body\">" + (body || '<span class="dsh-apv-j-empty">（空）</span>') + "</div></details></div>";
		}
		/** JSON → 可折叠树；解析失败退化为高亮文本。 */
		function jsonToHtml(text) {
			let obj;
			try { obj = JSON.parse(String(text || "null")); } catch (e) { return highlightCode(text, "json"); }
			return '<div class="dsh-apv-json">' + jsonNode(obj, "root") + "</div>";
		}

		/** 把渲染结果里的相对路径（src/href）解析为指向该文件同目录的静态服务 URL。 */
		function resolveLocalLinks(html, filePath) {
			const dir = dirname(filePath);
			if (!dir) return html;
			return String(html).replace(/(src|href)="([^"]+)"/g, (m, attr, url) => {
				if (/^(?:https?:|data:|#|\/)/i.test(url)) return m;
				const abs = (dir.replace(/[\\/]+$/, "") + "/" + url).replace(/[\\/]+/g, "/");
				return attr + '="' + staticUrlForPath(abs) + '"';
			});
		}

		// -----------------------------------------------------------------------
		// 侧边预览面板（可拖宽，真分屏）：HTML/端口走 iframe，其余按类型渲染
		// -----------------------------------------------------------------------

		const PREVIEW_PANEL_ID = "__dsh_artifact_preview__";

		let staticBasePromise = null;
		function staticBaseUrl() {
			if (!window.dshDesktop || typeof window.dshDesktop.getInfo !== "function") return Promise.resolve("");
			if (!staticBasePromise) {
				staticBasePromise = window.dshDesktop.getInfo()
					.then((i) => (i && i.staticPort) ? "http://127.0.0.1:" + i.staticPort : "")
					.catch(() => "");
			}
			return staticBasePromise;
		}
		function shellStaticUrlForPath(base, p) {
			const segs = String(p).replace(/\\/g, "/").split("/").filter(Boolean);
			return base + "/" + segs.map((s) => encodeURIComponent(s)).join("/");
		}
		function normalizeEntryUrl(text) {
			const t = String(text || "").trim();
			if (!t) return "";
			let m = t.match(/^(?:https?:\/\/)?localhost:(\d{2,5})(\/.*)?$/i);
			if (!m) m = t.match(/^:?(\d{2,5})(\/.*)?$/);
			if (m) return "http://127.0.0.1:" + m[1] + (m[2] || "/");
			if (!/^https?:\/\//i.test(t)) return "http://" + t;
			return t;
		}

		function buildPreviewPanel() {
			if (typeof document === "undefined" || !document.body) return null;
			const existing = document.getElementById(PREVIEW_PANEL_ID);
			if (existing) return existing;

			const root = document.createElement("div");
			root.id = PREVIEW_PANEL_ID;
			root.className = "dsh-apv";
			root.style.top = window.dshDesktop ? "36px" : "0px";
			root.innerHTML =
				'<div class="dsh-apv-resizer" title="拖动调整宽度"></div>' +
				'<div class="dsh-apv-head">' +
				'<button class="dsh-apv-btn" data-act="back" title="后退">←</button>' +
				'<button class="dsh-apv-btn" data-act="fwd" title="前进">→</button>' +
				'<button class="dsh-apv-btn" data-act="reload" title="刷新">⟳</button>' +
				'<input class="dsh-apv-url" spellcheck="false" placeholder="http://127.0.0.1:3000 或项目 HTML 文件" />' +
				'<button class="dsh-apv-btn" data-act="external" title="在外部打开">↗</button>' +
				'<button class="dsh-apv-btn" data-act="close" title="关闭预览">✕</button>' +
				'</div>' +
				'<div class="dsh-apv-chips"></div>' +
				'<div class="dsh-apv-body"><div class="dsh-apv-content" hidden></div><iframe class="dsh-apv-frame" title="preview" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"></iframe></div>' +
				'<div class="dsh-apv-status">未加载</div>';
			document.body.appendChild(root);

			const frame = root.querySelector(".dsh-apv-frame");
			const contentEl = root.querySelector(".dsh-apv-content");
			const input = root.querySelector(".dsh-apv-url");
			const statusEl = root.querySelector(".dsh-apv-status");
			const chipsEl = root.querySelector(".dsh-apv-chips");

			const state = {
				history: [],
				index: -1,
				filePath: null,
				ports: [],
				portsAt: 0
			};
			root.__state = state;
			// 页面基准右留白：仅面板创建时记录一次。不能在 show() 里重复覆盖——
			// 面板开着再点开别的产物会再次 show()，把"当前分屏留白"误存为基准，
			// 导致关闭后留白无法清除（卡在分屏）。
			let bodyPrevPadding = document.body.style.paddingRight || "";

			function setWidth(w) {
				const max = Math.max(320, Math.floor(window.innerWidth * 0.85));
				const v = Math.min(max, Math.max(280, w));
				root.style.width = v + "px";
				// 真分屏：面板打开时给页面右侧留出等宽留白，应用内容整体左移、不被遮挡
				document.body.style.paddingRight = root.style.display === "flex" ? v + "px" : "";
			}
			function setStatus(text, cls) {
				statusEl.textContent = text;
				statusEl.className = "dsh-apv-status" + (cls ? " " + cls : "");
			}
			function navigate(url) {
				if (!url) return;
				if (state.history[state.index] !== url) {
					state.history = state.history.slice(0, state.index + 1);
					state.history.push(url);
					state.index = state.history.length - 1;
				}
				input.value = url;
				if (/^\//.test(url)) frame.removeAttribute("sandbox");
				else frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups allow-modals");
				if (state.contentEl) state.contentEl.hidden = true;
				frame.hidden = false;
				frame.src = url;
				setStatus("加载中… " + url);
				checkOnline(url);
			}
			async function checkOnline(url) {
				if (!/^https?:\/\//i.test(url)) return;
				try {
					const res = await fetch("/api/dsh-files/check?url=" + encodeURIComponent(url));
					const j = await res.json();
					if (j && j.ok) setStatus("在线 · HTTP " + j.status + " · " + url);
					else setStatus("离线 · " + ((j && j.error) || "连接失败") + " · " + url);
				} catch {}
			}
			frame.addEventListener("load", () => {
				if (frame.src && frame.src !== "about:blank") setStatus("已加载 · " + state.history[state.index]);
			});
			async function refreshChips() {
				try {
					const res = await fetch("/api/dsh-files/ports");
					const j = await res.json();
					state.ports = Array.isArray(j.ports) ? j.ports : [];
				} catch {
					state.ports = [];
				}
				chipsEl.textContent = "";
				const addChip = (label, title, onClick) => {
					const b = document.createElement("button");
					b.className = "dsh-apv-chip";
					b.textContent = label;
					if (title) b.title = title;
					b.addEventListener("click", onClick);
					chipsEl.appendChild(b);
				};
				addChip("端口", "本机回环监听端口（点击预览）");
				for (const p of state.ports.slice(0, 40)) {
					addChip(String(p), "预览 http://127.0.0.1:" + p + "/", () => navigate("http://127.0.0.1:" + p + "/"));
				}
				addChip("⟳", "重新探测端口", refreshChips);
			}
			function show() {
				root.style.display = "flex";
				root.setAttribute("data-open", "1");
				setWidth(Number(localStorage.getItem("dsh.apv.width")) || 440);
				refreshChips();
			}
			function hide() {
				root.style.display = "none";
				root.setAttribute("data-open", "0");
				document.body.style.paddingRight = bodyPrevPadding || "";
			}

			root.querySelector('[data-act="back"]').addEventListener("click", () => {
				if (state.index > 0) { state.index -= 1; navigate(state.history[state.index]); }
			});
			root.querySelector('[data-act="fwd"]').addEventListener("click", () => {
				if (state.index < state.history.length - 1) { state.index += 1; navigate(state.history[state.index]); }
			});
			root.querySelector('[data-act="reload"]').addEventListener("click", () => {
				const cur = state.history[state.index];
				if (cur) { frame.src = "about:blank"; setTimeout(() => { frame.src = cur; }, 30); }
			});
			root.querySelector('[data-act="close"]').addEventListener("click", hide);
			root.querySelector('[data-act="external"]').addEventListener("click", () => {
				const url = state.history[state.index];
				if (state.filePath && window.dshDesktop && typeof window.dshDesktop.openPath === "function") {
					window.dshDesktop.openPath(state.filePath).catch(() => {});
				} else if (url) {
					if (window.dshDesktop && typeof window.dshDesktop.openExternal === "function") {
						window.dshDesktop.openExternal(url).catch(() => {});
					} else { window.open(url, "_blank", "noopener"); }
				}
			});
			input.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					const url = normalizeEntryUrl(input.value);
					state.filePath = null;
					if (url) navigate(url);
				}
			});
			root.querySelector(".dsh-apv-resizer").addEventListener("mousedown", (e) => {
				e.preventDefault();
				const startX = e.clientX;
				const startW = root.getBoundingClientRect().width;
				const onMove = (ev) => setWidth(startW + (startX - ev.clientX));
				const onUp = () => {
					window.removeEventListener("mousemove", onMove);
					window.removeEventListener("mouseup", onUp);
					frame.style.pointerEvents = "";
					document.body.style.userSelect = "";
					localStorage.setItem("dsh.apv.width", String(root.getBoundingClientRect().width));
				};
				frame.style.pointerEvents = "none";
				document.body.style.userSelect = "none";
				window.addEventListener("mousemove", onMove);
				window.addEventListener("mouseup", onUp);
			});

			state.navigate = navigate;
			state.show = show;
			state.hide = hide;
			state.frame = frame;
			state.contentEl = contentEl;
			state.setStatus = setStatus;
			state.showContent = (html, status) => {
				contentEl.hidden = false;
				frame.hidden = true;
				contentEl.innerHTML = html;
				if (status) setStatus(status);
			};
			return root;
		}

		/** 打开侧边预览：file 目标传 {kind:"file", filePath}，端口传 URL/端口号。 */
		function openPreview(target, meta) {
			const panel = buildPreviewPanel();
			if (!panel) return;
			const st = panel.__state;
			if (meta && meta.kind === "file") {
				st.filePath = meta.filePath || target;
				st.show();
				const kind = previewKindFor(target);
				const sameOriginUrl = staticUrlForPath(target);
				if (kind === "image") {
					staticBaseUrl().then((base) => {
						const url = base ? shellStaticUrlForPath(base, target) : sameOriginUrl;
						st.showContent('<div class="dsh-apv-img"><img src="' + url + '" alt="' + escHtml(basename(target)) + '" /></div>', "图片预览 · " + basename(target));
					});
				} else if (kind === "markdown" || kind === "code" || kind === "csv" || kind === "json") {
					st.setStatus("读取中… " + basename(target));
					fetch(sameOriginUrl).then((r) => {
						if (!r.ok) throw new Error("HTTP " + r.status);
						return r.text();
					}).then((text) => {
						const MAX = 600000;
						let note = "";
						if (text.length > MAX) { text = text.slice(0, MAX); note = '<div class="dsh-apv-truncate">文件过大，仅预览前 ' + MAX + " 字符。</div>"; }
						let html;
						if (kind === "markdown") html = resolveLocalLinks(mdToHtml(text), target);
						else if (kind === "csv") html = csvToTable(text);
						else if (kind === "json") html = jsonToHtml(text);
						else html = '<pre class="dsh-apv-code"><code>' + highlightCode(text, langFromPath(target)) + "</code></pre>";
						st.showContent(note + html, "渲染预览 · " + basename(target));
					}).catch((err) => {
						st.showContent('<div class="dsh-apv-err">读取失败：' + escHtml(String((err && err.message) || err)) + "</div>", "预览失败");
					});
				} else {
					staticBaseUrl().then((base) => {
						st.navigate(base ? shellStaticUrlForPath(base, target) : sameOriginUrl);
					});
				}
			} else {
				st.filePath = null;
				const url = normalizeEntryUrl(target);
				if (!url) return;
				st.show();
				st.navigate(url);
			}
		}

		// -----------------------------------------------------------------------
		// 对话内产物行：chips + 图片缩略图，点击进侧边预览
		// -----------------------------------------------------------------------

		/** 一轮产物路径（与官方 deliverables 投影同源，取 "deliverables" 轮数据）。 */
		function producedForClosing(data, seq = Number.POSITIVE_INFINITY) {
			if (data === void 0) return [];
			const paths = [];
			const seen = new Set();
			for (const produced of data.produced) {
				if (produced.seq > seq || seen.has(produced.path)) continue;
				seen.add(produced.path);
				paths.push(produced.path);
			}
			return paths;
		}
		/** turnTail 链选择器：有产物时命中（低 priority，优先于官方 deliverables 行）。 */
		function selectProduced(owner) {
			const paths = producedForClosing(owner.turn.data.get("deliverables"), owner.seq);
			return paths.length === 0 ? null : paths;
		}
		function openInPreview(path, fallback) {
			if (typeof window !== "undefined" && window.__dshOpenFilePreview) {
				window.__dshOpenFilePreview(path);
				return;
			}
			if (typeof fallback === "function") fallback(path);
		}
		/** 产物类型 → 徽章/标签/类型色（卡片化产物行的视觉语义）。 */
		const CARD_META = {
			image: { tag: "IMG", label: "图片" },
			markdown: { tag: "MD", label: "Markdown" },
			code: { tag: "</>", label: "代码" },
			csv: { tag: "CSV", label: "表格" },
			json: { tag: "JSON", label: "数据" },
			html: { tag: "HTML", label: "网页" },
			document: { tag: "DOC", label: "文档" },
			file: { tag: "FILE", label: "文件" }
		};
		const CARD_COLOR = {
			image: "#f778ba", markdown: "#2f81f7", code: "#3fb950", csv: "#39c5cf",
			json: "#d29922", html: "#f0883e", document: "#8b949e", file: "#8b949e"
		};
		function cardKind(path) {
			const k = previewKindFor(path);
			if (k === "image" || k === "markdown" || k === "code" || k === "csv" || k === "json") return k;
			if (k === null && /\.x?html?$/i.test(String(path))) return "html";
			if (/\.(docx?|pdf|pptx?|xlsx?)$/i.test(String(path))) return "document";
			return "file";
		}
		/** 渲染一轮产物为类型色卡片：图片卡内嵌缩略图，点击进侧边预览。 */
		function ProducedFilesRow({ matched: paths, openFile }) {
			const shown = paths.slice(0, 8);
			const hidden = paths.length - shown.length;
			const card = (p) => {
				const kind = cardKind(p);
				const meta = CARD_META[kind];
				const color = CARD_COLOR[kind];
				const isImg = kind === "image";
				return react_jsx_runtime.jsx("button", {
					type: "button",
					title: p,
					className: "dsh-apv-card",
					style: { "--apv-c": color },
					onClick: () => { openInPreview(p, openFile); },
					children: [
						isImg ? react_jsx_runtime.jsx("img", {
							src: staticUrlForPath(p), alt: basename(p), loading: "lazy",
							className: "dsh-apv-card-thumb"
						}) : null,
						react_jsx_runtime.jsx("span", {
							className: "dsh-apv-card-tag",
							style: { color: color, background: "color-mix(in srgb, " + color + " 14%, transparent)" },
							children: meta.tag
						}),
						react_jsx_runtime.jsx("span", { className: "dsh-apv-card-name", children: basename(p) }),
						react_jsx_runtime.jsx("span", { className: "dsh-apv-card-meta", children: meta.label })
					]
				}, p);
			};
			return react_jsx_runtime.jsxs("div", {
				style: { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "16px", alignItems: "stretch" },
				children: [
					react_jsx_runtime.jsx("span", {
						style: { color: "var(--dsw-alias-label-tertiary)", fontSize: "13px", lineHeight: "22px", flexBasis: "100%" },
						children: "产物"
					}),
					shown.map(card),
					hidden > 0 && react_jsx_runtime.jsx("span", {
						className: "dsh-apv-more",
						children: "+ " + hidden + " 个文件"
					})
				]
			});
		}

		// -----------------------------------------------------------------------
		// 样式
		// -----------------------------------------------------------------------

		const CSS = [
			".dsh-apv{position:fixed;top:0;right:0;bottom:0;width:440px;max-width:85vw;display:none;flex-direction:column;background:var(--dsw-alias-bg-base);border-left:1px solid var(--dsw-alias-border-l2);box-shadow:-10px 0 28px rgba(0,0,0,.18);z-index:2147482990;box-sizing:border-box}",
			".dsh-apv[data-open=\"1\"]{display:flex}",
			".dsh-apv-resizer{position:absolute;left:-4px;top:0;bottom:0;width:8px;cursor:ew-resize;z-index:3}",
			".dsh-apv-resizer:hover,.dsh-apv-resizer:active{background:var(--dsw-alias-interactive-bg-hover)}",
			".dsh-apv-head{display:flex;align-items:center;gap:4px;padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}",
			".dsh-apv-btn{appearance:none;border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;width:24px;height:24px;border-radius:6px;padding:0;font-size:12px;line-height:1;flex:none}",
			".dsh-apv-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
			".dsh-apv-url{flex:1;min-width:0;height:26px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:12px;padding:0 8px;font-family:var(--ds-font-family-code,Consolas,monospace);outline:none;box-sizing:border-box}",
			".dsh-apv-chips{display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:5px 8px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;max-height:60px;overflow-y:auto}",
			".dsh-apv-chip{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);border-radius:999px;font-size:10.5px;line-height:16px;padding:0 8px;cursor:pointer;font-variant-numeric:tabular-nums}",
			".dsh-apv-chip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
			".dsh-apv-body{flex:1;min-height:0;position:relative;background:#fff}",
			".dsh-apv-frame{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff}",
			".dsh-apv-status{padding:4px 10px;font-size:11px;color:var(--dsw-alias-label-tertiary);border-top:1px solid var(--dsw-alias-border-l2);flex:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			// 内容渲染
			".dsh-apv-content{position:absolute;inset:0;overflow:auto;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#1f2328);font-size:13px;line-height:1.6;padding:14px 16px;box-sizing:border-box}",
			".dsh-apv-content[hidden]{display:none}",
			".dsh-apv-content h1,.dsh-apv-content h2,.dsh-apv-content h3,.dsh-apv-content h4{line-height:1.3;margin:14px 0 8px;font-weight:600}",
			".dsh-apv-content h1{font-size:20px;border-bottom:1px solid var(--dsw-alias-border-l2);padding-bottom:6px}",
			".dsh-apv-content h2{font-size:17px;border-bottom:1px solid var(--dsw-alias-border-l2);padding-bottom:4px}",
			".dsh-apv-content h3{font-size:15px}",
			".dsh-apv-content p{margin:8px 0}",
			".dsh-apv-content a{color:var(--dsw-alias-state-info-primary,#0969da)}",
			".dsh-apv-content code{font-family:var(--ds-font-family-code,Consolas,monospace);background:var(--dsw-alias-bg-layer-2);border-radius:4px;padding:1px 4px;font-size:12px}",
			".dsh-apv-content pre{background:#0d1117;color:#e6edf3;border-radius:8px;padding:10px 12px;overflow-x:auto;line-height:1.45}",
			".dsh-apv-content pre code{background:transparent;padding:0;font-size:12px;color:inherit}",
			".dsh-apv-content blockquote{border-left:3px solid var(--dsw-alias-border-l2);margin:8px 0;padding:2px 12px;color:var(--dsw-alias-label-secondary)}",
			".dsh-apv-content hr{border:none;border-top:1px solid var(--dsw-alias-border-l2);margin:14px 0}",
			".dsh-apv-content ul,.dsh-apv-content ol{margin:8px 0;padding-left:24px}",
			".dsh-apv-content li{margin:3px 0}",
			".dsh-apv-content table{border-collapse:collapse;margin:10px 0;font-size:12.5px;max-width:100%}",
			".dsh-apv-content th,.dsh-apv-content td{border:1px solid var(--dsw-alias-border-l2);padding:5px 10px;text-align:left}",
			".dsh-apv-content th{background:var(--dsw-alias-bg-layer-2);font-weight:600}",
			".dsh-apv-content img{max-width:100%;height:auto}",
			".dsh-apv-content .dsh-apv-table-wrap{overflow-x:auto}",
			".dsh-apv-content .dsh-apv-tok-k{color:#ff7b72}",
			".dsh-apv-content .dsh-apv-tok-s{color:#a5d6ff}",
			".dsh-apv-content .dsh-apv-tok-c{color:#8b949e;font-style:italic}",
			".dsh-apv-content .dsh-apv-tok-n{color:#79c0ff}",
			".dsh-apv-img{display:flex;align-items:center;justify-content:center;min-height:200px;background:repeating-conic-gradient(#e5e7eb 0 25%,#fff 0 50%) 0 0/20px 20px;border-radius:8px;padding:12px}",
			".dsh-apv-img img{max-width:100%;max-height:70vh;object-fit:contain;box-shadow:0 2px 12px rgba(0,0,0,.15);border-radius:4px}",
			".dsh-apv-err{color:var(--dsw-alias-state-error-primary);font-size:12.5px;padding:12px;border:1px dashed var(--dsw-alias-state-error-primary);border-radius:8px}",
			".dsh-apv-truncate{color:var(--dsw-alias-state-warn-label);font-size:11px;margin:0 0 8px}",
			".dsh-apv-json{background:#0d1117;color:#e6edf3;border-radius:8px;padding:10px 12px;font-family:var(--ds-font-family-code,Consolas,monospace);font-size:12px;overflow-x:auto}",
			".dsh-apv-json summary{cursor:pointer;user-select:none;list-style:none;white-space:nowrap}",
			".dsh-apv-json summary::-webkit-details-marker{display:none}",
			".dsh-apv-json summary::before{content:'▸ ';color:var(--dsw-alias-label-tertiary)}",
			".dsh-apv-json details[open]>summary::before{content:'▾ '}",
			".dsh-apv-j-key{color:#79c0ff}",
			".dsh-apv-j-str{color:#a5d6ff}",
			".dsh-apv-j-num{color:#79c0ff}",
			".dsh-apv-j-bool{color:#ff7b72}",
			".dsh-apv-j-null{color:#8b949e;font-style:italic}",
			".dsh-apv-j-meta{color:var(--dsw-alias-label-tertiary);font-size:11px}",
			".dsh-apv-j-row{margin:2px 0}",
			".dsh-apv-j-body{padding-left:16px;border-left:1px solid var(--dsw-alias-border-l2,#30363d);margin-left:6px}",
			".dsh-apv-empty{color:var(--dsw-alias-label-tertiary);padding:12px}",
			// 产物卡片行
			".dsh-apv-card{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:10px;padding:8px 10px;cursor:pointer;display:flex;flex-direction:column;gap:4px;align-items:flex-start;min-width:132px;max-width:210px;flex:1 0 132px;text-align:left;transition:border-color .18s,transform .18s,box-shadow .18s;font:inherit;margin:0}",
			".dsh-apv-card:hover{border-color:var(--apv-c,#8b949e);transform:translateY(-1px);box-shadow:0 6px 18px rgba(0,0,0,.08)}",
			".dsh-apv-card:focus-visible{outline:2px solid var(--apv-c,#8b949e);outline-offset:1px}",
			".dsh-apv-card-thumb{width:100%;max-height:84px;object-fit:cover;border-radius:6px;background:#fff;margin-bottom:2px;display:block;border:1px solid var(--dsw-alias-border-l2)}",
			".dsh-apv-card-tag{font-family:var(--ds-font-family-code,Consolas,monospace);font-size:10px;line-height:1;padding:3px 6px;border-radius:5px;font-weight:700;letter-spacing:.05em}",
			".dsh-apv-card-name{font-size:12.5px;font-weight:500;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}",
			".dsh-apv-card-meta{font-size:10.5px;color:var(--dsw-alias-label-tertiary)}",
			".dsh-apv-more{align-self:center;color:var(--dsw-alias-label-tertiary);font-size:12px;padding:0 6px}"
		].join("");

		const TAG = "@deepseek-ai/dsh-artifact-preview/client.css";
		function ensureCss() {
			if (typeof document === "undefined") return;
			if (document.querySelector("style[data-plugin-css=" + JSON.stringify(TAG) + "]")) return;
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-artifact-preview";
			tag.dataset.pluginCss = TAG;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}

		// -----------------------------------------------------------------------
		// 插件主体
		// -----------------------------------------------------------------------

		const inject = ["slots"];

		function apply(ctx) {
			ensureCss();
			buildPreviewPanel();
			// 全局钩子：供会话 openFile（conversation 胶水）与文件视图按钮调用
			if (typeof window !== "undefined") {
				window.__dshOpenFilePreview = (absPath) => openPreview(absPath, { kind: "file", filePath: absPath });
				window.__dshCanPreviewPath = (absPath) => previewablePath(absPath);
				window.__dshStaticFileUrl = (absPath) => staticUrlForPath(absPath);
			}
			// 对话产物行：低 priority 赢得 turnTail 链选举，替换官方 deliverables 行
			ctx.slots.inject("conversation.chat.turnTail", () => ctx.slots.register({
				name: "conversation.chat.turnTail",
				priority: -100,
				select: selectProduced,
				registrant: "dsh-artifact-preview"
			}, ProducedFilesRow), "dsh-artifact-preview: turn tail entry");
		}

		exports.apply = apply;
		exports.inject = inject;
		exports.ProducedFilesRow = ProducedFilesRow;
		exports.selectProduced = selectProduced;
		exports.openPreview = openPreview;
		return module.exports;
	}
});
