/* =====================================================
   SALC Iran — main.js
   0) Paths
   1) Theme (dark mode toggle)
   2) Shared helpers + progress store
   3) Content bank (topics, activities, progress)
   4) AI conversation prompt library
   ===================================================== */


/* =====================================================
   0. Paths
   Resolved relative to THIS file, so they work from any
   page depth (levels/a1.html, levels/a1/some-page.html...).
   Expected structure: js/main.js and data/*.json
   ===================================================== */

const SCRIPT_URL =
    (document.currentScript && document.currentScript.src) ||
    window.location.href;

const dataUrl = file => new URL(`../data/${file}`, SCRIPT_URL).href;

const CONTENT_BANK_URL = dataUrl("content-bank.json");
const PROMPTS_URL = dataUrl("prompts.json");


/* =====================================================
   1. Theme (dark mode)
   Default: LIGHT. Dark mode only by user choice.
   Keep this script in <head> WITHOUT "defer".
   ===================================================== */

(function () {
    const STORAGE_KEY = "salc-theme";
    const root = document.documentElement;

    function getSavedTheme() {
        try {
            const theme = localStorage.getItem(STORAGE_KEY);
            return theme === "dark" || theme === "light" ? theme : null;
        } catch (error) {
            return null;
        }
    }

    function applyTheme(theme) {
        const selectedTheme = theme === "dark" ? "dark" : "light";

        root.dataset.theme = selectedTheme;

        document.querySelectorAll(".theme-toggle").forEach(button => {
            button.setAttribute("aria-pressed", String(selectedTheme === "dark"));
        });
    }

    // Applies immediately, before the page is painted
    applyTheme(getSavedTheme() || "light");

    function initializeThemeToggle() {
        // The buttons did not exist yet when the line above ran
        applyTheme(root.dataset.theme);

        document.querySelectorAll(".theme-toggle").forEach(button => {
            if (button.dataset.themeInitialized === "true") return;
            button.dataset.themeInitialized = "true";

            button.addEventListener("click", function () {
                const nextTheme =
                    (root.dataset.theme || "light") === "dark" ? "light" : "dark";

                applyTheme(nextTheme);

                try {
                    localStorage.setItem(STORAGE_KEY, nextTheme);
                } catch (error) {
                    // The toggle still works if storage is unavailable.
                }
            });
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeThemeToggle, { once: true });
    } else {
        initializeThemeToggle();
    }

    // Keep several open tabs in sync
    window.addEventListener("storage", event => {
        if (event.key === STORAGE_KEY) {
            applyTheme(getSavedTheme() || "light");
        }
    });
})();


/* =====================================================
   2. Shared helpers + progress store
   ===================================================== */

function escapeHTML(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Only allow HTTP and HTTPS URLs (and relative links).
function safeUrl(url) {
    if (!url) return null;

    try {
        const parsed = new URL(url, window.location.href);
        return ["http:", "https:"].includes(parsed.protocol)
            ? escapeHTML(url)
            : null;
    } catch (error) {
        return null;
    }
}

// Creates a DOM element safely (text is never parsed as HTML).
function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);

    for (const [key, value] of Object.entries(attrs)) {
        if (value === null || value === undefined || value === false) continue;

        if (key === "text") {
            node.textContent = value;
        } else {
            node.setAttribute(key, value === true ? "" : value);
        }
    }

    [].concat(children).forEach(child => {
        if (child) node.append(child);
    });

    return node;
}

// Announces a message to screen readers (and shows it on screen).
// Clearing first makes repeated identical messages announce again.
function announce(container, message) {
    const status = container.querySelector(".content-status, .prompt-status");
    if (!status) return;

    status.textContent = "";
    clearTimeout(status._timer);
    status._timer = setTimeout(() => {
        status.textContent = message;
    }, 60);
}

// Learner progress. Stored ONLY in this browser (localStorage); nothing is sent anywhere.
const PROGRESS_KEY = "salc-progress-v1";

const progressStore = {
    read() {
        try {
            const data = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
            return data && typeof data.completed === "object" && data.completed !== null
                ? data
                : { completed: {} };
        } catch (error) {
            return { completed: {} };
        }
    },

    set(id, done) {
        const data = this.read();

        if (done) {
            data.completed[id] = new Date().toISOString();
        } else {
            delete data.completed[id];
        }

        try {
            localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
        } catch (error) {
            return false;
        }

        document.dispatchEvent(
            new CustomEvent("salc:progress", { detail: { id, done } })
        );

        return true;
    }
};

// Public API for activity pages, e.g.  SALC.progress.complete("a1-pi-01");
window.SALC = Object.assign(window.SALC || {}, {
    progress: {
        isComplete: id => Boolean(progressStore.read().completed[id]),
        complete: id => progressStore.set(id, true),
        reset: id => progressStore.set(id, false)
    }
});


/* =====================================================
   3. Content bank
   ===================================================== */

// Validates the data and reports problems in the browser console (F12).
function validateContentBank(data) {
    const problems = [];
    const topicIds = new Set();
    const activityIds = new Set();
    const missing = value => value === undefined || value === null || value === "";

    (data.topics || []).forEach((topic, i) => {
        const where = `topics[${i}]`;

        ["id", "title", "level", "description", "learning_outcome"].forEach(field => {
            if (missing(topic[field])) problems.push(`${where}: missing "${field}"`);
        });

        if (topicIds.has(topic.id)) problems.push(`${where}: duplicate id "${topic.id}"`);
        topicIds.add(topic.id);

        const stages = new Set();

        (topic.activities || []).forEach((activity, j) => {
            const w = `${topic.id || where}.activities[${j}]`;

            ["id", "stage", "skill", "title", "description", "status"].forEach(field => {
                if (missing(activity[field])) problems.push(`${w}: missing "${field}"`);
            });

            if (activityIds.has(activity.id)) problems.push(`${w}: duplicate id "${activity.id}"`);
            activityIds.add(activity.id);

            if (stages.has(activity.stage)) problems.push(`${w}: duplicate stage ${activity.stage}`);
            stages.add(activity.stage);

            if (!["available", "planned"].includes(activity.status)) {
                problems.push(`${w}: unknown status "${activity.status}"`);
            }

            if (activity.status === "available" && missing(activity.url)) {
                problems.push(`${w}: status is "available" but url is missing`);
            }
        });
    });

    problems.forEach(problem => console.warn("Content bank:", problem));
    return problems;
}

function renderActivity(activity, completed) {
    const url = activity.status === "available" ? safeUrl(activity.url) : null;
    const isDone = Boolean(url && completed[activity.id]);
    const title = escapeHTML(activity.title);

    const actions = url
        ? `
            <div class="activity-actions">
                <a
                    class="check-button"
                    href="${url}"
                    aria-label="Start Activity: ${title}"
                >Start Activity <span aria-hidden="true">→</span></a>

                <button
                    class="done-toggle"
                    type="button"
                    data-activity-id="${escapeHTML(activity.id)}"
                    aria-pressed="${isDone}"
                    aria-label="Mark as done: ${title}"
                >Mark as done</button>
            </div>
        `
        : `<span class="content-coming-soon">Coming soon</span>`;

    return `
        <article class="activity-item${isDone ? " is-done" : ""}">
            <span class="content-skill">
                Step ${escapeHTML(activity.stage)} · ${escapeHTML(activity.skill)}
            </span>

            <h4>${title}</h4>

            <p>${escapeHTML(activity.description)}</p>

            ${actions}
        </article>
    `;
}

function renderTopic(topic, index, containerId, completed) {
    const key = topic.id
        ? String(topic.id).replace(/[^\w-]/g, "")
        : String(index);

    const panelId = `${containerId}-panel-${key}`;
    const buttonId = `${containerId}-toggle-${key}`;

    const list = (topic.activities || [])
        .slice()
        .sort((a, b) => (a.stage ?? 0) - (b.stage ?? 0));

    const total = list.length;

    const doneCount = list.filter(
        activity => activity.status === "available" && completed[activity.id]
    ).length;

    const progress = total
        ? `
            <div class="topic-progress">
                <progress
                    class="topic-progress-bar"
                    max="${total}"
                    value="${doneCount}"
                    aria-label="Progress: ${escapeHTML(topic.title)}"
                ></progress>
                <span class="topic-progress-text">
                    ${doneCount} of ${total} activities done
                </span>
            </div>
        `
        : "";

    // Optional second-language title
    const titleFa = topic.title_fa
        ? `<span class="topic-title-fa" lang="fa" dir="rtl">${escapeHTML(topic.title_fa)}</span>`
        : "";

    return `
        <article
            class="content-card topic-card"
            id="topic-${key}"
            data-total="${total}"
        >
            <h2 class="topic-heading">
                <button
                    class="topic-toggle"
                    type="button"
                    id="${buttonId}"
                    aria-expanded="false"
                    aria-controls="${panelId}"
                >
                    <span class="topic-card-content">
                        <span class="topic-label">
                            ${escapeHTML(topic.level)} Learning Topic
                        </span>
                        <span class="topic-title">${escapeHTML(topic.title)}</span>
                        ${titleFa}
                    </span>

                    <span class="topic-arrow" aria-hidden="true"></span>
                </button>
            </h2>

            <div class="topic-summary">
                <p>${escapeHTML(topic.description)}</p>

                <p class="topic-outcome">
                    <strong>Learning outcome:</strong>
                    ${escapeHTML(topic.learning_outcome)}
                </p>

                ${progress}
            </div>

            <div
                class="topic-activities"
                id="${panelId}"
                role="region"
                aria-labelledby="${buttonId}"
                hidden
            >
                <h3>Activities</h3>
                <div class="activity-grid">
                    ${list.map(activity => renderActivity(activity, completed)).join("")}
                </div>
            </div>
        </article>
    `;
}

function setTopicExpanded(button, expanded) {
    const panel = document.getElementById(button.getAttribute("aria-controls"));
    if (!panel) return;

    button.setAttribute("aria-expanded", String(expanded));
    panel.hidden = !expanded;
}

function updateTopicProgress(topicEl) {
    if (!topicEl) return;

    const bar = topicEl.querySelector(".topic-progress-bar");
    const text = topicEl.querySelector(".topic-progress-text");
    if (!bar || !text) return;

    const total = Number(topicEl.dataset.total) || 0;
    const done = topicEl.querySelectorAll('.done-toggle[aria-pressed="true"]').length;

    bar.value = done;
    text.textContent = `${done} of ${total} activities done`;
}

function handleDoneToggle(button, container) {
    const id = button.dataset.activityId;
    if (!id) return;

    const done = button.getAttribute("aria-pressed") !== "true";
    const saved = progressStore.set(id, done);

    button.setAttribute("aria-pressed", String(done));

    const item = button.closest(".activity-item");
    if (item) item.classList.toggle("is-done", done);

    updateTopicProgress(button.closest(".topic-card"));

    announce(
        container,
        !saved
            ? "Progress could not be saved in this browser."
            : done
                ? "Marked as done. Progress is saved on this device."
                : "Marked as not done."
    );
}

// Lets other pages link straight to a topic: levels/a1.html#topic-personal-information
function openTopicFromHash(container) {
    let hash = "";

    try {
        hash = decodeURIComponent(window.location.hash.slice(1));
    } catch (error) {
        return;
    }

    if (!hash.startsWith("topic-")) return;

    const topicEl = [...container.querySelectorAll(".topic-card")]
        .find(card => card.id === hash);

    if (!topicEl) return;

    const button = topicEl.querySelector(".topic-toggle");
    if (button) setTopicExpanded(button, true);

    topicEl.scrollIntoView({ block: "start" });
}

async function loadContentBank(level, containerId = "content-bank") {
    const container = document.getElementById(containerId);
    if (!container || !level) return;

    container.setAttribute("aria-busy", "true");
    container.innerHTML = `<p role="status">Loading learning resources...</p>`;

    try {
        const response = await fetch(CONTENT_BANK_URL);

        if (!response.ok) {
            throw new Error(`Could not load the content bank (${response.status}).`);
        }

        const data = await response.json();

        validateContentBank(data);

        const wanted = String(level).toUpperCase();

        const topics = (Array.isArray(data.topics) ? data.topics : []).filter(
            topic => String(topic.level || "").toUpperCase() === wanted
        );

        if (topics.length === 0) {
            container.innerHTML =
                `<p>Learning activities for this level are coming soon.</p>`;
            return;
        }

        const completed = progressStore.read().completed;

        container.innerHTML =
            topics
                .map((topic, index) => renderTopic(topic, index, containerId, completed))
                .join("") +
            `<p class="content-status" role="status" aria-live="polite"></p>`;

        // One click handler for everything (event delegation)
        container.onclick = event => {
            const doneButton = event.target.closest(".done-toggle");

            if (doneButton && container.contains(doneButton)) {
                handleDoneToggle(doneButton, container);
                return;
            }

            const toggle = event.target.closest(".topic-toggle");
            if (!toggle || !container.contains(toggle)) return;

            setTopicExpanded(toggle, toggle.getAttribute("aria-expanded") !== "true");
        };

        openTopicFromHash(container);

    } catch (error) {
        console.error("Content bank error:", error);

        if (window.location.protocol === "file:") {
            console.warn(
                "SALC: fetch() is blocked when a page is opened directly as a file. " +
                "Use a local server (e.g. VS Code Live Server) or GitHub Pages."
            );
        }

        container.innerHTML = `
            <p role="alert">
                Learning resources could not be loaded.
                Please check your connection and try again.
            </p>
            <button class="prompt-btn" type="button" data-retry>Try again</button>
        `;

        container.onclick = event => {
            if (event.target.closest("[data-retry]")) {
                loadContentBank(level, containerId);
            }
        };

    } finally {
        container.removeAttribute("aria-busy");
    }
}


/* =====================================================
   4. AI conversation prompt library
   ===================================================== */

// param: null means "no URL prefill": the prompt is copied and the site opens.
// Claude and ChatGPT accept ?q=... (verify occasionally, these can change).
// Gemini's prefill is not officially documented, so it is copy-and-paste only.
const AI_PROVIDERS = [
    { id: "chatgpt", name: "ChatGPT", url: "https://chatgpt.com/",          param: "q" },
    { id: "claude",  name: "Claude",  url: "https://claude.ai/new",         param: "q" },
    { id: "gemini",  name: "Gemini",  url: "https://gemini.google.com/app", param: null }
];

// If a URL would be too long, open the provider without prefilled text.
const MAX_URL_LENGTH = 4000;

const promptsById = new Map();

function slugify(text) {
    return String(text)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "prompt";
}

async function copyText(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (error) {
        // Fall back to the older method below.
    }

    const area = el("textarea", {
        readonly: true,
        "aria-hidden": "true",
        style: "position:fixed;opacity:0;pointer-events:none;"
    });

    area.value = text;
    document.body.append(area);
    area.select();

    let ok = false;

    try {
        ok = document.execCommand("copy");
    } catch (error) {
        ok = false;
    }

    area.remove();

    return ok;
}

function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = el("a", { href: url, download: filename });

    document.body.append(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function promptFileText(item) {
    return [
        `${item.title} (${item.level})`,
        "=".repeat(40),
        "How to use: paste the prompt below into ChatGPT, Claude, Gemini, or another AI chat.",
        "Then answer the AI's questions in English. Do not share passwords or private information.",
        "",
        "--- Copy everything below this line ---",
        "",
        item.prompt
    ].join("\n");
}

function providerLink(provider, text) {
    if (!provider.param) return provider.url;

    const full = `${provider.url}?${provider.param}=${encodeURIComponent(text)}`;

    return full.length <= MAX_URL_LENGTH ? full : provider.url;
}

function flash(button, label) {
    const original = button.dataset.label || button.textContent;

    button.dataset.label = original;
    button.textContent = label;

    clearTimeout(button._timer);
    button._timer = setTimeout(() => {
        button.textContent = original;
    }, 1800);
}

function renderPrompt(item) {
    const titleId = `prompt-title-${item.id}`;

    const openLinks = AI_PROVIDERS.map(provider =>
        el("a", {
            class: "prompt-btn",
            href: providerLink(provider, item.prompt),
            target: "_blank",
            rel: "noopener noreferrer",
            "data-action": "open",
            "data-id": item.id,
            "data-provider": provider.id,
            "aria-label": `Open in ${provider.name} (new tab, prompt is copied)`,
            text: provider.name
        })
    );

    return el("article", { class: "prompt-card", "aria-labelledby": titleId }, [
        el("div", { class: "prompt-meta" }, [
            el("span", { class: "prompt-level", text: item.level }),
            item.time_minutes
                ? el("span", { class: "prompt-time", text: `${item.time_minutes} min` })
                : null
        ]),

        el("h3", { id: titleId, text: item.title }),

        item.description ? el("p", { text: item.description }) : null,

        el("details", { class: "prompt-preview" }, [
            el("summary", { text: "Preview prompt" }),
            // Focusable so keyboard users can scroll long prompts
            el("pre", {
                text: item.prompt,
                tabindex: "0",
                role: "region",
                "aria-label": "Prompt text"
            })
        ]),

        el("div", { class: "prompt-actions" }, [
            el("button", {
                class: "prompt-btn prompt-btn--primary",
                type: "button",
                "data-action": "copy",
                "data-id": item.id,
                text: "Copy prompt"
            }),

            el("button", {
                class: "prompt-btn",
                type: "button",
                "data-action": "download",
                "data-id": item.id,
                text: "Download .txt"
            }),

            el("div", { class: "prompt-open" }, [
                el("span", { text: "Open in:" }),
                ...openLinks
            ])
        ])
    ]);
}

async function handlePromptClick(event, container) {
    const target = event.target.closest("[data-action]");
    if (!target || !container.contains(target)) return;

    const action = target.dataset.action;

    if (action === "download-all") {
        const text = [...promptsById.values()]
            .map(promptFileText)
            .join("\n\n" + "=".repeat(60) + "\n\n");

        downloadText(
            `salc-${slugify(container.dataset.level || "all")}-prompts.txt`,
            text
        );

        announce(container, "Download started.");
        return;
    }

    const item = promptsById.get(target.dataset.id);
    if (!item) return;

    if (action === "copy") {
        const ok = await copyText(item.prompt);

        flash(target, ok ? "Copied ✓" : "Copy failed");

        announce(
            container,
            ok
                ? "Prompt copied. Paste it into an AI chat."
                : "Could not copy. Open the preview and copy the text manually."
        );
    }

    if (action === "download") {
        downloadText(`salc-${slugify(item.title)}.txt`, promptFileText(item));
        announce(container, "Download started.");
    }

    if (action === "open") {
        // Do NOT preventDefault: the link opens normally. We only copy as a backup.
        const ok = await copyText(item.prompt);

        announce(
            container,
            ok
                ? "Prompt copied. If the chat opens with an empty box, paste it with Ctrl+V (Cmd+V on Mac)."
                : "The chat is opening. If the box is empty, use Copy prompt and paste it."
        );
    }
}

async function loadPromptLibrary(level, containerId = "prompt-library") {
    const container = document.getElementById(containerId);
    if (!container || !level) return;

    container.setAttribute("aria-busy", "true");
    container.replaceChildren(
        el("p", { role: "status", text: "Loading practice prompts..." })
    );

    try {
        const response = await fetch(PROMPTS_URL);

        if (!response.ok) {
            throw new Error(`Could not load prompts (${response.status}).`);
        }

        const data = await response.json();
        const wanted = String(level).toUpperCase();

        const items = (Array.isArray(data.prompts) ? data.prompts : []).filter(
            item =>
                item &&
                item.id &&
                item.title &&
                item.prompt &&
                String(item.level || "").toUpperCase() === wanted
        );

        if (items.length === 0) {
            container.replaceChildren(
                el("p", { text: "Practice prompts for this level are coming soon." })
            );
            return;
        }

        promptsById.clear();
        items.forEach(item => promptsById.set(item.id, item));

        container.dataset.level = wanted;

        container.replaceChildren(
            el("div", { class: "prompt-toolbar" }, [
                el("p", { text: `${items.length} practice prompts for ${wanted}` }),
                el("button", {
                    class: "prompt-btn",
                    type: "button",
                    "data-action": "download-all",
                    text: `Download all ${wanted} prompts (.txt)`
                })
            ]),

            el("div", { class: "prompt-grid" }, items.map(renderPrompt)),

            el("p", {
                class: "prompt-status",
                role: "status",
                "aria-live": "polite"
            })
        );

        container.onclick = event => {
            handlePromptClick(event, container);
        };

    } catch (error) {
        console.error("Prompt library error:", error);

        container.replaceChildren(
            el("p", {
                role: "alert",
                text: "Practice prompts could not be loaded. Please check your connection and try again."
            }),
            el("button", {
                class: "prompt-btn",
                type: "button",
                "data-retry": "true",
                text: "Try again"
            })
        );

        container.onclick = event => {
            if (event.target.closest("[data-retry]")) {
                loadPromptLibrary(level, containerId);
            }
        };

    } finally {
        container.removeAttribute("aria-busy");
    }
}
